import { UtcTimestamp } from '../utils/time';

/** Columns every table has (plan.md §6). */
export interface BaseEntity {
  id: string;
  createdAt: UtcTimestamp;
  updatedAt: UtcTimestamp;
  deletedAt: UtcTimestamp | null;
}

/** Fields a caller provides when creating a row; id is optional (catalog rows bring their own). */
export type NewEntity<T extends BaseEntity> = Omit<T, keyof BaseEntity> & { id?: string };
export type EntityPatch<T extends BaseEntity> = Partial<Omit<T, keyof BaseEntity>>;

export type MuscleGroup = 'chest' | 'back' | 'shoulders' | 'legs' | 'glutes' | 'arms' | 'core';
export type Force = 'push' | 'pull' | 'static';

export interface Exercise extends BaseEntity {
  /** free-exercise-db id, e.g. `Barbell_Bench_Press_-_Medium_Grip`. */
  key: string;
  nameDe: string;
  nameEn: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  muscleGroup: MuscleGroup | null;
  force: Force | null;
  equipment: string | null;
  level: string | null;
  category: string | null;
  /** Relative paths of bundled images, e.g. `exercises/<key>.webp`. */
  images: string[];
}

/** The user's note on a catalog exercise, shared by all plans (decision 0019). */
export interface ExerciseNote extends BaseEntity {
  exerciseId: string;
  text: string;
}

export interface Plan extends BaseEntity {
  name: string;
  /** 0 = Sunday … 6 = Saturday (Date#getDay). */
  weekdays: number[];
}

export interface PlanExercise extends BaseEntity {
  planId: string;
  exerciseId: string;
  position: number;
  targetSets: number;
  repMin: number;
  repMax: number;
  restSeconds: number;
}

export type WorkoutSessionStatus = 'active' | 'finished' | 'aborted';

export interface WorkoutSession extends BaseEntity {
  planId: string | null;
  startedAt: UtcTimestamp;
  finishedAt: UtcTimestamp | null;
  status: WorkoutSessionStatus;
}

export interface SessionExercise extends BaseEntity {
  sessionId: string;
  exerciseId: string;
  position: number;
  status: 'open' | 'done';
  /** Copied from the plan at session start. */
  repMin: number | null;
  repMax: number | null;
  restSeconds: number | null;
}

export interface ExerciseInterval extends BaseEntity {
  sessionExerciseId: string;
  enteredAt: UtcTimestamp;
  leftAt: UtcTimestamp | null;
}

export interface SetLog extends BaseEntity {
  sessionExerciseId: string;
  position: number;
  /** Always kilograms; pounds are display-only. */
  weightKg: number | null;
  reps: number | null;
  completedAt: UtcTimestamp | null;
  isExtra: boolean;
}
