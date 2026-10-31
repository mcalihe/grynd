export interface SetValues {
  weightKg: number | null;
  reps: number | null;
}

/**
 * Values for a new session's sets (plan.md §7 «Vorbefüllung»): taken position by position from the
 * last finished session with this exercise; missing positions repeat its last set. Without any
 * history the weight stays empty and reps start at the plan minimum.
 */
export function prefillSets(
  targetSets: number,
  repMin: number | null,
  previous: readonly SetValues[],
): SetValues[] {
  return Array.from({ length: targetSets }, (_, i) => {
    const source = previous[Math.min(i, previous.length - 1)];
    return source
      ? { weightKg: source.weightKg, reps: source.reps ?? repMin }
      : { weightKg: null, reps: repMin };
  });
}

/** What a cardio entry carries over (decision 0024); calories and heart rate never do. */
export interface CardioValues {
  durationSec: number | null;
  distanceM: number | null;
  level: number | null;
}

/**
 * Values for a new session's cardio entries (decision 0024): the duration from the plan's target,
 * else from last time; distance and level from the last finished session, position by position
 * like sets.
 */
export function prefillCardio(
  entries: number,
  targetDurationSec: number | null,
  previous: readonly CardioValues[],
): CardioValues[] {
  return Array.from({ length: entries }, (_, i) => {
    const source = previous[Math.min(i, previous.length - 1)];
    return {
      durationSec: targetDurationSec ?? source?.durationSec ?? null,
      distanceM: source?.distanceM ?? null,
      level: source?.level ?? null,
    };
  });
}
