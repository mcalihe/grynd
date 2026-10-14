/**
 * A plan shared as a template (decision 0027): what to train, never how it went. No ids or
 * timestamps of the sender travel; the receiver gets new rows. Notes and weight steps are
 * optional extras the sender picks.
 */
import { isBase64, isObject } from '../backup/backup';
import { NOTE_MAX_LENGTH } from '../exercises/exercise-notes.service';
import { NOTE_MAX_IMAGES } from '../exercises/note-image';
import { PlanDraft } from '../plans/plan-draft';
import { WEIGHT_STEPS } from '../units/weight';

export const PLAN_SHARE_VERSION = 1;
/** Same as the editor's name field. */
export const PLAN_NAME_MAX = 60;

/** Limits of the plan editor; a shared plan must be one the editor could have made. */
const LIMITS = {
  targetSets: [1, 20],
  repMin: [1, 100],
  repMax: [1, 100],
  restSeconds: [0, 600],
} as const;
/** Target duration of a cardio exercise in s, as in the editor (decision 0025). */
const TARGET_DURATION: readonly [number, number] = [1, 86_399];
const MAX_EXERCISES = 50;
const MAX_PLANS = 20;

export interface SharedExercise {
  exerciseId: string;
  targetSets: number;
  repMin: number;
  repMax: number;
  restSeconds: number;
  /** Cardio target (decision 0025); null for strength or no target. Missing in older shares. */
  targetDurationSec: number | null;
}

export interface SharedPlan {
  name: string;
  weekdays: number[];
  exercises: SharedExercise[];
}

export interface SharedNote {
  exerciseId: string;
  text: string;
  /** JPEG files as base64. */
  images: string[];
}

export interface SharedWeightStep {
  exerciseId: string;
  kg: number | null;
  lb: number | null;
}

export interface PlanShare {
  app: 'grynd';
  kind: 'plan';
  version: number;
  exportedAt: string;
  plans: SharedPlan[];
  notes: SharedNote[];
  weightSteps: SharedWeightStep[];
}

export type PlanShareError = 'format' | 'newerVersion' | 'invalid' | 'unknownExercise';
export type PlanShareResult = { ok: true; share: PlanShare } | { ok: false; error: PlanShareError };

export function buildPlanShare(
  draft: PlanDraft,
  exportedAt: string,
  notes: SharedNote[] = [],
  weightSteps: SharedWeightStep[] = [],
): PlanShare {
  return {
    app: 'grynd',
    kind: 'plan',
    version: PLAN_SHARE_VERSION,
    exportedAt,
    plans: [
      {
        name: draft.name,
        weekdays: [...draft.weekdays],
        exercises: draft.exercises.map((e) => ({
          exerciseId: e.exerciseId,
          targetSets: e.targetSets,
          repMin: e.repMin,
          repMax: e.repMax,
          restSeconds: e.restSeconds,
          targetDurationSec: e.targetDurationSec,
        })),
      },
    ],
    notes,
    weightSteps,
  };
}

/** `grynd-plan-push-day.json`: the name in plain ASCII, so every share target accepts it. */
export function planShareFileName(name: string): string {
  const slug = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  return `grynd-plan${slug ? `-${slug}` : ''}.json`;
}

/** True when the parsed JSON claims to be a shared plan (checked fully by validatePlanShare). */
export function isPlanShare(raw: unknown): raw is Record<string, unknown> {
  return isObject(raw) && raw['app'] === 'grynd' && raw['kind'] === 'plan';
}

const inRange = (value: unknown, [min, max]: readonly [number, number]) =>
  Number.isInteger(value) && (value as number) >= min && (value as number) <= max;
const isId = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= 64;

function readExercise(raw: unknown): SharedExercise | null {
  if (!isObject(raw) || !isId(raw['exerciseId'])) {
    return null;
  }
  for (const [key, range] of Object.entries(LIMITS)) {
    if (!inRange(raw[key], range)) {
      return null;
    }
  }
  const targetDurationSec = raw['targetDurationSec'] ?? null;
  if (targetDurationSec !== null && !inRange(targetDurationSec, TARGET_DURATION)) {
    return null;
  }
  const exercise = {
    exerciseId: raw['exerciseId'],
    targetSets: raw['targetSets'] as number,
    repMin: raw['repMin'] as number,
    repMax: raw['repMax'] as number,
    restSeconds: raw['restSeconds'] as number,
    targetDurationSec: targetDurationSec as number | null,
  };
  return exercise.repMin <= exercise.repMax ? exercise : null;
}

function readPlan(raw: unknown): SharedPlan | null {
  if (!isObject(raw)) {
    return null;
  }
  const name = typeof raw['name'] === 'string' ? raw['name'].trim() : '';
  const weekdays = raw['weekdays'];
  const exercises = raw['exercises'];
  if (
    !name ||
    name.length > PLAN_NAME_MAX ||
    !Array.isArray(weekdays) ||
    !weekdays.every((d) => inRange(d, [0, 6])) ||
    new Set(weekdays).size !== weekdays.length ||
    !Array.isArray(exercises) ||
    !exercises.length ||
    exercises.length > MAX_EXERCISES
  ) {
    return null;
  }
  const read = exercises.map(readExercise);
  if (read.some((e) => e === null)) {
    return null;
  }
  return {
    name,
    weekdays: [...weekdays].sort((a, b) => a - b),
    exercises: read as SharedExercise[],
  };
}

function readNote(raw: unknown): SharedNote | null {
  if (!isObject(raw) || !isId(raw['exerciseId'])) {
    return null;
  }
  const text = typeof raw['text'] === 'string' ? raw['text'].trim() : null;
  const images = raw['images'] ?? [];
  if (
    text === null ||
    text.length > NOTE_MAX_LENGTH ||
    !Array.isArray(images) ||
    images.length > NOTE_MAX_IMAGES ||
    !images.every(isBase64) ||
    (!text && !images.length)
  ) {
    return null;
  }
  return { exerciseId: raw['exerciseId'], text, images };
}

function readWeightStep(raw: unknown): SharedWeightStep | null {
  if (!isObject(raw) || !isId(raw['exerciseId'])) {
    return null;
  }
  const kg = raw['kg'] ?? null;
  const lb = raw['lb'] ?? null;
  if (
    (kg !== null && !WEIGHT_STEPS.kg.includes(kg as number)) ||
    (lb !== null && !WEIGHT_STEPS.lb.includes(lb as number)) ||
    (kg === null && lb === null)
  ) {
    return null;
  }
  return { exerciseId: raw['exerciseId'], kg: kg as number | null, lb: lb as number | null };
}

/** Reads every entry of an optional list; null when the list or any entry is invalid. */
function readList<T>(raw: unknown, read: (item: unknown) => T | null): T[] | null {
  if (raw === undefined) {
    return [];
  }
  if (!Array.isArray(raw)) {
    return null;
  }
  const items = raw.map(read);
  return items.some((item) => item === null) ? null : (items as T[]);
}

/**
 * Checks a parsed shared plan: our app and kind, a version this app reads, values the plan
 * editor allows, at most one note and weight step per exercise, and only exercises from the
 * bundled catalog.
 */
export function validatePlanShare(raw: unknown, exerciseIds: ReadonlySet<string>): PlanShareResult {
  if (!isPlanShare(raw)) {
    return { ok: false, error: 'format' };
  }
  const version = raw['version'];
  if (!Number.isInteger(version) || (version as number) < 1) {
    return { ok: false, error: 'format' };
  }
  if ((version as number) > PLAN_SHARE_VERSION) {
    return { ok: false, error: 'newerVersion' };
  }
  const rawPlans = raw['plans'];
  if (!Array.isArray(rawPlans) || !rawPlans.length || rawPlans.length > MAX_PLANS) {
    return { ok: false, error: 'format' };
  }
  const plans = readList(rawPlans, readPlan);
  const notes = readList(raw['notes'], readNote);
  const weightSteps = readList(raw['weightSteps'], readWeightStep);
  if (!plans || !notes || !weightSteps) {
    return { ok: false, error: 'invalid' };
  }
  const unique = (items: { exerciseId: string }[]) =>
    new Set(items.map((i) => i.exerciseId)).size === items.length;
  if (!unique(notes) || !unique(weightSteps)) {
    return { ok: false, error: 'invalid' };
  }
  const used = [...plans.flatMap((p) => p.exercises), ...notes, ...weightSteps];
  if (used.some((e) => !exerciseIds.has(e.exerciseId))) {
    return { ok: false, error: 'unknownExercise' };
  }
  const exportedAt = typeof raw['exportedAt'] === 'string' ? raw['exportedAt'] : '';
  return {
    ok: true,
    share: {
      app: 'grynd',
      kind: 'plan',
      version: PLAN_SHARE_VERSION,
      exportedAt,
      plans,
      notes,
      weightSteps,
    },
  };
}

/** "Push", or "Push (2)", "Push (3)" … when the name is taken. */
export function uniquePlanName(name: string, taken: Iterable<string>): string {
  const names = new Set([...taken].map((n) => n.trim().toLowerCase()));
  if (!names.has(name.toLowerCase())) {
    return name;
  }
  for (let n = 2; ; n++) {
    const suffix = ` (${n})`;
    const candidate = name.slice(0, PLAN_NAME_MAX - suffix.length).trimEnd() + suffix;
    if (!names.has(candidate.toLowerCase())) {
      return candidate;
    }
  }
}
