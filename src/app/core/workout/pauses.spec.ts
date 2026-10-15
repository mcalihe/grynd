import { activeDurationMs, pausedMs } from './pauses';

const at = (minute: number) => new Date(Date.UTC(2026, 9, 1, 18, minute)).toISOString();
const MIN = 60_000;

describe('pausedMs', () => {
  it('sums ended pauses and counts an open one until now', () => {
    const pauses = [
      { pausedAt: at(10), resumedAt: at(15) },
      { pausedAt: at(30), resumedAt: null },
    ];
    expect(pausedMs([], at(40))).toBe(0);
    expect(pausedMs(pauses, at(40))).toBe(15 * MIN);
  });

  it('never counts a pause backwards', () => {
    expect(pausedMs([{ pausedAt: at(20), resumedAt: at(10) }], at(30))).toBe(0);
  });
});

describe('activeDurationMs', () => {
  it('leaves out the pauses', () => {
    const pauses = [{ pausedAt: at(10), resumedAt: at(15) }];
    expect(activeDurationMs(at(0), at(40), pauses)).toBe(35 * MIN);
  });

  it('stands still while paused', () => {
    const pauses = [{ pausedAt: at(20), resumedAt: null }];
    expect(activeDurationMs(at(0), at(25), pauses)).toBe(20 * MIN);
    expect(activeDurationMs(at(0), at(90), pauses)).toBe(20 * MIN);
  });

  it('is never negative', () => {
    expect(activeDurationMs(at(10), at(0), [])).toBe(0);
  });
});
