/**
 * The plan exercise a session exercise was copied from (decision 0026). Sessions keep no link to
 * the plan rows, but they are copied in plan order and their UUIDv7 ids grow with creation, so
 * the n-th session entry of an exercise (by id) belongs to the n-th plan row of that exercise (by
 * position). If the plan changed since the start and the n-th row is gone, a single row of that
 * exercise still matches; otherwise there is none.
 */
export function planExerciseFor<T extends { exerciseId: string }>(
  entries: readonly { id: string; exerciseId: string }[],
  entryId: string,
  planExercises: readonly T[],
): T | null {
  const entry = entries.find((e) => e.id === entryId);
  if (!entry) {
    return null;
  }
  const occurrence = entries
    .filter((e) => e.exerciseId === entry.exerciseId)
    .map((e) => e.id)
    .sort()
    .indexOf(entryId);
  const candidates = planExercises.filter((pe) => pe.exerciseId === entry.exerciseId);
  return candidates[occurrence] ?? (candidates.length === 1 ? candidates[0] : null);
}
