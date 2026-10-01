export interface StepperBounds {
  min: number;
  max: number;
  decimals: number;
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function clamp(value: number, { min, max, decimals }: StepperBounds): number {
  return round(Math.min(max, Math.max(min, value)), decimals);
}

/** Adds `delta` (±step); an empty value starts at `min`. */
export function stepValue(value: number | null, delta: number, bounds: StepperBounds): number {
  return clamp((value ?? bounds.min) + delta, bounds);
}

/** Parses user input such as `82,5` or `82.5`; returns null for empty or invalid text. */
export function parseNumber(text: string): number | null {
  const normalized = text.trim().replace(',', '.');
  if (normalized === '') {
    return null;
  }
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

export function formatNumber(value: number | null, locale: string, decimals: number): string {
  if (value === null) {
    return '–';
  }
  return new Intl.NumberFormat(locale, { maximumFractionDigits: decimals }).format(value);
}

/** Horizontal movement before a press on the value counts as a swipe instead of a tap. */
export const SWIPE_THRESHOLD_PX = 8;
const SLOW_PX_PER_STEP = 24;
const FAST_PX_PER_STEP = 4;
/** Finger speed (px/ms) at and above which a step needs only FAST_PX_PER_STEP. */
const FAST_VELOCITY = 1.5;
const SLOW_VELOCITY = 0.15;

/** Pixels of finger travel per step: the faster the swipe, the fewer pixels. */
export function swipeStepPx(velocity: number): number {
  const t = Math.min(1, Math.max(0, (velocity - SLOW_VELOCITY) / (FAST_VELOCITY - SLOW_VELOCITY)));
  return SLOW_PX_PER_STEP - t * (SLOW_PX_PER_STEP - FAST_PX_PER_STEP);
}

/**
 * Turns accumulated travel (px, right = positive) into whole steps at the given speed and returns
 * the travel left over for the next move.
 */
export function swipeSteps(travel: number, velocity: number): { steps: number; rest: number } {
  const perStep = swipeStepPx(velocity);
  const steps = Math.trunc(travel / perStep);
  return { steps, rest: travel - steps * perStep };
}
