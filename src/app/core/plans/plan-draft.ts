/** Editable copy of a plan used by the editor; saved in one go by PlansService.save(). */
export interface DraftExercise {
  /** Existing plan_exercise row; undefined for exercises added in this edit. */
  planExerciseId?: string;
  exerciseId: string;
  targetSets: number;
  repMin: number;
  repMax: number;
  restSeconds: number;
  /** Cardio target (decision 0024); null for strength or a cardio exercise without target. */
  targetDurationSec: number | null;
}

export interface PlanDraft {
  id?: string;
  name: string;
  /** Date#getDay numbers (0 = Sunday). */
  weekdays: number[];
  exercises: DraftExercise[];
}

/** New exercises start with 3 × 8–12 and 90 s rest (plan.md §6). */
export const DEFAULT_TARGETS = {
  targetSets: 3,
  repMin: 8,
  repMax: 12,
  restSeconds: 90,
  targetDurationSec: null,
} as const;

/**
 * New cardio exercises (decision 0024): one entry of 10 minutes. The rep and rest columns keep
 * their defaults because they are NOT NULL, but cardio does not use them.
 */
export const DEFAULT_CARDIO_TARGETS = {
  ...DEFAULT_TARGETS,
  targetSets: 1,
  targetDurationSec: 600,
} as const;

export function emptyDraft(): PlanDraft {
  return { name: '', weekdays: [], exercises: [] };
}

/** Longest plan name the editor accepts (maxlength of the name input). */
export const PLAN_NAME_MAX_LENGTH = 60;

/**
 * Unsaved new plan with the source's weekdays, exercises and targets. Notes and weight steps
 * belong to the exercise, so the copy shares them without copying anything.
 */
export function copyDraft(source: PlanDraft, name: string): PlanDraft {
  return {
    name: name.slice(0, PLAN_NAME_MAX_LENGTH),
    weekdays: [...source.weekdays],
    exercises: source.exercises.map((e) => ({
      exerciseId: e.exerciseId,
      targetSets: e.targetSets,
      repMin: e.repMin,
      repMax: e.repMax,
      restSeconds: e.restSeconds,
      targetDurationSec: e.targetDurationSec,
    })),
  };
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
      e.targetDurationSec,
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

/**
 * Appends exercises with default targets (cardio ones with a target duration); ones already in
 * the plan are skipped.
 */
export function addExercises(
  draft: PlanDraft,
  exerciseIds: readonly string[],
  isCardio: (exerciseId: string) => boolean = () => false,
): PlanDraft {
  const present = new Set(draft.exercises.map((e) => e.exerciseId));
  const added = exerciseIds
    .filter((id, index) => !present.has(id) && exerciseIds.indexOf(id) === index)
    .map((exerciseId) => ({
      exerciseId,
      ...(isCardio(exerciseId) ? DEFAULT_CARDIO_TARGETS : DEFAULT_TARGETS),
    }));
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
