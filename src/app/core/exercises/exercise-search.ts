import { Exercise, MuscleGroup } from '../db/models';

export const MUSCLE_GROUPS: readonly MuscleGroup[] = [
  'chest',
  'back',
  'shoulders',
  'legs',
  'glutes',
  'arms',
  'core',
];
export const FORCES = ['push', 'pull'] as const;
export type ForceFilter = (typeof FORCES)[number];

/** Equipment chips (plan.md §8) → free-exercise-db equipment values. */
export const EQUIPMENT_FILTERS = {
  barbell: ['barbell', 'e-z curl bar'],
  dumbbell: ['dumbbell'],
  cable: ['cable'],
  machine: ['machine'],
  bodyweight: ['body only'],
} as const;
export type EquipmentFilter = keyof typeof EQUIPMENT_FILTERS;
export const EQUIPMENT: readonly EquipmentFilter[] = Object.keys(
  EQUIPMENT_FILTERS,
) as EquipmentFilter[];

export interface ExerciseFilter {
  query: string;
  muscles: readonly MuscleGroup[];
  forces: readonly ForceFilter[];
  equipment: readonly EquipmentFilter[];
}

export const EMPTY_FILTER: ExerciseFilter = { query: '', muscles: [], forces: [], equipment: [] };

/**
 * Lower case, ß → ss, accents removed and ä/ö/ü written as ae/oe/ue folded to a/o/u, so that
 * «bankdrucken», «bankdruecken» and «Bankdrücken» all match.
 */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/([aou])e/g, '$1');
}

export function isFilterActive(filter: ExerciseFilter): boolean {
  return (
    filter.query.trim() !== '' ||
    filter.muscles.length > 0 ||
    filter.forces.length > 0 ||
    filter.equipment.length > 0
  );
}

/** Every query word must appear in the German or English name. */
export function matchesQuery(exercise: Exercise, query: string): boolean {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return true;
  }
  const haystack = normalize(`${exercise.nameDe} ${exercise.nameEn}`);
  return words.every((word) => haystack.includes(word));
}

/** OR within a chip group, AND between groups (plan.md §8). */
export function filterExercises(
  exercises: readonly Exercise[],
  filter: ExerciseFilter,
): Exercise[] {
  const equipment = new Set<string>(filter.equipment.flatMap((e) => EQUIPMENT_FILTERS[e]));
  return exercises.filter(
    (exercise) =>
      (filter.muscles.length === 0 ||
        (exercise.muscleGroup !== null && filter.muscles.includes(exercise.muscleGroup))) &&
      (filter.forces.length === 0 ||
        (exercise.force !== null &&
          (filter.forces as readonly string[]).includes(exercise.force))) &&
      (equipment.size === 0 ||
        (exercise.equipment !== null && equipment.has(exercise.equipment))) &&
      matchesQuery(exercise, filter.query),
  );
}

/** Toggles a value in a chip group. */
export function toggle<T>(values: readonly T[], value: T): T[] {
  return values.includes(value) ? values.filter((v) => v !== value) : [...values, value];
}
