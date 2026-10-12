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
    exercise_note: [{ ...base('n1'), exerciseId: 'e1', text: 'Bank flach, Griff eng' }],
    exercise_note_image: [
      { ...base('img1'), exerciseId: 'e1' },
      { ...base('img0'), exerciseId: 'e1', deletedAt: ts },
    ],
  };
}

const photos = () => ({ img1: btoa('jpeg') });
const catalog = new Set(['e1']);
const validate = (raw: unknown) => validateBackup(raw, 3, catalog);

describe('validateBackup', () => {
  it('accepts a backup it built itself', () => {
    const backup = buildBackup(sample(), 3, ts, photos());
    const result = validate(JSON.parse(JSON.stringify(backup)));
    expect(result).toEqual({ ok: true, backup });
  });

  it('rejects other files and newer schemas', () => {
    expect(validate('hello')).toEqual({ ok: false, error: 'format' });
    expect(validate({ ...buildBackup(sample(), 3, ts, photos()), app: 'fitnotes' })).toEqual({
      ok: false,
      error: 'format',
    });
    expect(validate(buildBackup(sample(), 4, ts))).toEqual({ ok: false, error: 'newerSchema' });
    const missingTable = buildBackup(sample(), 3, ts, photos()) as unknown as {
      data: Record<string, unknown>;
    };
    delete missingTable.data['set_log'];
    expect(validate(missingTable)).toEqual({ ok: false, error: 'format' });
  });

  it('rejects rows with missing required values or wrong types', () => {
    const data = sample();
    data.plan[0]['name'] = null;
    expect(validate(buildBackup(data, 3, ts, photos()))).toEqual({
      ok: false,
      error: 'invalidRow',
    });

    const typed = sample() as unknown as Record<string, Record<string, unknown>[]>;
    typed['set_log'][0]['reps'] = { evil: true };
    expect(validate(buildBackup(typed as never, 3, ts, photos()))).toEqual({
      ok: false,
      error: 'invalidRow',
    });
  });

  it('rejects broken references, including unknown exercises', () => {
    const orphan = sample();
    orphan.set_log[0]['sessionExerciseId'] = 'nope';
    expect(validate(buildBackup(orphan, 3, ts, photos()))).toEqual({
      ok: false,
      error: 'missingReference',
    });

    expect(validateBackup(buildBackup(sample(), 3, ts, photos()), 3, new Set())).toEqual({
      ok: false,
      error: 'missingReference',
    });
  });

  it('reads backups from before exercise notes (schema 1) without notes', () => {
    const old = buildBackup(sample(), 1, ts) as unknown as {
      data: Record<string, unknown>;
      images?: unknown;
    };
    delete old.data['exercise_note'];
    delete old.data['exercise_note_image'];
    delete old.images;

    const result = validate(old);

    expect(result.ok).toBe(true);
    expect(result.ok && result.backup.data.exercise_note).toEqual([]);
    expect(result.ok && result.backup.images).toEqual({});
  });

  it('reads backups from before note photos (schema 2) without photos', () => {
    const old = buildBackup(sample(), 2, ts) as unknown as {
      data: Record<string, unknown>;
      images?: unknown;
    };
    delete old.data['exercise_note_image'];
    delete old.images;

    const result = validate(old);

    expect(result.ok).toBe(true);
    expect(result.ok && result.backup.data.exercise_note).toHaveLength(1);
    expect(result.ok && result.backup.data.exercise_note_image).toEqual([]);
    expect(result.ok && result.backup.images).toEqual({});
  });

  it('needs the file of every live photo, but not of deleted ones', () => {
    expect(validate(buildBackup(sample(), 3, ts, {}))).toEqual({
      ok: false,
      error: 'missingReference',
    });
    expect(validate(buildBackup(sample(), 3, ts, { img1: 'not base64!' }))).toEqual({
      ok: false,
      error: 'missingReference',
    });
    const withoutImages = buildBackup(sample(), 3, ts) as unknown as { images?: unknown };
    delete withoutImages.images;
    expect(validate(withoutImages)).toEqual({ ok: false, error: 'format' });

    const result = validate(buildBackup(sample(), 3, ts, { ...photos(), stray: btoa('x') }));
    expect(result.ok && result.backup.images).toEqual(photos());
  });

  it('requires the notes tables in newer backups and checks their exercise', () => {
    const missing = buildBackup(sample(), 3, ts, photos()) as unknown as {
      data: Record<string, unknown>;
    };
    delete missing.data['exercise_note'];
    expect(validate(missing)).toEqual({ ok: false, error: 'format' });

    const unknown = sample();
    unknown.exercise_note[0]['exerciseId'] = 'gone';
    expect(validate(buildBackup(unknown, 3, ts, photos()))).toEqual({
      ok: false,
      error: 'missingReference',
    });

    const photo = sample();
    photo.exercise_note_image[0]['exerciseId'] = 'gone';
    expect(validate(buildBackup(photo, 3, ts, photos()))).toEqual({
      ok: false,
      error: 'missingReference',
    });
  });

  it('allows workouts without a plan and drops unknown columns', () => {
    const data = sample() as unknown as Record<string, Record<string, unknown>[]>;
    data['workout_session'][0]['planId'] = null;
    data['plan'][0]['secret'] = 'x';
    const result = validate(buildBackup(data as never, 3, ts, photos()));
    expect(result.ok).toBe(true);
    expect(result.ok && result.backup.data.plan[0]).not.toHaveProperty('secret');
  });
});

describe('backupFileName', () => {
  it('uses the local date', () => {
    expect(backupFileName(new Date(2026, 9, 1, 23, 30))).toBe('grynd-backup-2026-10-01.json');
  });
});
