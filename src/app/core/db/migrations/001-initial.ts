import { Migration } from '../migrations';

/** Every table carries id (UUIDv7), createdAt, updatedAt, deletedAt (soft delete) – see plan.md §6. */
const timestamps = `
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  deletedAt TEXT`;

export const migration001Initial: Migration = {
  version: 1,
  statements: [
    `CREATE TABLE meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )`,

    // Catalog shipped with the app (free-exercise-db); read-only for users.
    `CREATE TABLE exercise (
      id TEXT PRIMARY KEY,
      key TEXT NOT NULL UNIQUE,
      nameDe TEXT NOT NULL,
      nameEn TEXT NOT NULL,
      primaryMuscles TEXT NOT NULL DEFAULT '[]',
      secondaryMuscles TEXT NOT NULL DEFAULT '[]',
      muscleGroup TEXT,
      force TEXT,
      equipment TEXT,
      level TEXT,
      category TEXT,
      images TEXT NOT NULL DEFAULT '[]',${timestamps}
    )`,

    `CREATE TABLE plan (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      weekdays TEXT NOT NULL DEFAULT '[]',${timestamps}
    )`,

    `CREATE TABLE plan_exercise (
      id TEXT PRIMARY KEY,
      planId TEXT NOT NULL REFERENCES plan (id),
      exerciseId TEXT NOT NULL REFERENCES exercise (id),
      position INTEGER NOT NULL,
      targetSets INTEGER NOT NULL DEFAULT 3,
      repMin INTEGER NOT NULL DEFAULT 8,
      repMax INTEGER NOT NULL DEFAULT 12,
      restSeconds INTEGER NOT NULL DEFAULT 90,${timestamps}
    )`,
    `CREATE INDEX idx_plan_exercise_plan ON plan_exercise (planId, position)`,

    `CREATE TABLE workout_session (
      id TEXT PRIMARY KEY,
      planId TEXT REFERENCES plan (id),
      startedAt TEXT NOT NULL,
      finishedAt TEXT,
      status TEXT NOT NULL CHECK (status IN ('active', 'finished', 'aborted')),${timestamps}
    )`,
    // At most one active session.
    `CREATE UNIQUE INDEX idx_workout_session_one_active ON workout_session (status)
      WHERE status = 'active' AND deletedAt IS NULL`,
    `CREATE INDEX idx_workout_session_started ON workout_session (startedAt)`,

    // Copy of the plan exercise at session start, incl. targets, so plan edits never change a session.
    `CREATE TABLE session_exercise (
      id TEXT PRIMARY KEY,
      sessionId TEXT NOT NULL REFERENCES workout_session (id),
      exerciseId TEXT NOT NULL REFERENCES exercise (id),
      position INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done')),
      repMin INTEGER,
      repMax INTEGER,
      restSeconds INTEGER,${timestamps}
    )`,
    `CREATE INDEX idx_session_exercise_session ON session_exercise (sessionId, position)`,
    `CREATE INDEX idx_session_exercise_exercise ON session_exercise (exerciseId)`,

    `CREATE TABLE exercise_interval (
      id TEXT PRIMARY KEY,
      sessionExerciseId TEXT NOT NULL REFERENCES session_exercise (id),
      enteredAt TEXT NOT NULL,
      leftAt TEXT,${timestamps}
    )`,
    `CREATE INDEX idx_exercise_interval_session_exercise ON exercise_interval (sessionExerciseId)`,

    `CREATE TABLE set_log (
      id TEXT PRIMARY KEY,
      sessionExerciseId TEXT NOT NULL REFERENCES session_exercise (id),
      position INTEGER NOT NULL,
      weightKg REAL,
      reps INTEGER,
      completedAt TEXT,
      isExtra INTEGER NOT NULL DEFAULT 0,${timestamps}
    )`,
    `CREATE INDEX idx_set_log_session_exercise ON set_log (sessionExerciseId, position)`,
  ],
};
