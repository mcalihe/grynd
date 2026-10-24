import { Migration } from '../migrations';

/**
 * One free-text note per exercise (machine settings, form tips), shared by all plans
 * (decision 0019). It is user data about the exercise, so sessions never copy it.
 */
export const migration002ExerciseNotes: Migration = {
  version: 2,
  statements: [
    `CREATE TABLE exercise_note (
      id TEXT PRIMARY KEY,
      exerciseId TEXT NOT NULL REFERENCES exercise (id),
      text TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      deletedAt TEXT
    )`,
    // At most one live note per exercise; a note added again after deleting gets a new row.
    `CREATE UNIQUE INDEX idx_exercise_note_exercise ON exercise_note (exerciseId)
      WHERE deletedAt IS NULL`,
  ],
};
