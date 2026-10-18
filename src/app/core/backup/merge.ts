import { Backup, BackupRow, BackupTable, BACKUP_TABLE_NAMES, buildBackup } from './backup';

/** Tables with at most one live row per exercise (partial unique indexes, migrations 2 and 4). */
const ONE_PER_EXERCISE: readonly BackupTable[] = ['exercise_note', 'exercise_setting'];

const newer = (a: BackupRow, b: BackupRow) =>
  (a['updatedAt'] as string) > (b['updatedAt'] as string);

/**
 * Merges a backup into the data on this device (decision 0024). Rows are matched by id, which is
 * a UUIDv7 made on the device that created the row, so the same plan or workout from two devices
 * is one row. Per row the newer `updatedAt` wins (ties keep the device's row); soft deletes
 * travel like any other change. Nothing is ever dropped, so references stay intact.
 *
 * Three rules keep the database's unique indexes: of two live notes or weight steps for the same
 * exercise, or of two open pauses of the same workout, the newer one stays and the other is
 * deleted; of two active workouts the one on this device stays active while the incoming one is
 * stored as aborted.
 */
export function mergeBackups(local: Backup, incoming: Backup, now: string): Backup {
  const data = {} as Record<BackupTable, BackupRow[]>;
  const fromIncoming = new Set<string>();
  for (const table of BACKUP_TABLE_NAMES) {
    const rows = new Map(local.data[table].map((row) => [row['id'] as string, row]));
    for (const row of incoming.data[table]) {
      const id = row['id'] as string;
      const existing = rows.get(id);
      if (!existing || newer(row, existing)) {
        rows.set(id, row);
        fromIncoming.add(`${table}:${id}`);
      }
    }
    data[table] = [...rows.values()];
  }

  const isLive = (row: BackupRow) => row['deletedAt'] === null;
  const changed = (row: BackupRow, patch: BackupRow): BackupRow => ({
    ...row,
    ...patch,
    updatedAt: now,
  });

  /** Of several live rows with the same key, the newest stays and the others are deleted. */
  const keepNewest = (table: BackupTable, key: (row: BackupRow) => string | null) => {
    const winners = new Map<string, BackupRow>();
    for (const row of data[table].filter(isLive)) {
      const k = key(row);
      const current = k === null ? undefined : winners.get(k);
      if (k !== null && (!current || newer(row, current))) {
        winners.set(k, row);
      }
    }
    data[table] = data[table].map((row) => {
      const k = key(row);
      return isLive(row) && k !== null && winners.get(k) !== row
        ? changed(row, { deletedAt: now })
        : row;
    });
  };
  for (const table of ONE_PER_EXERCISE) {
    keepNewest(table, (row) => row['exerciseId'] as string);
  }
  // A workout is paused at most once at a time (migration 5).
  keepNewest('workout_pause', (row) =>
    row['resumedAt'] === null ? (row['sessionId'] as string) : null,
  );

  const active = data.workout_session.filter((row) => isLive(row) && row['status'] === 'active');
  if (active.length > 1) {
    const keep =
      active.find((row) => !fromIncoming.has(`workout_session:${row['id']}`)) ?? active[0];
    data.workout_session = data.workout_session.map((row) =>
      active.includes(row) && row !== keep ? changed(row, { status: 'aborted' }) : row,
    );
  }

  // Same id, same photo: take the file from whichever side has it.
  const images: Record<string, string> = {};
  for (const row of data.exercise_note_image.filter(isLive)) {
    const id = row['id'] as string;
    const file = incoming.images[id] ?? local.images[id];
    if (file !== undefined) {
      images[id] = file;
    }
  }

  return buildBackup(data, Math.max(local.schemaVersion, incoming.schemaVersion), now, images);
}
