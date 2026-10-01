import { backupFileName, BackupRow, BackupTable, buildBackup, validateBackup } from './backup';

const ts = '2026-10-01T10:00:00.000Z';
const base = (id: string) => ({ id, createdAt: ts, updatedAt: ts, deletedAt: null });

function sample(): Record<BackupTable, BackupRow[]> {
  return {
    plan: [{ ...base('p1'), name: 'Oberkörper', weekdays: '[1]' }],
    plan_exercise: [
      {
        ...base('pe1'),
        planId: 'p1',
        exerciseId: 'e1',
        position: 0,
        targetSets: 3,
        repMin: 8,
        repMax: 10,
        restSeconds: 90,
      },
    ],
    workout_session: [
      { ...base('s1'), planId: 'p1', startedAt: ts, finishedAt: ts, status: 'finished' },
    ],
    session_exercise: [
      {
        ...base('se1'),
        sessionId: 's1',
        exerciseId: 'e1',
        position: 0,
        status: 'done',
        repMin: 8,
        repMax: 10,
        restSeconds: 90,
      },
    ],
    exercise_interval: [{ ...base('i1'), sessionExerciseId: 'se1', enteredAt: ts, leftAt: ts }],
    set_log: [
      {
        ...base('l1'),
        sessionExerciseId: 'se1',
        position: 0,
        weightKg: 80,
        reps: 8,
        completedAt: ts,
        isExtra: 0,
      },
    ],
  };
}

const catalog = new Set(['e1']);
const validate = (raw: unknown) => validateBackup(raw, 1, catalog);

describe('validateBackup', () => {
  it('accepts a backup it built itself', () => {
    const backup = buildBackup(sample(), 1, ts);
    const result = validate(JSON.parse(JSON.stringify(backup)));
    expect(result).toEqual({ ok: true, backup });
  });

  it('rejects other files and newer schemas', () => {
    expect(validate('hello')).toEqual({ ok: false, error: 'format' });
    expect(validate({ ...buildBackup(sample(), 1, ts), app: 'fitnotes' })).toEqual({
      ok: false,
      error: 'format',
    });
    expect(validate(buildBackup(sample(), 2, ts))).toEqual({ ok: false, error: 'newerSchema' });
    const missingTable = buildBackup(sample(), 1, ts) as unknown as {
      data: Record<string, unknown>;
    };
    delete missingTable.data['set_log'];
    expect(validate(missingTable)).toEqual({ ok: false, error: 'format' });
  });

  it('rejects rows with missing required values or wrong types', () => {
    const data = sample();
    data.plan[0]['name'] = null;
    expect(validate(buildBackup(data, 1, ts))).toEqual({ ok: false, error: 'invalidRow' });

    const typed = sample() as unknown as Record<string, Record<string, unknown>[]>;
    typed['set_log'][0]['reps'] = { evil: true };
    expect(validate(buildBackup(typed as never, 1, ts))).toEqual({
      ok: false,
      error: 'invalidRow',
    });
  });

  it('rejects broken references, including unknown exercises', () => {
    const orphan = sample();
    orphan.set_log[0]['sessionExerciseId'] = 'nope';
    expect(validate(buildBackup(orphan, 1, ts))).toEqual({ ok: false, error: 'missingReference' });

    expect(validateBackup(buildBackup(sample(), 1, ts), 1, new Set())).toEqual({
      ok: false,
      error: 'missingReference',
    });
  });

  it('allows workouts without a plan and drops unknown columns', () => {
    const data = sample() as unknown as Record<string, Record<string, unknown>[]>;
    data['workout_session'][0]['planId'] = null;
    data['plan'][0]['secret'] = 'x';
    const result = validate(buildBackup(data as never, 1, ts));
    expect(result.ok).toBe(true);
    expect(result.ok && result.backup.data.plan[0]).not.toHaveProperty('secret');
  });
});

describe('backupFileName', () => {
  it('uses the local date', () => {
    expect(backupFileName(new Date(2026, 9, 1, 23, 30))).toBe('grynd-backup-2026-10-01.json');
  });
});
