import { Migration } from '../migrations';

/**
 * The user's settings per exercise, shared by all plans (decision 0022). For now the weight step
 * of the stepper, separately for kg and lb (null = default). Like notes, sessions never copy it.
 */
export const migration004ExerciseSettings: Migration = {
  version: 4,
  statements: [
    `CREATE TABLE exercise_setting (
      id TEXT PRIMARY KEY,
      exerciseId TEXT NOT NULL REFERENCES exercise (id),
      weightStepKg REAL,
      weightStepLb REAL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      deletedAt TEXT
    )`,
    `CREATE UNIQUE INDEX idx_exercise_setting_exercise ON exercise_setting (exerciseId)
      WHERE deletedAt IS NULL`,
  ],
};
