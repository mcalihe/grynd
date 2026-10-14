import { Backup, BackupRow, BackupTable, BACKUP_TABLE_NAMES, buildBackup } from './backup';
import { mergeBackups } from './merge';

const t1 = '2026-10-01T10:00:00.000Z';
const t2 = '2026-10-02T10:00:00.000Z';
const now = '2026-10-14T12:00:00.000Z';
const row = (id: string, updatedAt: string, extra: BackupRow = {}): BackupRow => ({
  id,
  createdAt: t1,
  updatedAt,
  deletedAt: null,
  ...extra,
});

function backup(
  tables: Partial<Record<BackupTable, BackupRow[]>>,
  images: Record<string, string> = {},
): Backup {
  const data = Object.fromEntries(
    BACKUP_TABLE_NAMES.map((table) => [table, tables[table] ?? []]),
  ) as Record<BackupTable, BackupRow[]>;
  return buildBackup(data, 4, t1, images);
}

const byId = (rows: BackupRow[]) => Object.fromEntries(rows.map((r) => [r['id'], r]));

describe('mergeBackups', () => {
  it('keeps rows from both sides and lets the newer change win', () => {
    const local = backup({
      plan: [
        row('only-here', t1, { name: 'Hier' }),
        row('both-a', t2, { name: 'Neu hier' }),
        row('both-b', t1, { name: 'Alt hier' }),
        row('tie', t1, { name: 'Gleich hier' }),
      ],
    });
    const incoming = backup({
      plan: [
        row('only-there', t1, { name: 'Dort' }),
        row('both-a', t1, { name: 'Alt dort' }),
        row('both-b', t2, { name: 'Neu dort' }),
        row('tie', t1, { name: 'Gleich dort' }),
      ],
    });

    const plans = byId(mergeBackups(local, incoming, now).data.plan);

    expect(Object.keys(plans).sort()).toEqual([
      'both-a',
      'both-b',
      'only-here',
      'only-there',
      'tie',
    ]);
    expect(plans['both-a']['name']).toBe('Neu hier');
    expect(plans['both-b']['name']).toBe('Neu dort');
    expect(plans['tie']['name']).toBe('Gleich hier');
  });

  it('carries newer soft deletes both ways', () => {
    const local = backup({ plan: [row('p1', t2, { deletedAt: t2 }), row('p2', t1)] });
    const incoming = backup({ plan: [row('p1', t1), row('p2', t2, { deletedAt: t2 })] });

    const plans = byId(mergeBackups(local, incoming, now).data.plan);

    expect(plans['p1']['deletedAt']).toBe(t2);
    expect(plans['p2']['deletedAt']).toBe(t2);
  });

  it('keeps one live note and weight step per exercise: the newer one', () => {
    const local = backup({
      exercise_note: [row('n-here', t2, { exerciseId: 'e1', text: 'hier' })],
      exercise_setting: [row('s-here', t1, { exerciseId: 'e1', weightStepKg: 2 })],
    });
    const incoming = backup({
      exercise_note: [row('n-there', t1, { exerciseId: 'e1', text: 'dort' })],
      exercise_setting: [row('s-there', t2, { exerciseId: 'e1', weightStepKg: 5 })],
    });

    const merged = mergeBackups(local, incoming, now).data;
    const notes = byId(merged.exercise_note);
    const settings = byId(merged.exercise_setting);

    expect(notes['n-here']['deletedAt']).toBeNull();
    expect(notes['n-there']).toMatchObject({ deletedAt: now, updatedAt: now });
    expect(settings['s-there']['deletedAt']).toBeNull();
    expect(settings['s-here']['deletedAt']).toBe(now);
  });

  it('keeps the workout running here active and stores the incoming one as aborted', () => {
    const session = { planId: null, startedAt: t1, finishedAt: null, status: 'active' };
    const local = backup({ workout_session: [row('here', t1, session)] });
    const incoming = backup({ workout_session: [row('there', t2, session)] });

    const sessions = byId(mergeBackups(local, incoming, now).data.workout_session);

    expect(sessions['here']['status']).toBe('active');
    expect(sessions['there']['status']).toBe('aborted');

    // Without a running workout here, the incoming one goes on.
    const continued = mergeBackups(backup({}), incoming, now).data.workout_session;
    expect(continued[0]['status']).toBe('active');
  });

  it('takes photo files from either side, only for live photos', () => {
    const local = backup(
      { exercise_note_image: [row('img-here', t1, { exerciseId: 'e1' })] },
      { 'img-here': 'aGllcg==' },
    );
    const incoming = backup(
      {
        exercise_note_image: [
          row('img-there', t1, { exerciseId: 'e1' }),
          row('img-here', t2, { exerciseId: 'e1', deletedAt: t2 }),
        ],
      },
      { 'img-there': 'ZG9ydA==' },
    );

    expect(mergeBackups(local, incoming, now).images).toEqual({ 'img-there': 'ZG9ydA==' });
    expect(mergeBackups(local, backup({}), now).images).toEqual({ 'img-here': 'aGllcg==' });
  });
});
