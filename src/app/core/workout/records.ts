/** Estimated one-rep max after Epley: kg × (1 + reps / 30); null without weight or reps. */
export function estimatedOneRepMax(weightKg: number | null, reps: number | null): number | null {
  if (!weightKg || !reps || weightKg <= 0 || reps <= 0) {
    return null;
  }
  return weightKg * (1 + reps / 30);
}

export interface CompletedSet {
  id: string;
  weightKg: number | null;
  reps: number | null;
}

/**
 * Ids of record sets (plan.md §7 «Rekord»), for sets in the order they were completed. A set is a
 * record when its e1RM beats everything before it: the best of earlier sessions (`historyBest`) and
 * the earlier sets of this session. Without any baseline there is nothing to beat, so the very first
 * set of an exercise is never a record; equal values are not a record either.
 */
export function recordSetIds(
  completedInOrder: readonly CompletedSet[],
  historyBest: number | null,
): Set<string> {
  const records = new Set<string>();
  let best = historyBest;
  for (const set of completedInOrder) {
    const e1rm = estimatedOneRepMax(set.weightKg, set.reps);
    if (e1rm === null) {
      continue;
    }
    if (best !== null && e1rm > best + 1e-9) {
      records.add(set.id);
    }
    best = best === null ? e1rm : Math.max(best, e1rm);
  }
  return records;
}
