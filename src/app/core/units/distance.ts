/** Distances are stored in metres; km and mi are display-only (decision 0024). */
export type DistanceUnit = 'km' | 'mi';

/** Exact international mile. */
export const M_PER_MI = 1609.344;

/** Decimals shown for a distance (5,23 km). */
export const DISTANCE_DECIMALS = 2;

/** ± step of the distance stepper in the displayed unit. */
export const DISTANCE_STEP = 0.1;

const METERS: Record<DistanceUnit, number> = { km: 1000, mi: M_PER_MI };

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function metersToDisplay(meters: number | null, unit: DistanceUnit): number | null {
  return meters === null ? null : round(meters / METERS[unit], DISTANCE_DECIMALS);
}

/** Typed value → metres, precise enough that the same value shows again (3,15 mi stays 3,15). */
export function displayToMeters(value: number | null, unit: DistanceUnit): number | null {
  return value === null ? null : round(value * METERS[unit], 3);
}

/** How a cardio activity shows its speed: min/km, km/h, or per 500 m (rowing) or 100 m (swimming). */
export type TempoKind = 'pace' | 'speed' | 'split500' | 'split100';

export type Tempo =
  /** Seconds per km or mi. */
  | { kind: 'pace'; secondsPer: number }
  /** km/h or mph. */
  | { kind: 'speed'; perHour: number }
  /** Seconds per 500 m or 100 m, always metric like the machines and pools. */
  | { kind: 'split'; secondsPer: number; meters: 100 | 500 };

export function tempo(
  kind: TempoKind | null,
  durationSec: number | null,
  distanceM: number | null,
  unit: DistanceUnit,
): Tempo | null {
  if (!kind || !durationSec || !distanceM) {
    return null;
  }
  switch (kind) {
    case 'pace':
      return { kind, secondsPer: Math.round(durationSec / (distanceM / METERS[unit])) };
    case 'speed':
      return { kind, perHour: round((distanceM / METERS[unit] / durationSec) * 3600, 1) };
    case 'split500':
    case 'split100': {
      const meters = kind === 'split500' ? 500 : 100;
      return { kind: 'split', secondsPer: Math.round(durationSec / (distanceM / meters)), meters };
    }
  }
}
