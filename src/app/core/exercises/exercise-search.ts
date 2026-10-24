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

/** Equipment filter for a catalog equipment value (`null` if no filter covers it). */
export function equipmentFilterOf(value: string | null): EquipmentFilter | null {
  return (
    EQUIPMENT.find((e) => (EQUIPMENT_FILTERS[e] as readonly string[]).includes(value ?? '')) ?? null
  );
}

/**
 * Search vocabulary per muscle group and equipment (decision 0024), German and English plus
 * common gym words, so «brust kurzhantel», «bizeps» or «kh» find exercises without a filter.
 * Only matched against, never shown.
 */
const MUSCLE_TERMS: Record<MuscleGroup, string> = {
  chest: 'brust brustmuskel chest pec pecs',
  back: 'rücken back lat lats latissimus',
  shoulders: 'schulter schultern shoulder shoulders delts deltoid',
  legs: 'beine bein legs leg quads quadrizeps oberschenkel waden calves hamstrings',
  glutes: 'po gesäß glutes glute',
  arms: 'arme arm arms bizeps biceps trizeps triceps unterarm forearm',
  core: 'core bauch abs rumpf',
};
const EQUIPMENT_TERMS: Record<EquipmentFilter, string> = {
  barbell: 'langhantel barbell lh sz-stange',
  dumbbell: 'kurzhantel kurzhanteln dumbbell dumbbells kh',
  cable: 'kabel kabelzug seilzug cable',
  machine: 'maschine gerät machine',
  bodyweight: 'körpergewicht eigengewicht bodyweight',
};

const haystacks = new WeakMap<Exercise, string>();

/** Names in both languages plus the muscle and equipment vocabulary, normalized once. */
function haystack(exercise: Exercise): string {
  let text = haystacks.get(exercise);
  if (text === undefined) {
    const equipment = equipmentFilterOf(exercise.equipment);
    text = normalize(
      [
        exercise.nameDe,
        exercise.nameEn,
        exercise.muscleGroup ? MUSCLE_TERMS[exercise.muscleGroup] : '',
        equipment ? EQUIPMENT_TERMS[equipment] : '',
      ].join(' '),
    );
    haystacks.set(exercise, text);
  }
  return text;
}

/** Every query word must appear in the name (German or English), muscle group or equipment. */
export function matchesQuery(exercise: Exercise, query: string): boolean {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  return words.every((word) => haystack(exercise).includes(word));
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
