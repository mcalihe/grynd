import { Migration } from '../migrations';

/**
 * Cardio entries and calorie estimates (decision 0025). Only nullable columns, so older rows and
 * backups stay valid: a cardio entry is a `set_log` row with a duration instead of kg × reps,
 * a cardio exercise in a plan has a target duration, and a workout keeps the body weight it
 * started with.
 */
export const migration006Cardio: Migration = {
  version: 6,
  statements: [
    `ALTER TABLE set_log ADD COLUMN durationSec INTEGER`,
    `ALTER TABLE set_log ADD COLUMN distanceM REAL`,
    `ALTER TABLE set_log ADD COLUMN level REAL`,
    `ALTER TABLE set_log ADD COLUMN kcal INTEGER`,
    `ALTER TABLE set_log ADD COLUMN heartRate INTEGER`,
    `ALTER TABLE plan_exercise ADD COLUMN targetDurationSec INTEGER`,
    `ALTER TABLE session_exercise ADD COLUMN targetDurationSec INTEGER`,
    `ALTER TABLE workout_session ADD COLUMN bodyWeightKg REAL`,
  ],
};
