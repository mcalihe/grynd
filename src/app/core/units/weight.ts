import { WeightUnit } from '../settings/settings.service';

/** Exact factor of the international avoirdupois pound. */
export const LB_PER_KG = 1 / 0.45359237;

/** ± step of the weight stepper in the displayed unit. */
export const WEIGHT_STEP = 2.5;

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** Decimals shown for a weight: kg like 82.5 or 82.25, lb to 0.1. */
export function weightDecimals(unit: WeightUnit): number {
  return unit === 'kg' ? 2 : 1;
}

/** Stored kilograms → value shown in the chosen unit (lb rounded to 0.1). */
export function kgToDisplay(kg: number | null, unit: WeightUnit): number | null {
  if (kg === null) {
    return null;
  }
  return unit === 'kg' ? kg : round(kg * LB_PER_KG, weightDecimals('lb'));
}

/**
 * Value entered in the chosen unit → kilograms to store. Pounds are converted with enough
 * precision that the same pound value is shown again (135 lb stays 135 lb).
 */
export function displayToKg(value: number | null, unit: WeightUnit): number | null {
  if (value === null) {
    return null;
  }
  return unit === 'kg' ? value : round(value / LB_PER_KG, 6);
}
