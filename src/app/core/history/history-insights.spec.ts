import { MuscleGroup } from '../db/models';
import {
  bucketSeries,
  calendarMonth,
  comparableRange,
  exerciseComparison,
  exerciseProgress,
  HistorySetFact,
  muscleGroupSets,
  periodBuckets,
  periodRange,
  periodTotals,
  planBreakdown,
  planHistory,
  previousSessionOfPlan,
  recordsBySession,
  shares,
  trainingsPerWeek,
  weekStreak,
} from './history-insights';
import { HistorySummary } from './history-stats';

/** Local date helper: month is 1-based. */
const local = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min);

const session = (
  id: string,
  start: Date,
  minutes = 50,
  extra: Partial<HistorySummary> = {},
): HistorySummary => ({
  id,
  planId: 'p1',
  planName: 'Oberkörper',
  startedAt: start.toISOString(),
  finishedAt: new Date(start.getTime() + minutes * 60_000).toISOString(),
  exerciseCount: 3,
  setCount: 9,
  volumeKg: 1000,
  ...extra,
});

let factId = 0;
/** Completed set of `sessionId`, which started at `start`; sets complete one minute apart. */
const fact = (
  sessionId: string,
  start: Date,
  exerciseId: string,
  weightKg: number | null,
  reps: number | null,
  order = 0,
): HistorySetFact => ({
  id: `f${++factId}`,
  sessionId,
  exerciseId,
  startedAt: start.toISOString(),
  completedAt: new Date(start.getTime() + (order + 1) * 60_000).toISOString(),
  weightKg,
  reps,
});

// Wednesday, 30 Sep 2026
const now = local(2026, 9, 30, 18);

describe('periods', () => {
  it('spans the week, month or year around now and before', () => {
    expect(periodRange('week', 0, now)).toEqual({
      start: local(2026, 9, 28, 0),
      end: local(2026, 10, 5, 0),
    });
    expect(periodRange('week', 1, now).start).toEqual(local(2026, 9, 21, 0));
    expect(periodRange('month', 0, now)).toEqual({
      start: local(2026, 9, 1, 0),
      end: local(2026, 10, 1, 0),
    });
    expect(periodRange('month', 9, now)).toEqual({
      start: local(2025, 12, 1, 0),
      end: local(2026, 1, 1, 0),
    });
    expect(periodRange('year', 1, now)).toEqual({
      start: local(2025, 1, 1, 0),
      end: local(2026, 1, 1, 0),
    });
  });

  it('splits a period into days or months at local midnight', () => {
    const week = periodBuckets('week', periodRange('week', 0, now));
    expect(week).toHaveLength(7);
    expect(week[6]).toEqual({ start: local(2026, 10, 4, 0), end: local(2026, 10, 5, 0) });

    // October 2026 contains the end of daylight saving time in Europe.
    const october = periodBuckets('month', periodRange('month', -1, now));
    expect(october).toHaveLength(31);
    expect(october.every((b) => b.start.getHours() === 0 && b.start.getMinutes() === 0)).toBe(true);

    const year = periodBuckets('year', periodRange('year', 0, now));
    expect(year).toHaveLength(12);
    expect(year[11]).toEqual({ start: local(2026, 12, 1, 0), end: local(2027, 1, 1, 0) });
  });

  it('compares a running period with the same part of the one before', () => {
    const early = local(2026, 10, 4, 20);
    const october = periodRange('month', 0, early);
    const september = periodRange('month', 1, early);
    expect(comparableRange(september, october, early)).toEqual({
      start: local(2026, 9, 1, 0),
      end: local(2026, 9, 4, 20),
    });
    // Past periods are compared in full.
    expect(comparableRange(periodRange('month', 2, early), september, early)).toEqual(
      periodRange('month', 2, early),
    );
    // Never beyond the end of the shorter previous period (31 Oct vs. September).
    const late = local(2026, 10, 31, 12);
    expect(comparableRange(september, periodRange('month', 0, late), late).end).toEqual(
      local(2026, 10, 1, 0),
    );
  });

  it('sums sessions and records within a range', () => {
    const sessions = [
      session('a', local(2026, 9, 1), 60, { setCount: 10, volumeKg: 2000 }),
      session('b', local(2026, 9, 29), 30, { setCount: 5, volumeKg: 500 }),
      session('old', local(2026, 8, 31, 23, 59)),
    ];
    const records = new Map([
      ['a', 2],
      ['old', 5],
    ]);
    expect(periodTotals(sessions, periodRange('month', 0, now), records)).toEqual({
      count: 2,
      durationMs: 90 * 60_000,
      volumeKg: 2500,
      setCount: 15,
      records: 2,
    });
  });

  it('builds a bar series per bucket', () => {
    const sessions = [
      session('a', local(2026, 9, 28, 9), 60, { volumeKg: 3000 }),
      session('b', local(2026, 9, 28, 19), 30, { volumeKg: 1000 }),
      session('c', local(2026, 9, 30), 40, { volumeKg: 2000 }),
    ];
    const buckets = periodBuckets('week', periodRange('week', 0, now));
    expect(bucketSeries(sessions, buckets, 'count')).toEqual([2, 0, 1, 0, 0, 0, 0]);
    expect(bucketSeries(sessions, buckets, 'volume')).toEqual([4000, 0, 2000, 0, 0, 0, 0]);
    expect(bucketSeries(sessions, buckets, 'duration')[0]).toBe(90 * 60_000);
    expect(shares([4000, 0, 2000])).toEqual([1, 0, 0.5]);
    expect(shares([0, 0])).toEqual([0, 0]);
  });
});

describe('calendar and consistency', () => {
  it('lays out a month in Monday-first weeks', () => {
    const weeks = calendarMonth(local(2026, 9, 15), [session('a', local(2026, 9, 29, 7))]);
    expect(weeks).toHaveLength(5);
    expect(weeks[0][0]).toMatchObject({ date: local(2026, 8, 31, 0), inMonth: false });
    expect(weeks[0][1]).toMatchObject({ date: local(2026, 9, 1, 0), inMonth: true });
    expect(weeks[4][1].sessions.map((s) => s.id)).toEqual(['a']);
    expect(weeks[4][6]).toMatchObject({ date: local(2026, 10, 4, 0), inMonth: false });
  });

  it('counts weeks in a row with at least one workout', () => {
    // Weeks before now: 1, 2, 3 and 5, 6, 7, 8 (Wednesdays).
    const weeksAgo = (n: number) => session(`w${n}`, local(2026, 9, 30 - 7 * n));
    const sessions = [1, 2, 3, 5, 6, 7, 8].map(weeksAgo);
    // An empty current week does not break the streak yet.
    expect(weekStreak(sessions, now)).toEqual({ current: 3, longest: 4 });
    expect(weekStreak([...sessions, weeksAgo(0)], now)).toEqual({ current: 4, longest: 4 });
    expect(weekStreak(sessions.slice(1), now)).toEqual({ current: 0, longest: 4 });
    expect(weekStreak([], now)).toEqual({ current: 0, longest: 0 });
  });

  it('averages workouts per week over the elapsed part of the period', () => {
    const september = periodRange('month', 0, now);
    expect(trainingsPerWeek(12, september, local(2026, 10, 3))).toBeCloseTo(12 / (30 / 7));
    // Only Monday to Wednesday of this week have passed.
    expect(trainingsPerWeek(3, periodRange('week', 0, now), now)).toBeCloseTo(7);
  });
});

describe('records', () => {
  it('counts record sets per session in the order they happened', () => {
    const s1 = local(2026, 9, 1);
    const s2 = local(2026, 9, 3);
    const s3 = local(2026, 9, 5);
    const facts = [
      // The very first set has nothing to beat; the second one beats it.
      fact('s1', s1, 'bench', 80, 8, 0),
      fact('s1', s1, 'bench', 85, 8, 1),
      fact('s1', s1, 'squat', 100, 5, 2),
      // Equal to the best is not a record; heavier is.
      fact('s2', s2, 'bench', 85, 8, 0),
      fact('s2', s2, 'squat', 110, 5, 1),
      // Bodyweight sets never count.
      fact('s3', s3, 'bench', null, 20, 0),
    ];
    expect(recordsBySession(facts)).toEqual(
      new Map([
        ['s1', 1],
        ['s2', 1],
        ['s3', 0],
      ]),
    );
  });

  it('measures sessions that started at the same time against earlier ones only', () => {
    const start = local(2026, 9, 1);
    const facts = [fact('a', start, 'bench', 80, 8), fact('b', start, 'bench', 90, 8)];
    expect(recordsBySession(facts)).toEqual(
      new Map([
        ['a', 0],
        ['b', 0],
      ]),
    );
  });
});

describe('breakdowns', () => {
  const groups: Record<string, MuscleGroup | null> = {
    bench: 'chest',
    row: 'back',
    plank: null,
  };
  const groupOf = (id: string) => groups[id] ?? null;

  it('counts sets per muscle group in a fixed order', () => {
    const day = local(2026, 9, 10);
    const facts = [
      fact('a', day, 'bench', 80, 8),
      fact('a', day, 'bench', 80, 8),
      fact('a', day, 'row', 60, 10),
      fact('a', day, 'plank', null, 1),
      fact('old', local(2026, 8, 10), 'row', 60, 10),
    ];
    expect(muscleGroupSets(facts, periodRange('month', 0, now), groupOf)).toEqual([
      { group: 'chest', sets: 2 },
      { group: 'back', sets: 1 },
      { group: 'shoulders', sets: 0 },
      { group: 'legs', sets: 0 },
      { group: 'glutes', sets: 0 },
      { group: 'arms', sets: 0 },
      { group: 'core', sets: 0 },
    ]);
  });

  it('reports the best estimated 1RM per exercise against the time before', () => {
    const august = local(2026, 8, 20);
    const sept1 = local(2026, 9, 2);
    const sept2 = local(2026, 9, 9);
    const facts = [
      fact('aug', august, 'bench', 90, 8),
      fact('s1', sept1, 'bench', 95, 8),
      fact('s2', sept2, 'bench', 100, 5),
      fact('s2', sept2, 'bench', 90, 5, 1),
      fact('s1', sept1, 'dip', null, 12),
      fact('s2', sept2, 'dip', null, 15),
    ];
    const progress = exerciseProgress(facts, periodRange('month', 0, now));
    expect(progress.map((p) => p.exerciseId)).toEqual(['bench', 'dip']);
    expect(progress[0]).toMatchObject({ sets: 3, sessions: 2, kind: 'e1rm' });
    expect(progress[0].best).toBeCloseTo(95 * (1 + 8 / 30));
    expect(progress[0].bestBefore).toBeCloseTo(90 * (1 + 8 / 30));
    // Bodyweight exercises are measured in reps.
    expect(progress[1]).toEqual({
      exerciseId: 'dip',
      sets: 2,
      sessions: 2,
      kind: 'reps',
      best: 15,
      bestBefore: null,
    });
  });

  it('groups workouts per plan, most frequent first', () => {
    const sessions = [
      session('a', local(2026, 9, 1), 40, { planId: 'legs', planName: 'Beine' }),
      session('b', local(2026, 9, 2), 60),
      session('c', local(2026, 9, 3), 50),
      session('old', local(2026, 8, 3), 50, { planId: 'legs', planName: 'Beine' }),
    ];
    expect(planBreakdown(sessions, periodRange('month', 0, now))).toEqual([
      { planId: 'p1', planName: 'Oberkörper', count: 2, durationMs: 110 * 60_000 },
      { planId: 'legs', planName: 'Beine', count: 1, durationMs: 40 * 60_000 },
    ]);
  });
});

describe('one workout and one plan', () => {
  const d1 = local(2026, 9, 1);
  const d2 = local(2026, 9, 3);
  const d3 = local(2026, 9, 5);
  const sessions = [
    session('s3', d3, 55),
    session('other', d2, 30, { planId: 'p2', planName: 'Beine' }),
    session('s1', d1, 45),
  ];

  it('finds the previous workout of the same plan', () => {
    expect(previousSessionOfPlan(sessions, sessions[0])?.id).toBe('s1');
    expect(previousSessionOfPlan(sessions, sessions[2])).toBeUndefined();
    expect(previousSessionOfPlan(sessions, { ...sessions[0], planId: null })).toBeUndefined();
  });

  it('compares each exercise with the last time it was trained', () => {
    const facts = [
      fact('s1', d1, 'bench', 80, 8),
      fact('other', d2, 'bench', 70, 10),
      fact('s3', d3, 'bench', 80, 10),
      fact('s3', d3, 'bench', 80, 8, 1),
      fact('s3', d3, 'row', 60, 10, 2),
    ];
    expect(exerciseComparison(facts, 's3')).toEqual(
      new Map([
        ['bench', { volumeKg: 1440, previousVolumeKg: 700 }],
        ['row', { volumeKg: 600, previousVolumeKg: null }],
      ]),
    );
  });

  it('summarises a plan with a strength trend per exercise', () => {
    const facts = [
      fact('s1', d1, 'row', 60, 10, 0),
      fact('s1', d1, 'bench', 80, 8, 1),
      fact('other', d2, 'bench', 200, 1),
      fact('s3', d3, 'bench', 85, 8, 0),
      fact('s3', d3, 'pullup', null, 10, 1),
    ];
    const plan = planHistory(sessions, facts, 'p1');
    expect(plan.sessions.map((s) => s.id)).toEqual(['s3', 's1']);
    expect(plan.avgDurationMs).toBe(50 * 60_000);
    expect(plan.avgVolumeKg).toBe(1000);
    // Exercises of the latest workout first, in the order they were done, then older ones.
    expect(plan.exercises.map((e) => [e.exerciseId, e.kind])).toEqual([
      ['bench', 'e1rm'],
      ['pullup', 'reps'],
      ['row', 'e1rm'],
    ]);
    const bench = plan.exercises[0];
    expect(bench.series).toHaveLength(2);
    expect(bench.first).toBeCloseTo(80 * (1 + 8 / 30));
    expect(bench.latest).toBeCloseTo(85 * (1 + 8 / 30));
    expect(plan.exercises[1].series).toEqual([null, 10]);
  });

  it('limits the plan trend to the latest workouts', () => {
    const many = Array.from({ length: 15 }, (_, i) => session(`s${i}`, local(2026, 8, 1 + i)));
    const facts = many.map((s, i) => fact(s.id, new Date(s.startedAt), 'bench', 60 + i, 5));
    const plan = planHistory(many, facts, 'p1', 12);
    expect(plan.sessions).toHaveLength(15);
    expect(plan.exercises[0].series).toHaveLength(12);
    expect(plan.exercises[0].first).toBeCloseTo(63 * (1 + 5 / 30));
  });
});
