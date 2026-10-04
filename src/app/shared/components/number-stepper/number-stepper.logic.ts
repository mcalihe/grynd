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

/** Horizontal movement before a press on the stepper counts as a scrub instead of a tap. */
export const SWIPE_THRESHOLD_PX = 8;
/** Finger travel per step while scrubbing: one tick on the ruler, independent of speed. */
export const SCRUB_STEP_PX = 16;
/** Zone at each screen edge in which the ruler keeps scrolling while the finger rests there. */
export const EDGE_ZONE_PX = 56;
const EDGE_MIN_STEPS_PER_S = 3;
const EDGE_MAX_STEPS_PER_S = 12;

function isMultiple(value: number, of: number): boolean {
  const ratio = value / of;
  return Math.abs(ratio - Math.round(ratio)) < 1e-6;
}

/**
 * Steps between two labelled ticks: the first of 4, 5 or 10 steps that lands on a round number
 * (2.5 kg → every 10 kg, 1 rep → every 5, 15 s → every 60 s).
 */
export function majorEvery(step: number): number {
  return [4, 5, 10].find((k) => isMultiple(k * step, 5)) ?? 5;
}

/**
 * Value under the finger, `offsetSteps` (fractional) away from where the scrub started. Values
 * snap to multiples of `step`; within half a step of the start the start value is kept, so an
 * off-grid value such as 82.25 only changes once the finger really moves.
 */
export function scrubValue(
  start: number | null,
  offsetSteps: number,
  step: number,
  bounds: StepperBounds,
): number | null {
  if (Math.abs(offsetSteps) < 0.5) {
    return start;
  }
  const raw = (start ?? bounds.min) + offsetSteps * step;
  return clamp(Math.round(raw / step) * step, bounds);
}

/** Where the ruler sits: `base` is drawn at `originX`, and the whole ruler is shifted left by `scrollPx`. */
export interface RulerFrame {
  base: number;
  step: number;
  originX: number;
  scrollPx: number;
}

/** Screen x of a value on the ruler. */
export function rulerX(value: number, { base, step, originX, scrollPx }: RulerFrame): number {
  return originX + ((value - base) / step) * SCRUB_STEP_PX - scrollPx;
}

/** Steps (fractional) between the ruler's base and screen x. */
export function rulerOffset(x: number, { originX, scrollPx }: RulerFrame): number {
  return (x - originX + scrollPx) / SCRUB_STEP_PX;
}

export interface RulerTick {
  value: number;
  x: number;
  major: boolean;
}

/** Ticks between screen x `from` and `to` that lie within the bounds. */
export function rulerTicks(
  frame: RulerFrame,
  from: number,
  to: number,
  { min, max, decimals }: StepperBounds,
): RulerTick[] {
  const { base, step } = frame;
  const first = Math.ceil(Math.max(min, base + rulerOffset(from, frame) * step) / step - 1e-9);
  const last = Math.floor(Math.min(max, base + rulerOffset(to, frame) * step) / step + 1e-9);
  const major = majorEvery(step) * step;
  const ticks: RulerTick[] = [];
  for (let i = first; i <= last; i++) {
    const value = round(i * step, decimals) + 0; // + 0 turns -0 into 0
    ticks.push({ value, x: rulerX(value, frame), major: isMultiple(value, major) });
  }
  return ticks;
}

/**
 * Edge scrolling speed in steps per second at screen x: 0 outside the edge zones, growing towards
 * the screen edge; negative on the left (smaller values).
 */
export function edgeSpeed(x: number, width: number): number {
  const depth =
    x < EDGE_ZONE_PX
      ? (EDGE_ZONE_PX - x) / EDGE_ZONE_PX
      : (x - (width - EDGE_ZONE_PX)) / EDGE_ZONE_PX;
  if (depth <= 0) {
    return 0;
  }
  const t = Math.min(1, depth);
  const speed = EDGE_MIN_STEPS_PER_S + (EDGE_MAX_STEPS_PER_S - EDGE_MIN_STEPS_PER_S) * t * t;
  return x < EDGE_ZONE_PX ? -speed : speed;
}

/**
 * Scroll after `elapsedMs` with the finger resting at x. Stops once the value under the finger
 * reaches the bound it scrolls towards, and never pulls the ruler back when it is already past it.
 */
export function edgeScroll(
  x: number,
  width: number,
  elapsedMs: number,
  frame: RulerFrame,
  { min, max }: StepperBounds,
): number {
  const speed = edgeSpeed(x, width);
  const { scrollPx } = frame;
  if (speed === 0) {
    return scrollPx;
  }
  const next = scrollPx + (speed * SCRUB_STEP_PX * elapsedMs) / 1000;
  const bound = speed < 0 ? min : max;
  const limit = ((bound - frame.base) / frame.step) * SCRUB_STEP_PX - (x - frame.originX);
  return speed < 0
    ? Math.max(next, Math.min(scrollPx, limit))
    : Math.min(next, Math.max(scrollPx, limit));
}
