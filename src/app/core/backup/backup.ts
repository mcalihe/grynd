/**
 * JSON backup of the user's data (decisions 0013, 0027). The exercise catalog ships with the app
 * and is not part of a backup; rows only reference it by id.
 */
import { NOTE_MAX_IMAGES } from '../exercises/note-image';
import { WEIGHT_STEPS } from '../units/weight';

type SqlRowValue = string | number | null;
export type BackupRow = Record<string, SqlRowValue>;

type Check = (value: string | number) => boolean;

interface Column {
  check: Check;
  nullable?: boolean;
}

/**
 * Checks are as strict as what the app itself writes, but no stricter than the database:
 * limits that only the UI enforces (e.g. 20 sets in the editor) get generous bounds, so a
 * backup of older data is never refused.
 */
const ISO_UTC = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d{1,3})?Z$/;
const timestamp: Check = (v) => typeof v === 'string' && ISO_UTC.test(v) && !isNaN(Date.parse(v));
const text =
  (min: number, max: number): Check =>
  (v) =>
    typeof v === 'string' && v.length >= min && v.length <= max;
const int =
  (min: number, max: number): Check =>
  (v) =>
    Number.isInteger(v) && (v as number) >= min && (v as number) <= max;
const decimal =
  (min: number, max: number): Check =>
  (v) =>
    typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const oneOf =
  (...values: readonly (string | number)[]): Check =>
  (v) =>
    values.includes(v);
const weekdays: Check = (v) => {
  try {
    const days: unknown = typeof v === 'string' ? JSON.parse(v) : null;
    return (
      Array.isArray(days) &&
      days.every((d) => Number.isInteger(d) && d >= 0 && d <= 6) &&
      new Set(days).size === days.length
    );
  } catch {
    return false;
  }
};

const id = text(1, 64);
const required = (check: Check): Column => ({ check });
const optional = (check: Check): Column => ({ check, nullable: true });

const BASE = {
  id: required(id),
  createdAt: required(timestamp),
  updatedAt: required(timestamp),
  deletedAt: optional(timestamp),
};

/** Note texts are cut to this length when saved (NOTE_MAX_LENGTH, with room to grow). */
const NOTE_TEXT_MAX = 2000;

interface TableSpec {
  /** Every column that is written back, in addition to BASE. */
  columns: Record<string, Column>;
  /**
   * Schema version that added the table; older backups may lack it (read as empty). Columns added
   * later (e.g. the cardio columns of schema 6) are optional and read as null when missing.
   */
  since?: number;
}

/** User tables in insert order (parents first); deleting goes in reverse. */
export const BACKUP_TABLES = {
  plan: { columns: { name: required(text(1, 200)), weekdays: required(weekdays) } },
  plan_exercise: {
    columns: {
      planId: required(id),
      exerciseId: required(id),
      position: required(int(0, 9999)),
      targetSets: required(int(1, 99)),
      repMin: required(int(1, 999)),
      repMax: required(int(1, 999)),
      restSeconds: required(int(0, 3600)),
      targetDurationSec: optional(int(0, 1_000_000)),
    },
  },
  workout_session: {
    columns: {
      planId: optional(id),
      startedAt: required(timestamp),
      finishedAt: optional(timestamp),
      status: required(oneOf('active', 'finished', 'aborted')),
      bodyWeightKg: optional(decimal(0, 1000)),
    },
  },
  workout_pause: {
    columns: {
      sessionId: required(id),
      pausedAt: required(timestamp),
      resumedAt: optional(timestamp),
    },
    since: 5,
  },
  session_exercise: {
    columns: {
      sessionId: required(id),
      exerciseId: required(id),
      position: required(int(0, 9999)),
      status: required(oneOf('open', 'done')),
      repMin: optional(int(1, 999)),
      repMax: optional(int(1, 999)),
      restSeconds: optional(int(0, 3600)),
      targetDurationSec: optional(int(0, 1_000_000)),
    },
  },
  exercise_interval: {
    columns: {
      sessionExerciseId: required(id),
      enteredAt: required(timestamp),
      leftAt: optional(timestamp),
    },
  },
  set_log: {
    columns: {
      sessionExerciseId: required(id),
      position: required(int(0, 9999)),
      weightKg: optional(decimal(0, 10000)),
      reps: optional(int(0, 9999)),
      durationSec: optional(int(0, 1_000_000)),
      distanceM: optional(decimal(0, 10_000_000)),
      level: optional(decimal(0, 10_000)),
      kcal: optional(int(0, 100_000)),
      heartRate: optional(int(0, 400)),
      completedAt: optional(timestamp),
      isExtra: required(oneOf(0, 1)),
    },
  },
  exercise_note: {
    columns: { exerciseId: required(id), text: required(text(1, NOTE_TEXT_MAX)) },
    since: 2,
  },
  exercise_note_image: { columns: { exerciseId: required(id) }, since: 3 },
  exercise_setting: {
    columns: {
      exerciseId: required(id),
      weightStepKg: optional(oneOf(...WEIGHT_STEPS.kg)),
      weightStepLb: optional(oneOf(...WEIGHT_STEPS.lb)),
    },
    since: 4,
  },
} as const satisfies Record<string, TableSpec>;

export type BackupTable = keyof typeof BACKUP_TABLES;
export const BACKUP_TABLE_NAMES = Object.keys(BACKUP_TABLES) as BackupTable[];

function tableSpec(table: BackupTable): Record<string, Column> {
  return { ...BASE, ...BACKUP_TABLES[table].columns };
}

export function tableColumns(table: BackupTable): string[] {
  return Object.keys(tableSpec(table));
}

export interface Backup {
  app: 'grynd';
  schemaVersion: number;
  exportedAt: string;
  data: Record<BackupTable, BackupRow[]>;
  /** Photo files of exercise notes (decision 0021): image id → JPEG as base64, live rows only. */
  images: Record<string, string>;
}

export type BackupError =
  'format' | 'newerSchema' | 'invalidRow' | 'missingReference' | 'unknownExercise' | 'tooLarge';

export type BackupResult = { ok: true; backup: Backup } | { ok: false; error: BackupError };

/** Larger files are refused before reading them (a backup with photos is a few MB). */
export const MAX_IMPORT_BYTES = 200 * 1024 * 1024;
/** A stored photo is about 0.3 MB; this leaves plenty of room and stops absurd files. */
const MAX_IMAGE_BASE64 = 7_000_000;

export function buildBackup(
  data: Record<BackupTable, BackupRow[]>,
  schemaVersion: number,
  exportedAt: string,
  images: Record<string, string> = {},
): Backup {
  return { app: 'grynd', schemaVersion, exportedAt, data, images };
}

/** `grynd-backup-2026-10-01-0930.json` in local time. */
export function backupFileName(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return `grynd-backup-${day}-${pad(date.getHours())}${pad(date.getMinutes())}.json`;
}

/** What the confirm dialog tells about a backup before it is restored. */
export interface BackupSummary {
  exportedAt: string;
  plans: number;
  workouts: number;
  notes: number;
  photos: number;
}

export function summarizeBackup(backup: Backup): BackupSummary {
  const live = (table: BackupTable) =>
    backup.data[table].filter((row) => row['deletedAt'] === null);
  return {
    exportedAt: backup.exportedAt,
    plans: live('plan').length,
    workouts: live('workout_session').filter((row) => row['status'] === 'finished').length,
    notes: live('exercise_note').length,
    photos: live('exercise_note_image').length,
  };
}

export const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;
export const isBase64 = (value: unknown): value is string =>
  typeof value === 'string' &&
  value.length % 4 === 0 &&
  value.length <= MAX_IMAGE_BASE64 &&
  BASE64.test(value);

/** Copies the known columns of a row; null when a value is missing or not allowed. */
function cleanRow(table: BackupTable, raw: unknown): BackupRow | null {
  if (!isObject(raw)) {
    return null;
  }
  const row: BackupRow = {};
  for (const [column, spec] of Object.entries(tableSpec(table))) {
    const value = raw[column] ?? null;
    if (value === null ? !spec.nullable : !spec.check(value as string | number)) {
      return null;
    }
    row[column] = value as SqlRowValue;
  }
  const { repMin, repMax } = row;
  return typeof repMin === 'number' && typeof repMax === 'number' && repMin > repMax ? null : row;
}

/** Rows that would break a unique index of the database, or our own limits per exercise. */
function breaksUniqueness(data: Record<BackupTable, BackupRow[]>): boolean {
  for (const table of BACKUP_TABLE_NAMES) {
    if (new Set(data[table].map((row) => row['id'])).size !== data[table].length) {
      return true;
    }
  }
  const live = (table: BackupTable) => data[table].filter((row) => row['deletedAt'] === null);
  const perExercise = (table: BackupTable) => {
    const counts = new Map<SqlRowValue, number>();
    for (const row of live(table)) {
      counts.set(row['exerciseId'], (counts.get(row['exerciseId']) ?? 0) + 1);
    }
    return Math.max(0, ...counts.values());
  };
  const openPauses = live('workout_pause').filter((row) => row['resumedAt'] === null);
  return (
    live('workout_session').filter((row) => row['status'] === 'active').length > 1 ||
    new Set(openPauses.map((row) => row['sessionId'])).size !== openPauses.length ||
    perExercise('exercise_note') > 1 ||
    perExercise('exercise_setting') > 1 ||
    perExercise('exercise_note_image') > NOTE_MAX_IMAGES
  );
}

/**
 * Checks a parsed backup file: our app, a schema this version can read, every table present,
 * valid rows, nothing the database would refuse, and intact references (including exercises
 * in the bundled catalog).
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
  if (breaksUniqueness(data)) {
    return { ok: false, error: 'invalidRow' };
  }

  const ids = (table: BackupTable) => new Set(data[table].map((row) => row['id']));
  const plans = ids('plan');
  const sessions = ids('workout_session');
  const sessionExercises = ids('session_exercise');
  const refs: [BackupTable, string, ReadonlySet<SqlRowValue>, boolean][] = [
    ['plan_exercise', 'planId', plans, false],
    ['workout_session', 'planId', plans, true],
    ['workout_pause', 'sessionId', sessions, false],
    ['session_exercise', 'sessionId', sessions, false],
    ['exercise_interval', 'sessionExerciseId', sessionExercises, false],
    ['set_log', 'sessionExerciseId', sessionExercises, false],
  ];
  for (const [table, column, known, nullable] of refs) {
    for (const row of data[table]) {
      const value = row[column];
      if (!(nullable && value === null) && !known.has(value as string)) {
        return { ok: false, error: 'missingReference' };
      }
    }
  }
  // An exercise this catalog lacks means the backup comes from a newer app version.
  const exerciseTables: BackupTable[] = [
    'plan_exercise',
    'session_exercise',
    'exercise_note',
    'exercise_note_image',
    'exercise_setting',
  ];
  for (const table of exerciseTables) {
    if (data[table].some((row) => !exerciseIds.has(row['exerciseId'] as string))) {
      return { ok: false, error: 'unknownExercise' };
    }
  }

  // Every live photo needs its file; extra entries are ignored.
  const rawImages =
    raw['images'] ?? (schemaVersion < BACKUP_TABLES.exercise_note_image.since ? {} : undefined);
  if (!isObject(rawImages)) {
    return { ok: false, error: 'format' };
  }
  const images: Record<string, string> = {};
  for (const row of data.exercise_note_image) {
    if (row['deletedAt'] !== null) {
      continue;
    }
    const imageId = row['id'] as string;
    const file = rawImages[imageId];
    if (!isBase64(file)) {
      return { ok: false, error: 'missingReference' };
    }
    images[imageId] = file;
  }

  const exportedAt = typeof raw['exportedAt'] === 'string' ? raw['exportedAt'] : '';
  return { ok: true, backup: { app: 'grynd', schemaVersion, exportedAt, data, images } };
}
