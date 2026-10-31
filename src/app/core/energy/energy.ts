import { ActivityProfile, activityProfile, MetModel, STRENGTH_MET } from './activities';

/**
 * Calorie estimates (decision 0024): MET × body weight (kg) × hours. Calories from a device
 * replace the estimate of their entry; heart rate and level are not used.
 */

/** ACSM: VO2 = 0.1 · v + 3.5 ml/kg/min with v in m/min; 1 MET = 3.5 ml/kg/min. */
export function walkingMet(speedKmh: number): number {
  return (0.1 * ((speedKmh * 1000) / 60) + 3.5) / 3.5;
}

/** ACSM: VO2 = 0.2 · v + 3.5 ml/kg/min with v in m/min. */
export function runningMet(speedKmh: number): number {
  return (0.2 * ((speedKmh * 1000) / 60) + 3.5) / 3.5;
}

/** Compendium bands for bicycling: < 10, 10–11.9, 12–13.9, 14–15.9, 16–19.9, ≥ 20 mph. */
export function cyclingMet(speedKmh: number): number {
  const bands: [number, number][] = [
    [16.1, 4],
    [19.3, 6.8],
    [22.5, 8],
    [25.7, 10],
    [32.2, 12],
  ];
  return bands.find(([below]) => speedKmh < below)?.[1] ?? 15.8;
}

const MODELS: Record<MetModel, { met: (speedKmh: number) => number; from: number; to: number }> = {
  walking: { met: walkingMet, from: 2, to: 8 },
  running: { met: runningMet, from: 5, to: 25 },
  cycling: { met: cyclingMet, from: 5, to: 60 },
};

/** MET of a cardio entry: from the speed where the profile has a model, else the fixed value. */
export function cardioMet(
  profile: ActivityProfile,
  durationSec: number | null,
  distanceM: number | null,
): number {
  const model = profile.model && MODELS[profile.model];
  if (!model || !durationSec || !distanceM) {
    return profile.met;
  }
  const speedKmh = (distanceM / durationSec) * 3.6;
  // Outside the range of the equation (or a typo) the fixed value is the better guess.
  return speedKmh >= model.from && speedKmh <= model.to ? model.met(speedKmh) : profile.met;
}

export interface CardioEnergyEntry {
  /** Catalog key of the activity. */
  exerciseKey: string;
  durationSec: number | null;
  distanceM: number | null;
  /** Calories shown by the device. */
  kcal: number | null;
}

export interface Energy {
  kcal: number;
  /** Some part is an estimate (shown with ≈). */
  estimated: boolean;
}

/** Calories of one entry; null when it needs an estimate but the body weight is unknown. */
export function entryKcal(entry: CardioEnergyEntry, bodyWeightKg: number | null): Energy | null {
  if (entry.kcal !== null && entry.kcal > 0) {
    return { kcal: entry.kcal, estimated: false };
  }
  if (!entry.durationSec) {
    return { kcal: 0, estimated: false };
  }
  if (!bodyWeightKg) {
    return null;
  }
  const met = cardioMet(activityProfile(entry.exerciseKey), entry.durationSec, entry.distanceM);
  return { kcal: Math.round((met * bodyWeightKg * entry.durationSec) / 3600), estimated: true };
}

export interface SessionEnergyInput {
  /** Workout duration without pauses. */
  activeMs: number;
  /** Completed strength sets; without any, the time outside cardio entries does not count. */
  strengthSets: number;
  /** Completed cardio entries. */
  cardio: readonly CardioEnergyEntry[];
  bodyWeightKg: number | null;
}

/**
 * Calories of a workout: every cardio entry, plus the remaining active time at the strength MET
 * when strength sets were done. All or nothing: null when a part needs an estimate but the body
 * weight is missing, and when nothing was completed.
 */
export function sessionEnergy({
  activeMs,
  strengthSets,
  cardio,
  bodyWeightKg,
}: SessionEnergyInput): Energy | null {
  if (strengthSets === 0 && cardio.length === 0) {
    return null;
  }
  let kcal = 0;
  let estimated = false;
  for (const entry of cardio) {
    const part = entryKcal(entry, bodyWeightKg);
    if (!part) {
      return null;
    }
    kcal += part.kcal;
    estimated ||= part.estimated;
  }
  if (strengthSets > 0) {
    const cardioMs = cardio.reduce((sum, entry) => sum + (entry.durationSec ?? 0) * 1000, 0);
    const strengthMs = Math.max(0, activeMs - cardioMs);
    if (strengthMs > 0) {
      if (!bodyWeightKg) {
        return null;
      }
      kcal += (STRENGTH_MET * bodyWeightKg * strengthMs) / 3_600_000;
      estimated = true;
    }
  }
  return { kcal: Math.round(kcal), estimated };
}
