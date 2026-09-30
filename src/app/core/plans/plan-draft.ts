/** Editable copy of a plan used by the editor; saved in one go by PlansService.save(). */
export interface DraftExercise {
  /** Existing plan_exercise row; undefined for exercises added in this edit. */
  planExerciseId?: string;
  exerciseId: string;
  targetSets: number;
  repMin: number;
  repMax: number;
  restSeconds: number;
}

export interface PlanDraft {
  id?: string;
  name: string;
  /** Date#getDay numbers (0 = Sunday). */
  weekdays: number[];
  exercises: DraftExercise[];
}

/** New exercises start with 3 × 8–12 and 90 s rest (plan.md §6). */
export const DEFAULT_TARGETS = { targetSets: 3, repMin: 8, repMax: 12, restSeconds: 90 } as const;

export function emptyDraft(): PlanDraft {
  return { name: '', weekdays: [], exercises: [] };
}

export function isValid(draft: PlanDraft): boolean {
  return draft.name.trim().length > 0 && draft.exercises.length > 0;
}

function normalize(draft: PlanDraft) {
  return {
    name: draft.name.trim(),
    weekdays: [...draft.weekdays].sort((a, b) => a - b),
    exercises: draft.exercises.map((e) => [
      e.planExerciseId ?? null,
      e.exerciseId,
      e.targetSets,
      e.repMin,
      e.repMax,
      e.restSeconds,
    ]),
  };
}

/** True when the draft differs from the saved snapshot; changes that were undone do not count. */
export function isDirty(draft: PlanDraft, snapshot: PlanDraft): boolean {
  return JSON.stringify(normalize(draft)) !== JSON.stringify(normalize(snapshot));
}

export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  const result = [...items];
  const [item] = result.splice(from, 1);
  result.splice(Math.max(0, Math.min(to, result.length)), 0, item);
  return result;
}

/** Appends exercises with default targets; ones already in the plan are skipped. */
export function addExercises(draft: PlanDraft, exerciseIds: readonly string[]): PlanDraft {
  const present = new Set(draft.exercises.map((e) => e.exerciseId));
  const added = exerciseIds
    .filter((id, index) => !present.has(id) && exerciseIds.indexOf(id) === index)
    .map((exerciseId) => ({ exerciseId, ...DEFAULT_TARGETS }));
  return { ...draft, exercises: [...draft.exercises, ...added] };
}

export function removeExercise(draft: PlanDraft, index: number): PlanDraft {
  return { ...draft, exercises: draft.exercises.filter((_, i) => i !== index) };
}

export function updateExercise(
  draft: PlanDraft,
  index: number,
  patch: Partial<Omit<DraftExercise, 'planExerciseId' | 'exerciseId'>>,
): PlanDraft {
  return {
    ...draft,
    exercises: draft.exercises.map((e, i) => {
      if (i !== index) {
        return e;
      }
      const next = { ...e, ...patch };
      // Keep the rep range consistent while the user steps either end.
      if ('repMin' in patch && next.repMin > next.repMax) next.repMax = next.repMin;
      if ('repMax' in patch && next.repMax < next.repMin) next.repMin = next.repMax;
      return next;
    }),
  };
}
