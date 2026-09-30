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
