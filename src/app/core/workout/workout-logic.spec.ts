import { closeStaleInterval, keepInterval } from './intervals';
import { prefillSets } from './prefill';
import { estimatedOneRepMax, recordSetIds } from './records';

describe('prefillSets', () => {
  it('starts empty with the plan minimum without history', () => {
    expect(prefillSets(3, 8, [])).toEqual([
      { weightKg: null, reps: 8 },
      { weightKg: null, reps: 8 },
      { weightKg: null, reps: 8 },
    ]);
  });

  it('copies the last session position by position', () => {
    const previous = [
      { weightKg: 80, reps: 8 },
      { weightKg: 82.5, reps: 7 },
      { weightKg: 82.5, reps: 6 },
    ];
    expect(prefillSets(3, 8, previous)).toEqual(previous);
  });

  it('repeats the last previous set when the plan has more sets', () => {
    expect(prefillSets(3, 8, [{ weightKg: 60, reps: 10 }])).toEqual([
      { weightKg: 60, reps: 10 },
      { weightKg: 60, reps: 10 },
      { weightKg: 60, reps: 10 },
    ]);
  });

  it('falls back to the plan minimum for missing reps', () => {
    expect(prefillSets(1, 10, [{ weightKg: 20, reps: null }])).toEqual([
      { weightKg: 20, reps: 10 },
    ]);
  });
});

describe('records', () => {
  it('estimates the one-rep max after Epley', () => {
    expect(estimatedOneRepMax(100, 1)).toBeCloseTo(103.33, 2);
    expect(estimatedOneRepMax(80, 8)).toBeCloseTo(101.33, 2);
    expect(estimatedOneRepMax(null, 8)).toBeNull();
    expect(estimatedOneRepMax(80, 0)).toBeNull();
  });

  it('marks sets that beat the history and earlier sets of the session', () => {
    const history = estimatedOneRepMax(80, 8); // 101.3
    const sets = [
      { id: 'a', weightKg: 80, reps: 8 }, // equal → no record
      { id: 'b', weightKg: 82.5, reps: 8 }, // 104.5 → record
      { id: 'c', weightKg: 82.5, reps: 7 }, // 101.75 < 104.5 → no record
      { id: 'd', weightKg: 85, reps: 8 }, // 107.7 → record
    ];
    expect([...recordSetIds(sets, history)]).toEqual(['b', 'd']);
  });

  it('needs a baseline: the first set ever is not a record', () => {
    const sets = [
      { id: 'a', weightKg: 60, reps: 10 },
      { id: 'b', weightKg: 65, reps: 10 },
    ];
    expect([...recordSetIds(sets, null)]).toEqual(['b']);
  });

  it('ignores sets without weight', () => {
    expect([...recordSetIds([{ id: 'a', weightKg: null, reps: 12 }], 50)]).toEqual([]);
  });
});

describe('intervals', () => {
  const t = (seconds: number) => new Date(Date.UTC(2026, 8, 30, 10, 0, seconds)).toISOString();

  it('drops visits shorter than 3 seconds', () => {
    expect(keepInterval(t(0), t(2))).toBe(false);
    expect(keepInterval(t(0), t(3))).toBe(true);
  });

  it('closes stale intervals at the last completed set or drops them', () => {
    expect(closeStaleInterval(t(0), t(40))).toBe(t(40));
    expect(closeStaleInterval(t(0), null)).toBeNull();
    expect(closeStaleInterval(t(10), t(11))).toBeNull();
  });
});
