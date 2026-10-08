/**
 * JSON backup of the user's data (decision 0013). The exercise catalog ships with the app and is
 * not part of a backup; rows only reference it by id.
 */

type SqlRowValue = string | number | null;
export type BackupRow = Record<string, SqlRowValue>;

const BASE = ['id', 'createdAt', 'updatedAt', 'deletedAt'] as const;

interface TableSpec {
  /** Every column that is written back, in addition to BASE. */
  columns: readonly string[];
  /** Columns that must not be null (besides id, createdAt, updatedAt). */
  required: readonly string[];
  /** Schema version that added the table; older backups may lack it (read as empty). */
  since?: number;
}

/** User tables in insert order (parents first); deleting goes in reverse. */
export const BACKUP_TABLES = {
  plan: { columns: ['name', 'weekdays'], required: ['name', 'weekdays'] },
  plan_exercise: {
    columns: ['planId', 'exerciseId', 'position', 'targetSets', 'repMin', 'repMax', 'restSeconds'],
    required: ['planId', 'exerciseId', 'position', 'targetSets', 'repMin', 'repMax', 'restSeconds'],
  },
  workout_session: {
    columns: ['planId', 'startedAt', 'finishedAt', 'status'],
    required: ['startedAt', 'status'],
  },
  session_exercise: {
    columns: ['sessionId', 'exerciseId', 'position', 'status', 'repMin', 'repMax', 'restSeconds'],
    required: ['sessionId', 'exerciseId', 'position', 'status'],
  },
  exercise_interval: {
    columns: ['sessionExerciseId', 'enteredAt', 'leftAt'],
    required: ['sessionExerciseId', 'enteredAt'],
  },
  set_log: {
    columns: ['sessionExerciseId', 'position', 'weightKg', 'reps', 'completedAt', 'isExtra'],
    required: ['sessionExerciseId', 'position', 'isExtra'],
  },
  exercise_note: { columns: ['exerciseId', 'text'], required: ['exerciseId', 'text'], since: 2 },
} as const satisfies Record<string, TableSpec>;

export type BackupTable = keyof typeof BACKUP_TABLES;
export const BACKUP_TABLE_NAMES = Object.keys(BACKUP_TABLES) as BackupTable[];

export function tableColumns(table: BackupTable): string[] {
  return [...BASE, ...BACKUP_TABLES[table].columns];
}

export interface Backup {
  app: 'grynd';
  schemaVersion: number;
  exportedAt: string;
  data: Record<BackupTable, BackupRow[]>;
}

export type BackupError = 'format' | 'newerSchema' | 'invalidRow' | 'missingReference';

export type BackupResult = { ok: true; backup: Backup } | { ok: false; error: BackupError };

export function buildBackup(
  data: Record<BackupTable, BackupRow[]>,
  schemaVersion: number,
  exportedAt: string,
): Backup {
  return { app: 'grynd', schemaVersion, exportedAt, data };
}

/** `grynd-backup-2026-10-01.json` in local time. */
export function backupFileName(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `grynd-backup-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.json`;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Copies the known columns of a row; null when a value has the wrong type or is missing. */
function cleanRow(table: BackupTable, raw: unknown): BackupRow | null {
  if (!isObject(raw)) {
    return null;
  }
  const required = new Set<string>([
    'id',
    'createdAt',
    'updatedAt',
    ...BACKUP_TABLES[table].required,
  ]);
  const row: BackupRow = {};
  for (const column of tableColumns(table)) {
    const value = raw[column] ?? null;
    if (value !== null && typeof value !== 'string' && typeof value !== 'number') {
      return null;
    }
    if (value === null && required.has(column)) {
      return null;
    }
    row[column] = value;
  }
  return typeof row['id'] === 'string' ? row : null;
}

/**
 * Checks a parsed backup file: our app, a schema this version can read, every table present,
 * valid rows and intact references (including exercises in the bundled catalog).
 */
export function validateBackup(
  raw: unknown,
  currentSchema: number,
  exerciseIds: ReadonlySet<string>,
): BackupResult {
  if (!isObject(raw) || raw['app'] !== 'grynd' || !isObject(raw['data'])) {
    return { ok: false, error: 'format' };
  }
  const schemaVersion = raw['schemaVersion'];
  if (typeof schemaVersion !== 'number' || !Number.isInteger(schemaVersion) || schemaVersion < 1) {
    return { ok: false, error: 'format' };
  }
  if (schemaVersion > currentSchema) {
    return { ok: false, error: 'newerSchema' };
  }
  const rawData = raw['data'];
  const data = {} as Record<BackupTable, BackupRow[]>;
  for (const table of BACKUP_TABLE_NAMES) {
    const since: number | undefined = (BACKUP_TABLES[table] as TableSpec).since;
    const rows = rawData[table] ?? (since && schemaVersion < since ? [] : undefined);
    if (!Array.isArray(rows)) {
      return { ok: false, error: 'format' };
    }
    const cleaned = rows.map((row) => cleanRow(table, row));
    if (cleaned.some((row) => row === null)) {
      return { ok: false, error: 'invalidRow' };
    }
    data[table] = cleaned as BackupRow[];
  }

  const ids = (table: BackupTable) => new Set(data[table].map((row) => row['id']));
  const plans = ids('plan');
  const sessions = ids('workout_session');
  const sessionExercises = ids('session_exercise');
  const refs: [BackupTable, string, ReadonlySet<SqlRowValue>, boolean][] = [
    ['plan_exercise', 'planId', plans, false],
    ['plan_exercise', 'exerciseId', exerciseIds, false],
    ['workout_session', 'planId', plans, true],
    ['session_exercise', 'sessionId', sessions, false],
    ['session_exercise', 'exerciseId', exerciseIds, false],
    ['exercise_interval', 'sessionExerciseId', sessionExercises, false],
    ['set_log', 'sessionExerciseId', sessionExercises, false],
    ['exercise_note', 'exerciseId', exerciseIds, false],
  ];
  for (const [table, column, known, nullable] of refs) {
    for (const row of data[table]) {
      const value = row[column];
      if (!(nullable && value === null) && !known.has(value as string)) {
        return { ok: false, error: 'missingReference' };
      }
    }
  }

  const exportedAt = typeof raw['exportedAt'] === 'string' ? raw['exportedAt'] : '';
  return { ok: true, backup: { app: 'grynd', schemaVersion, exportedAt, data } };
}
