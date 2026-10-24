import { Migration } from '../migrations';

/**
 * Pauses of a workout (decision 0023): from `pausedAt` until `resumedAt` (null while paused).
 * The workout duration leaves them out; stored as timestamps, never as a counter.
 */
export const migration005WorkoutPauses: Migration = {
  version: 5,
  statements: [
    `CREATE TABLE workout_pause (
      id TEXT PRIMARY KEY,
      sessionId TEXT NOT NULL REFERENCES workout_session (id),
      pausedAt TEXT NOT NULL,
      resumedAt TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      deletedAt TEXT
    )`,
    `CREATE INDEX idx_workout_pause_session ON workout_pause (sessionId, pausedAt)`,
    // A session is paused at most once at a time.
    `CREATE UNIQUE INDEX idx_workout_pause_one_open ON workout_pause (sessionId)
      WHERE resumedAt IS NULL AND deletedAt IS NULL`,
  ],
};
