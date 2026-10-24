import { Migration } from '../migrations';

/**
 * Photos in the note of an exercise (decision 0021). Like the note they belong to the exercise,
 * not to a note row. Only metadata lives here; the JPEG files sit in the app's data directory
 * (NoteImageStore), so the database stays small.
 */
export const migration003NoteImages: Migration = {
  version: 3,
  statements: [
    `CREATE TABLE exercise_note_image (
      id TEXT PRIMARY KEY,
      exerciseId TEXT NOT NULL REFERENCES exercise (id),
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      deletedAt TEXT
    )`,
    `CREATE INDEX idx_exercise_note_image_exercise ON exercise_note_image (exerciseId)`,
  ],
};
