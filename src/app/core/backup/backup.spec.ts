import {
  backupFileName,
  BackupRow,
  BackupTable,
  buildBackup,
  summarizeBackup,
  validateBackup,
} from './backup';

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
        targetDurationSec: null,
      },
    ],
    workout_session: [
      {
        ...base('s1'),
        planId: 'p1',
        startedAt: ts,
        finishedAt: ts,
        status: 'finished',
        bodyWeightKg: 75,
      },
    ],
    workout_pause: [{ ...base('wp1'), sessionId: 's1', pausedAt: ts, resumedAt: ts }],
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
        targetDurationSec: null,
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
        durationSec: null,
        distanceM: null,
        level: null,
        kcal: null,
        heartRate: null,
        completedAt: ts,
        isExtra: 0,
      },
      {
        ...base('l2'),
        sessionExerciseId: 'se1',
        position: 1,
        weightKg: null,
        reps: null,
        durationSec: 1500,
        distanceM: 5200,
        level: 8,
        kcal: 310,
        heartRate: 142,
        completedAt: ts,
        isExtra: 1,
      },
    ],
    exercise_note: [{ ...base('n1'), exerciseId: 'e1', text: 'Bank flach, Griff eng' }],
    exercise_note_image: [
      { ...base('img1'), exerciseId: 'e1' },
      { ...base('img0'), exerciseId: 'e1', deletedAt: ts },
    ],
    exercise_setting: [{ ...base('x1'), exerciseId: 'e1', weightStepKg: 2, weightStepLb: null }],
  };
}

const photos = () => ({ img1: btoa('jpeg') });
const catalog = new Set(['e1']);
/** Schema of the current app (migration 6 added cardio entries, decision 0025). */
const SCHEMA = 6;
const validate = (raw: unknown) => validateBackup(raw, SCHEMA, catalog);

describe('validateBackup', () => {
  it('accepts a backup it built itself', () => {
    const backup = buildBackup(sample(), SCHEMA, ts, photos());
    const result = validate(JSON.parse(JSON.stringify(backup)));
    expect(result).toEqual({ ok: true, backup });
  });

  it('rejects other files and newer schemas', () => {
    expect(validate('hello')).toEqual({ ok: false, error: 'format' });
    expect(validate({ ...buildBackup(sample(), SCHEMA, ts, photos()), app: 'fitnotes' })).toEqual({
      ok: false,
      error: 'format',
    });
    expect(validate(buildBackup(sample(), SCHEMA + 1, ts))).toEqual({
      ok: false,
      error: 'newerSchema',
    });
    const missingTable = buildBackup(sample(), SCHEMA, ts, photos()) as unknown as {
      data: Record<string, unknown>;
    };
    delete missingTable.data['set_log'];
    expect(validate(missingTable)).toEqual({ ok: false, error: 'format' });
  });

  it('rejects rows with missing required values or wrong types', () => {
    const data = sample();
    data.plan[0]['name'] = null;
    expect(validate(buildBackup(data, SCHEMA, ts, photos()))).toEqual({
      ok: false,
      error: 'invalidRow',
    });

    const typed = sample() as unknown as Record<string, Record<string, unknown>[]>;
    typed['set_log'][0]['reps'] = { evil: true };
    expect(validate(buildBackup(typed as never, SCHEMA, ts, photos()))).toEqual({
      ok: false,
      error: 'invalidRow',
    });
  });

  it('rejects broken references, including unknown exercises', () => {
    const orphan = sample();
    orphan.set_log[0]['sessionExerciseId'] = 'nope';
    expect(validate(buildBackup(orphan, SCHEMA, ts, photos()))).toEqual({
      ok: false,
      error: 'missingReference',
    });

    expect(validateBackup(buildBackup(sample(), SCHEMA, ts, photos()), SCHEMA, new Set())).toEqual({
      ok: false,
      error: 'unknownExercise',
    });
  });

  it('reads backups from before exercise notes (schema 1) without notes', () => {
    const old = buildBackup(sample(), 1, ts) as unknown as {
      data: Record<string, unknown>;
      images?: unknown;
    };
    delete old.data['exercise_note'];
    delete old.data['exercise_note_image'];
    delete old.data['exercise_setting'];
    delete old.data['workout_pause'];
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
    delete old.data['exercise_setting'];
    delete old.data['workout_pause'];
    delete old.images;

    const result = validate(old);

    expect(result.ok).toBe(true);
    expect(result.ok && result.backup.data.exercise_note).toHaveLength(1);
    expect(result.ok && result.backup.data.exercise_note_image).toEqual([]);
    expect(result.ok && result.backup.images).toEqual({});
  });

  it('reads backups from before exercise settings (schema 3) without settings', () => {
    const old = buildBackup(sample(), 3, ts, photos()) as unknown as {
      data: Record<string, unknown>;
    };
    delete old.data['exercise_setting'];
    delete old.data['workout_pause'];

    const result = validate(old);

    expect(result.ok).toBe(true);
    expect(result.ok && result.backup.data.exercise_setting).toEqual([]);
    expect(result.ok && result.backup.data.exercise_note_image).toHaveLength(2);
  });

  it('requires the settings table in newer backups and checks its exercise', () => {
    const missing = buildBackup(sample(), SCHEMA, ts, photos()) as unknown as {
      data: Record<string, unknown>;
    };
    delete missing.data['exercise_setting'];
    expect(validate(missing)).toEqual({ ok: false, error: 'format' });

    const unknown = sample();
    unknown.exercise_setting[0]['exerciseId'] = 'gone';
    expect(validate(buildBackup(unknown, SCHEMA, ts, photos()))).toEqual({
      ok: false,
      error: 'unknownExercise',
    });
  });

  it('keeps cardio values and reads backups from before cardio (schema 5) as empty', () => {
    const current = validate(buildBackup(sample(), SCHEMA, ts, photos()));
    expect(current.ok && current.backup.data.set_log[1]).toMatchObject({
      durationSec: 1500,
      distanceM: 5200,
      level: 8,
      kcal: 310,
      heartRate: 142,
    });
    expect(current.ok && current.backup.data.workout_session[0]['bodyWeightKg']).toBe(75);

    const data = sample();
    for (const row of data.set_log) {
      for (const column of ['durationSec', 'distanceM', 'level', 'kcal', 'heartRate']) {
        delete row[column];
      }
    }
    delete data.workout_session[0]['bodyWeightKg'];
    delete data.plan_exercise[0]['targetDurationSec'];

    const result = validate(buildBackup(data, 5, ts, photos()));

    expect(result.ok).toBe(true);
    expect(result.ok && result.backup.data.set_log[0]['durationSec']).toBeNull();
    expect(result.ok && result.backup.data.workout_session[0]['bodyWeightKg']).toBeNull();
    expect(result.ok && result.backup.data.plan_exercise[0]['targetDurationSec']).toBeNull();
  });

  it('reads backups from before workout pauses (schema 4) without pauses', () => {
    const old = buildBackup(sample(), 4, ts, photos()) as unknown as {
      data: Record<string, unknown>;
    };
    delete old.data['workout_pause'];

    const result = validate(old);

    expect(result.ok).toBe(true);
    expect(result.ok && result.backup.data.workout_pause).toEqual([]);
    expect(result.ok && result.backup.data.exercise_setting).toHaveLength(1);
  });

  it('requires the pauses table in newer backups and checks its session', () => {
    const missing = buildBackup(sample(), SCHEMA, ts, photos()) as unknown as {
      data: Record<string, unknown>;
    };
    delete missing.data['workout_pause'];
    expect(validate(missing)).toEqual({ ok: false, error: 'format' });

    const orphan = sample();
    orphan.workout_pause[0]['sessionId'] = 'gone';
    expect(validate(buildBackup(orphan, SCHEMA, ts, photos()))).toEqual({
      ok: false,
      error: 'missingReference',
    });
  });

  it('needs the file of every live photo, but not of deleted ones', () => {
    expect(validate(buildBackup(sample(), SCHEMA, ts, {}))).toEqual({
      ok: false,
      error: 'missingReference',
    });
    expect(validate(buildBackup(sample(), SCHEMA, ts, { img1: 'not base64!' }))).toEqual({
      ok: false,
      error: 'missingReference',
    });
    const withoutImages = buildBackup(sample(), SCHEMA, ts) as unknown as { images?: unknown };
    delete withoutImages.images;
    expect(validate(withoutImages)).toEqual({ ok: false, error: 'format' });

    const result = validate(buildBackup(sample(), SCHEMA, ts, { ...photos(), stray: btoa('x') }));
    expect(result.ok && result.backup.images).toEqual(photos());
  });

  it('requires the notes tables in newer backups and checks their exercise', () => {
    const missing = buildBackup(sample(), SCHEMA, ts, photos()) as unknown as {
      data: Record<string, unknown>;
    };
    delete missing.data['exercise_note'];
    expect(validate(missing)).toEqual({ ok: false, error: 'format' });

    const unknown = sample();
    unknown.exercise_note[0]['exerciseId'] = 'gone';
    expect(validate(buildBackup(unknown, SCHEMA, ts, photos()))).toEqual({
      ok: false,
      error: 'unknownExercise',
    });

    const photo = sample();
    photo.exercise_note_image[0]['exerciseId'] = 'gone';
    expect(validate(buildBackup(photo, SCHEMA, ts, photos()))).toEqual({
      ok: false,
      error: 'unknownExercise',
    });
  });

  it('rejects values the app never writes', () => {
    const broken: [BackupTable, string, unknown][] = [
      ['plan', 'createdAt', '1.10.2026'],
      ['plan', 'deletedAt', '2026-10-01 10:00'],
      ['plan', 'name', ''],
      ['plan', 'weekdays', '[7]'],
      ['plan', 'weekdays', '[1,1]'],
      ['plan', 'weekdays', 'Montag'],
      ['plan_exercise', 'targetSets', 0],
      ['plan_exercise', 'repMin', 11],
      ['plan_exercise', 'restSeconds', 1.5],
      ['workout_session', 'status', 'paused'],
      ['session_exercise', 'status', 'skipped'],
      ['set_log', 'weightKg', -5],
      ['set_log', 'isExtra', 2],
      ['workout_pause', 'resumedAt', 'später'],
      ['exercise_note', 'text', 'x'.repeat(2001)],
      ['exercise_setting', 'weightStepKg', 3],
    ];
    for (const [table, column, value] of broken) {
      const data = sample();
      data[table][0][column] = value as never;
      expect(validate(buildBackup(data, SCHEMA, ts, photos())), `${table}.${column}`).toEqual({
        ok: false,
        error: 'invalidRow',
      });
    }
  });

  it('rejects what the database would refuse', () => {
    const duplicate = sample();
    duplicate.plan.push({ ...duplicate.plan[0] });
    expect(validate(buildBackup(duplicate, SCHEMA, ts, photos())).ok).toBe(false);

    const active = sample();
    const session = active.workout_session[0];
    active.workout_session = [
      { ...session, status: 'active', finishedAt: null },
      { ...session, id: 's2', status: 'active', finishedAt: null },
    ];
    expect(validate(buildBackup(active, SCHEMA, ts, photos()))).toEqual({
      ok: false,
      error: 'invalidRow',
    });

    const pauses = sample();
    pauses.workout_pause = [
      { ...base('wp1'), sessionId: 's1', pausedAt: ts, resumedAt: null },
      { ...base('wp2'), sessionId: 's1', pausedAt: ts, resumedAt: null },
    ];
    expect(validate(buildBackup(pauses, SCHEMA, ts, photos()))).toEqual({
      ok: false,
      error: 'invalidRow',
    });

    const notes = sample();
    notes.exercise_note.push({ ...base('n2'), exerciseId: 'e1', text: 'zweite' });
    expect(validate(buildBackup(notes, SCHEMA, ts, photos()))).toEqual({
      ok: false,
      error: 'invalidRow',
    });
    // A deleted second note is fine.
    notes.exercise_note[1]['deletedAt'] = ts;
    expect(validate(buildBackup(notes, SCHEMA, ts, photos())).ok).toBe(true);
  });

  it('allows workouts without a plan and drops unknown columns', () => {
    const data = sample() as unknown as Record<string, Record<string, unknown>[]>;
    data['workout_session'][0]['planId'] = null;
    data['plan'][0]['secret'] = 'x';
    const result = validate(buildBackup(data as never, SCHEMA, ts, photos()));
    expect(result.ok).toBe(true);
    expect(result.ok && result.backup.data.plan[0]).not.toHaveProperty('secret');
  });
});

describe('summarizeBackup', () => {
  it('counts live plans, finished workouts, notes and photos', () => {
    const data = sample();
    data.plan.push({ ...base('p2'), name: 'Alt', weekdays: '[]', deletedAt: ts });
    expect(summarizeBackup(buildBackup(data, SCHEMA, ts, photos()))).toEqual({
      exportedAt: ts,
      plans: 1,
      workouts: 1,
      notes: 1,
      photos: 1,
    });
  });
});

describe('backupFileName', () => {
  it('uses the local date and time', () => {
    expect(backupFileName(new Date(2026, 9, 1, 23, 5))).toBe('grynd-backup-2026-10-01-2305.json');
  });
});
