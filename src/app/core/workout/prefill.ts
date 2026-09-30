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
