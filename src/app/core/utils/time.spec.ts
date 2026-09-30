import { Clock, durationMs, toUtc } from './time';

describe('time utils', () => {
  it('stores timestamps as ISO UTC strings', () => {
    expect(toUtc(new Date(Date.UTC(2026, 8, 30, 18, 5, 0)))).toBe('2026-09-30T18:05:00.000Z');
  });

  it('derives durations from timestamps', () => {
    expect(durationMs('2026-09-30T18:00:00.000Z', '2026-09-30T18:54:30.000Z')).toBe(
      54.5 * 60 * 1000,
    );
  });

  it('Clock.nowUtc returns a UTC timestamp', () => {
    expect(new Clock().nowUtc()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });
});
