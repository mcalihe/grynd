import { activityProfile, STRENGTH_MET } from './activities';
import { cardioMet, cyclingMet, entryKcal, runningMet, sessionEnergy, walkingMet } from './energy';

const minutes = (n: number) => n * 60;

describe('MET from speed (decision 0025)', () => {
  it('uses the ACSM walking equation', () => {
    // 5 km/h = 83.3 m/min → VO2 11.83 ml/kg/min → 3.38 MET
    expect(walkingMet(5)).toBeCloseTo(3.38, 2);
  });

  it('uses the ACSM running equation', () => {
    // 10 km/h = 166.7 m/min → VO2 36.83 → 10.52 MET
    expect(runningMet(10)).toBeCloseTo(10.52, 2);
  });

  it('uses the Compendium speed bands for cycling', () => {
    expect(cyclingMet(14)).toBe(4);
    expect(cyclingMet(18)).toBe(6.8);
    expect(cyclingMet(21)).toBe(8);
    expect(cyclingMet(24)).toBe(10);
    expect(cyclingMet(28)).toBe(12);
    expect(cyclingMet(35)).toBe(15.8);
  });

  it('takes the speed into account where the activity has a model', () => {
    const run = activityProfile('Grynd_Running');
    expect(cardioMet(run, minutes(30), 5000)).toBeCloseTo(runningMet(10), 6);
  });

  it('falls back to the fixed MET without distance or with an implausible speed', () => {
    const run = activityProfile('Grynd_Running');
    expect(cardioMet(run, minutes(30), null)).toBe(run.met);
    expect(cardioMet(run, minutes(30), 50_000)).toBe(run.met); // 100 km/h: a typo
    expect(cardioMet(activityProfile('Rowing_Stationary'), minutes(20), 4000)).toBe(7);
  });
});

describe('entryKcal', () => {
  const run = { exerciseKey: 'Grynd_Running', durationSec: minutes(30), distanceM: null };

  it('prefers the calories from the device', () => {
    expect(entryKcal({ ...run, kcal: 310 }, null)).toEqual({ kcal: 310, estimated: false });
  });

  it('estimates MET × kg × hours', () => {
    // 9.8 MET × 70 kg × 0.5 h
    expect(entryKcal({ ...run, kcal: null }, 70)).toEqual({ kcal: 343, estimated: true });
  });

  it('cannot estimate without body weight', () => {
    expect(entryKcal({ ...run, kcal: null }, null)).toBeNull();
    expect(entryKcal({ ...run, kcal: 0 }, null)).toBeNull();
  });

  it('counts an entry without duration as nothing', () => {
    expect(entryKcal({ ...run, durationSec: null, kcal: null }, null)).toEqual({
      kcal: 0,
      estimated: false,
    });
  });
});

describe('sessionEnergy', () => {
  const hour = 3_600_000;

  it('estimates the active time of a strength workout', () => {
    expect(
      sessionEnergy({ activeMs: hour, strengthSets: 12, cardio: [], bodyWeightKg: 80 }),
    ).toEqual({ kcal: STRENGTH_MET * 80, estimated: true });
  });

  it('adds cardio entries and leaves their time out of the strength part', () => {
    const energy = sessionEnergy({
      activeMs: hour,
      strengthSets: 9,
      cardio: [
        { exerciseKey: 'Rowing_Stationary', durationSec: minutes(15), distanceM: null, kcal: 150 },
      ],
      bodyWeightKg: 80,
    });
    // 150 kcal from the rower + 3.5 MET × 80 kg × 0.75 h
    expect(energy).toEqual({ kcal: 150 + 210, estimated: true });
  });

  it('shows device calories without body weight when nothing needs an estimate', () => {
    const energy = sessionEnergy({
      activeMs: minutes(26) * 1000,
      strengthSets: 0,
      cardio: [
        { exerciseKey: 'Grynd_Running', durationSec: minutes(25), distanceM: 5000, kcal: 310 },
      ],
      bodyWeightKg: null,
    });
    expect(energy).toEqual({ kcal: 310, estimated: false });
  });

  it('shows nothing instead of a partial sum when the body weight is missing', () => {
    expect(
      sessionEnergy({
        activeMs: hour,
        strengthSets: 3,
        cardio: [
          { exerciseKey: 'Grynd_Running', durationSec: minutes(10), distanceM: null, kcal: 120 },
        ],
        bodyWeightKg: null,
      }),
    ).toBeNull();
  });

  it('has nothing to show for a workout without completed sets', () => {
    expect(
      sessionEnergy({ activeMs: hour, strengthSets: 0, cardio: [], bodyWeightKg: 80 }),
    ).toBeNull();
  });
});
