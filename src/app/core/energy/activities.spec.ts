import catalog from '../../../../public/data/exercises.json';
import { APP_ICONS } from '../icons';
import { ACTIVITIES, activityProfile, isCardio } from './activities';

describe('activity profiles (decision 0024)', () => {
  const cardioKeys = catalog.exercises.filter((e) => e.category === 'cardio').map((e) => e.key);

  it('has a profile for every cardio exercise of the catalog and nothing else', () => {
    expect(cardioKeys.length).toBeGreaterThan(14);
    expect(Object.keys(ACTIVITIES).sort()).toEqual([...cardioKeys].sort());
  });

  it('uses registered icons and plausible values', () => {
    for (const profile of Object.values(ACTIVITIES)) {
      expect(APP_ICONS).toHaveProperty(profile.icon);
      expect(profile.met).toBeGreaterThan(2);
      expect(profile.met).toBeLessThan(16);
      if (profile.tempo) {
        expect(profile.distance).toBe(true);
      }
    }
  });

  it('falls back for unknown keys', () => {
    expect(activityProfile('Unknown').met).toBeGreaterThan(0);
  });

  it('detects cardio by the catalog category', () => {
    expect(isCardio({ category: 'cardio' })).toBe(true);
    expect(isCardio({ category: 'strength' })).toBe(false);
    expect(isCardio(undefined)).toBe(false);
  });
});
