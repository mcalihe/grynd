import {
  dayLabel,
  durationParts,
  groupByWeek,
  HistorySummary,
  startOfWeek,
  volumeKg,
  weekBars,
  weekOffset,
  weekTotals,
} from './history-stats';

/** Local date helper: month is 1-based. */
const local = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min);

const session = (id: string, start: Date, minutes: number): HistorySummary => ({
  id,
  planName: id,
  startedAt: start.toISOString(),
  finishedAt: new Date(start.getTime() + minutes * 60_000).toISOString(),
  exerciseCount: 3,
  setCount: 9,
  volumeKg: 1000,
});

// Thursday, 1 Oct 2026
const now = local(2026, 10, 1, 18);

describe('weeks', () => {
  it('starts on Monday', () => {
    expect(startOfWeek(now)).toEqual(local(2026, 9, 28, 0));
    expect(startOfWeek(local(2026, 10, 4, 23, 59))).toEqual(local(2026, 9, 28, 0));
    expect(startOfWeek(local(2026, 9, 28, 0, 0))).toEqual(local(2026, 9, 28, 0));
  });

  it('counts weeks back from now', () => {
    expect(weekOffset(local(2026, 9, 28, 0, 0), now)).toBe(0);
    expect(weekOffset(local(2026, 9, 27, 23, 59), now)).toBe(1);
    expect(weekOffset(local(2026, 9, 14), now)).toBe(2);
  });

  it('groups sessions by week, newest first', () => {
    const weeks = groupByWeek(
      [
        session('old', local(2026, 9, 15), 50),
        session('mon', local(2026, 9, 28), 50),
        session('thu', local(2026, 10, 1, 9), 50),
        session('last', local(2026, 9, 24), 50),
      ],
      now,
    );
    expect(weeks.map((w) => w.offset)).toEqual([0, 1, 2]);
    expect(weeks[0].sessions.map((s) => s.id)).toEqual(['thu', 'mon']);
    expect(weeks[2].start).toEqual(local(2026, 9, 14, 0));
  });
});

describe('weekBars and totals', () => {
  const sessions = [
    session('a', local(2026, 9, 29), 60),
    session('b', local(2026, 10, 1, 7), 30),
    session('c', local(2026, 10, 1, 17), 30),
    session('prev', local(2026, 9, 25), 45),
  ];

  it('scales bars to the longest training day and leaves other days flat', () => {
    const bars = weekBars(sessions, now);
    expect(bars).toHaveLength(7);
    expect(bars.map((b) => b.trained)).toEqual([false, true, false, true, false, false, false]);
    expect(bars[1].value).toBe(1);
    expect(bars[3].value).toBe(1);
    expect(bars[0].value).toBe(0);
    expect(bars[6].day).toEqual(local(2026, 10, 4, 0));
  });

  it('sums this week and counts last week', () => {
    expect(weekTotals(sessions, now)).toEqual({
      count: 3,
      durationMs: 120 * 60_000,
      previousCount: 1,
    });
  });
});

describe('formatting helpers', () => {
  it('rounds durations to minutes with at least one minute', () => {
    expect(durationParts(0)).toEqual({ hours: 0, minutes: 0 });
    expect(durationParts(20_000)).toEqual({ hours: 0, minutes: 1 });
    expect(durationParts(54 * 60_000 + 20_000)).toEqual({ hours: 0, minutes: 54 });
    expect(durationParts(161 * 60_000)).toEqual({ hours: 2, minutes: 41 });
  });

  it('labels days relative to now', () => {
    expect(dayLabel(local(2026, 10, 1, 6), now)).toBe('today');
    expect(dayLabel(local(2026, 9, 30, 23), now)).toBe('yesterday');
    expect(dayLabel(local(2026, 9, 21), now)).toBe('weekday');
    expect(dayLabel(local(2026, 9, 20), now)).toBe('date');
  });

  it('adds up the volume and ignores bodyweight sets', () => {
    expect(
      volumeKg([
        { weightKg: 80, reps: 8 },
        { weightKg: null, reps: 12 },
        { weightKg: 82.5, reps: 6 },
      ]),
    ).toBe(1135);
  });
});
