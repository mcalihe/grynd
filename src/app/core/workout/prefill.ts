export interface SetValues {
  weightKg: number | null;
  reps: number | null;
}

/**
 * Values for a new session's sets (plan.md §7 «Vorbefüllung»): taken position by position from
 * last time (the last finished session of the same plan with this exercise, else of any plan,
 * decision 0028); missing positions repeat its last set. Without any history the weight stays
 * empty and reps start at the plan minimum.
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

/**
 * Last time's sets for the `occurrence`-th entry of an exercise in a plan (decision 0028).
 * `rows` are the completed sets of the exercise in the workout prefill reads from; grouped by
 * session exercise in creation order (UUIDv7), the n-th entry takes the n-th group, else the last.
 * So an exercise that appears twice (e.g. heavy and back-off) keeps its two sets of values apart.
 */
export function previousForOccurrence<T extends { sessionExerciseId: string }>(
  rows: readonly T[],
  occurrence: number,
): T[] {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    groups.set(row.sessionExerciseId, [...(groups.get(row.sessionExerciseId) ?? []), row]);
  }
  const ordered = [...groups.keys()].sort().map((id) => groups.get(id)!);
  return ordered[Math.min(occurrence, ordered.length - 1)] ?? [];
}

/** What a cardio entry carries over (decision 0025); calories and heart rate never do. */
export interface CardioValues {
  durationSec: number | null;
  distanceM: number | null;
  level: number | null;
}

/**
 * Values for a new session's cardio entries (decision 0025): the duration from the plan's target,
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
