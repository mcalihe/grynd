import type { APP_ICONS } from '../icons';
import { TempoKind } from '../units/distance';

/** Catalog category of cardio exercises (free-exercise-db and our own, decision 0025). */
export const CARDIO_CATEGORY = 'cardio';

/** A cardio exercise is logged by duration instead of kg × reps. */
export function isCardio(exercise: { category: string | null } | null | undefined): boolean {
  return exercise?.category === CARDIO_CATEGORY;
}

/** How the MET follows the speed, where the Compendium or ACSM give one (decision 0025). */
export type MetModel = 'walking' | 'running' | 'cycling';

export interface ActivityProfile {
  /** MET when the speed is unknown or implausible (Compendium of Physical Activities). */
  met: number;
  model?: MetModel;
  /** Fields shown besides duration, calories and heart rate. */
  distance: boolean;
  level: boolean;
  /** How the speed is shown; null = not at all. */
  tempo: TempoKind | null;
  icon: keyof typeof APP_ICONS;
}

/** MET of the strength part of a workout: resistance training, multiple exercises, 8–15 reps. */
export const STRENGTH_MET = 3.5;

const run = (met: number, level: boolean): ActivityProfile => ({
  met,
  model: 'running',
  distance: true,
  level,
  tempo: 'pace',
  icon: 'lucideFootprints',
});
const walk = (met: number, level: boolean, model?: MetModel): ActivityProfile => ({
  met,
  model,
  distance: true,
  level,
  tempo: 'pace',
  icon: 'lucideFootprints',
});
const hike = (met: number): ActivityProfile => ({
  met,
  distance: true,
  level: false,
  tempo: 'pace',
  icon: 'lucideMountain',
});
const machine = (met: number, tempo: TempoKind | null, icon: ActivityProfile['icon']) => ({
  met,
  distance: tempo !== null,
  level: true,
  tempo,
  icon,
});
const other = (met: number, distance = false): ActivityProfile => ({
  met,
  distance,
  level: false,
  tempo: null,
  icon: 'lucideActivity',
});

/**
 * Profile per catalog key (decision 0025). A test checks that every cardio exercise of the
 * catalog has one, so new catalog entries cannot slip through.
 */
export const ACTIVITIES: Readonly<Record<string, ActivityProfile>> = {
  Grynd_Running: run(9.8, false),
  Running_Treadmill: run(9.8, true),
  Jogging_Treadmill: run(7, true),
  Grynd_Walking: walk(3.5, false, 'walking'),
  Walking_Treadmill: walk(3.5, true, 'walking'),
  Grynd_Nordic_Walking: walk(4.8, false),
  Grynd_Hiking: hike(6),
  Trail_Running_Walking: hike(6),
  Bicycling: {
    met: 7.5,
    model: 'cycling',
    distance: true,
    level: false,
    tempo: 'speed',
    icon: 'lucideBike',
  },
  Bicycling_Stationary: machine(6.8, 'speed', 'lucideBike'),
  Recumbent_Bike: machine(4.8, 'speed', 'lucideBike'),
  Elliptical_Trainer: machine(5, 'speed', 'lucideActivity'),
  Rowing_Stationary: machine(7, 'split500', 'lucideWaves'),
  Stairmaster: machine(9, null, 'lucideActivity'),
  Step_Mill: machine(9, null, 'lucideActivity'),
  Rope_Jumping: other(11.8),
  Prowler_Sprint: other(8, true),
  Skating: other(8),
  Grynd_Swimming: {
    met: 6,
    distance: true,
    level: false,
    tempo: 'split100',
    icon: 'lucideWaves',
  },
  Grynd_Inline_Skating: { ...other(7.5, true), tempo: 'speed' },
};

/** For a cardio exercise the profiles do not know yet: every field, a moderate MET. */
const FALLBACK: ActivityProfile = { ...machine(6, 'speed', 'lucideActivity') };

export function activityProfile(key: string): ActivityProfile {
  return ACTIVITIES[key] ?? FALLBACK;
}
