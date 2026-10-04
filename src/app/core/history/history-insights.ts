import { MuscleGroup } from '../db/models';
import { MUSCLE_GROUPS } from '../exercises/exercise-search';
import { UtcTimestamp } from '../utils/time';
import { estimatedOneRepMax, recordSetIds } from '../workout/records';
import {
  daysBetween,
  HistorySummary,
  sessionDurationMs,
  startOfWeek,
  weekOffset,
} from './history-stats';

/** One completed set of a finished workout: the raw material of the statistics. */
export interface HistorySetFact {
  id: string;
  sessionId: string;
  exerciseId: string;
  /** Start of the session the set belongs to. */
  startedAt: UtcTimestamp;
  completedAt: UtcTimestamp;
  weightKg: number | null;
  reps: number | null;
}

export type StatsPeriod = 'week' | 'month' | 'year';
export type StatsMetric = 'count' | 'duration' | 'volume' | 'sets';

/** Local time span from `start` (inclusive) to `end` (exclusive). */
export interface DateRange {
  start: Date;
  end: Date;
}

/** Strength is the estimated 1RM; exercises never done with weight are measured in reps. */
export type StrengthKind = 'e1rm' | 'reps';

/** The week, month or year containing `now`, or `offset` periods before it (negative = after). */
export function periodRange(period: StatsPeriod, offset: number, now: Date): DateRange {
  if (period === 'week') {
    const start = startOfWeek(now);
    start.setDate(start.getDate() - 7 * offset);
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    return { start, end };
  }
  if (period === 'month') {
    const month = now.getMonth() - offset;
    return {
      start: new Date(now.getFullYear(), month, 1),
      end: new Date(now.getFullYear(), month + 1, 1),
    };
  }
  const year = now.getFullYear() - offset;
  return { start: new Date(year, 0, 1), end: new Date(year + 1, 0, 1) };
}

export function inRange(timestamp: UtcTimestamp, range: DateRange): boolean {
  const time = Date.parse(timestamp);
  return time >= range.start.getTime() && time < range.end.getTime();
}

/** Days of a week or month, months of a year; each bucket starts at local midnight. */
export function periodBuckets(period: StatsPeriod, range: DateRange): DateRange[] {
  const buckets: DateRange[] = [];
  for (let start = new Date(range.start); start < range.end;) {
    const end = new Date(start);
    if (period === 'year') {
      end.setMonth(end.getMonth() + 1);
    } else {
      end.setDate(end.getDate() + 1);
    }
    buckets.push({ start, end });
    start = end;
  }
  return buckets;
}

export interface PeriodTotals {
  count: number;
  durationMs: number;
  volumeKg: number;
  setCount: number;
  records: number;
}

export function periodTotals(
  sessions: readonly HistorySummary[],
  range: DateRange,
  records: ReadonlyMap<string, number>,
): PeriodTotals {
  const totals: PeriodTotals = { count: 0, durationMs: 0, volumeKg: 0, setCount: 0, records: 0 };
  for (const session of sessions) {
    if (inRange(session.startedAt, range)) {
      totals.count++;
      totals.durationMs += sessionDurationMs(session);
      totals.volumeKg += session.volumeKg;
      totals.setCount += session.setCount;
      totals.records += records.get(session.id) ?? 0;
    }
  }
  return totals;
}

export function metricValue(session: HistorySummary, metric: StatsMetric): number {
  switch (metric) {
    case 'count':
      return 1;
    case 'duration':
      return sessionDurationMs(session);
    case 'volume':
      return session.volumeKg;
    case 'sets':
      return session.setCount;
  }
}

/** Sum of `metric` per bucket, for a bar chart. */
export function bucketSeries(
  sessions: readonly HistorySummary[],
  buckets: readonly DateRange[],
  metric: StatsMetric,
): number[] {
  return buckets.map((bucket) =>
    sessions.reduce(
      (sum, s) => (inRange(s.startedAt, bucket) ? sum + metricValue(s, metric) : sum),
      0,
    ),
  );
}

/** Each value as a share of the largest one, 0–1 (bar heights). */
export function shares(values: readonly number[]): number[] {
  const max = Math.max(0, ...values);
  return values.map((value) => (max > 0 ? value / max : 0));
}

export interface CalendarDay {
  /** Local midnight. */
  date: Date;
  inMonth: boolean;
  sessions: HistorySummary[];
}

/** The month containing `month` as Monday-to-Sunday weeks, with the workouts of each day. */
export function calendarMonth(month: Date, sessions: readonly HistorySummary[]): CalendarDay[][] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const next = new Date(month.getFullYear(), month.getMonth() + 1, 1);
  const byDay = new Map<string, HistorySummary[]>();
  for (const session of sessions) {
    const key = dayKey(new Date(session.startedAt));
    byDay.set(key, [...(byDay.get(key) ?? []), session]);
  }
  const weeks: CalendarDay[][] = [];
  for (let day = startOfWeek(first); day < next;) {
    const week: CalendarDay[] = [];
    for (let i = 0; i < 7; i++) {
      week.push({
        date: new Date(day),
        inMonth: day.getMonth() === first.getMonth(),
        sessions: byDay.get(dayKey(day)) ?? [],
      });
      day.setDate(day.getDate() + 1);
    }
    weeks.push(week);
  }
  return weeks;
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

/**
 * Weeks in a row with at least one workout. A week without a workout yet does not break the
 * current streak until it is over.
 */
export function weekStreak(
  sessions: readonly HistorySummary[],
  now: Date,
): { current: number; longest: number } {
  const weeks = new Set(
    sessions.map((s) => weekOffset(new Date(s.startedAt), now)).filter((offset) => offset >= 0),
  );
  let current = 0;
  for (let offset = weeks.has(0) ? 0 : 1; weeks.has(offset); offset++) {
    current++;
  }
  let longest = 0;
  let run = 0;
  let previous = -2;
  for (const offset of [...weeks].sort((a, b) => a - b)) {
    run = offset === previous + 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = offset;
  }
  return { current, longest };
}

/** Workouts per week over the part of `range` that has passed by `now`. */
export function trainingsPerWeek(count: number, range: DateRange, now: Date): number {
  const last = new Date(Math.min(now.getTime(), range.end.getTime() - 1));
  const days = Math.max(1, daysBetween(range.start, last) + 1);
  return count / (days / 7);
}

/**
 * Record sets per session (plan.md §7 «Rekord»), replaying all workouts in the order they started.
 * Each session is measured against sessions that started earlier, like `HistoryService.detail()`.
 */
export function recordsBySession(facts: readonly HistorySetFact[]): Map<string, number> {
  const best = new Map<string, number>();
  const counts = new Map<string, number>();
  const byStart = groupBy(facts, (f) => f.startedAt);
  for (const start of [...byStart.keys()].sort()) {
    const sessions = groupBy(byStart.get(start)!, (f) => f.sessionId);
    const improved = new Map<string, number>();
    for (const [sessionId, sets] of sessions) {
      let count = 0;
      for (const [exerciseId, exerciseSets] of groupBy(sets, (f) => f.exerciseId)) {
        const inOrder = [...exerciseSets].sort((a, b) =>
          a.completedAt.localeCompare(b.completedAt),
        );
        count += recordSetIds(inOrder, best.get(exerciseId) ?? null).size;
        for (const set of inOrder) {
          const e1rm = estimatedOneRepMax(set.weightKg, set.reps);
          if (e1rm !== null) {
            improved.set(exerciseId, Math.max(improved.get(exerciseId) ?? 0, e1rm));
          }
        }
      }
      counts.set(sessionId, count);
    }
    // Sessions that started at the same moment do not count against each other.
    for (const [exerciseId, e1rm] of improved) {
      best.set(exerciseId, Math.max(best.get(exerciseId) ?? 0, e1rm));
    }
  }
  return counts;
}

/** Completed sets per muscle group in `range`, all groups in the catalog's fixed order. */
export function muscleGroupSets(
  facts: readonly HistorySetFact[],
  range: DateRange,
  groupOf: (exerciseId: string) => MuscleGroup | null,
): { group: MuscleGroup; sets: number }[] {
  const counts = new Map<MuscleGroup, number>();
  for (const f of facts) {
    const group = inRange(f.startedAt, range) ? groupOf(f.exerciseId) : null;
    if (group) {
      counts.set(group, (counts.get(group) ?? 0) + 1);
    }
  }
  return MUSCLE_GROUPS.map((group) => ({ group, sets: counts.get(group) ?? 0 }));
}

export interface ExerciseProgress {
  exerciseId: string;
  sets: number;
  sessions: number;
  kind: StrengthKind;
  /** Best estimated 1RM (or reps) in the range. */
  best: number;
  /** Best before the range started; null without earlier sets. */
  bestBefore: number | null;
}

/** Strength per exercise trained in `range`, most sets first. */
export function exerciseProgress(
  facts: readonly HistorySetFact[],
  range: DateRange,
): ExerciseProgress[] {
  const progress: ExerciseProgress[] = [];
  for (const [exerciseId, sets] of groupBy(facts, (f) => f.exerciseId)) {
    const inside = sets.filter((f) => inRange(f.startedAt, range));
    const kind = strengthKind(sets);
    const best = bestStrength(inside, kind);
    if (best === null) {
      continue;
    }
    const before = sets.filter((f) => Date.parse(f.startedAt) < range.start.getTime());
    progress.push({
      exerciseId,
      sets: inside.length,
      sessions: new Set(inside.map((f) => f.sessionId)).size,
      kind,
      best,
      bestBefore: bestStrength(before, kind),
    });
  }
  return progress.sort((a, b) => b.sets - a.sets || b.sessions - a.sessions);
}

export interface PlanBreakdown {
  planId: string | null;
  planName: string;
  count: number;
  durationMs: number;
}

/** Workouts per plan in `range`, most frequent first. */
export function planBreakdown(
  sessions: readonly HistorySummary[],
  range: DateRange,
): PlanBreakdown[] {
  const plans = new Map<string | null, PlanBreakdown>();
  for (const session of sessions) {
    if (!inRange(session.startedAt, range)) {
      continue;
    }
    const plan = plans.get(session.planId) ?? {
      planId: session.planId,
      planName: session.planName,
      count: 0,
      durationMs: 0,
    };
    plan.count++;
    plan.durationMs += sessionDurationMs(session);
    plans.set(session.planId, plan);
  }
  return [...plans.values()].sort((a, b) => b.count - a.count);
}

/** The last workout of the same plan that started before `session`. */
export function previousSessionOfPlan(
  sessions: readonly HistorySummary[],
  session: HistorySummary,
): HistorySummary | undefined {
  if (!session.planId) {
    return undefined;
  }
  return sessions
    .filter((s) => s.planId === session.planId && s.startedAt < session.startedAt)
    .reduce<HistorySummary | undefined>(
      (latest, s) => (!latest || s.startedAt > latest.startedAt ? s : latest),
      undefined,
    );
}

export interface ExerciseComparison {
  volumeKg: number;
  /** Volume the last time the exercise was trained before; null the first time. */
  previousVolumeKg: number | null;
}

/** Volume per exercise of one session against the last earlier session with that exercise. */
export function exerciseComparison(
  facts: readonly HistorySetFact[],
  sessionId: string,
): Map<string, ExerciseComparison> {
  const own = facts.filter((f) => f.sessionId === sessionId);
  const startedAt = own[0]?.startedAt;
  const result = new Map<string, ExerciseComparison>();
  for (const [exerciseId, sets] of groupBy(own, (f) => f.exerciseId)) {
    const earlier = facts.filter((f) => f.exerciseId === exerciseId && f.startedAt < startedAt);
    const last = earlier.reduce<HistorySetFact | undefined>(
      (latest, f) => (!latest || f.startedAt > latest.startedAt ? f : latest),
      undefined,
    );
    result.set(exerciseId, {
      volumeKg: volume(sets),
      previousVolumeKg: last ? volume(earlier.filter((f) => f.sessionId === last.sessionId)) : null,
    });
  }
  return result;
}

export interface PlanExerciseTrend {
  exerciseId: string;
  kind: StrengthKind;
  /** Best value per workout, oldest first; null where the exercise was not done. */
  series: (number | null)[];
  first: number;
  latest: number;
}

export interface PlanHistory {
  /** Newest first. */
  sessions: HistorySummary[];
  avgDurationMs: number;
  avgVolumeKg: number;
  exercises: PlanExerciseTrend[];
}

/**
 * All workouts of one plan, with a strength trend per exercise over the latest `limit` workouts.
 * Exercises of the latest workout come first, in the order they were done.
 */
export function planHistory(
  summaries: readonly HistorySummary[],
  facts: readonly HistorySetFact[],
  planId: string,
  limit = 12,
): PlanHistory {
  const sessions = summaries
    .filter((s) => s.planId === planId)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const recent = sessions.slice(0, limit).reverse();
  const ids = new Set(recent.map((s) => s.id));
  const planFacts = facts
    .filter((f) => ids.has(f.sessionId))
    .sort(
      (a, b) =>
        b.startedAt.localeCompare(a.startedAt) || a.completedAt.localeCompare(b.completedAt),
    );
  const exercises: PlanExerciseTrend[] = [];
  for (const [exerciseId, sets] of groupBy(planFacts, (f) => f.exerciseId)) {
    const kind = strengthKind(sets);
    const bySession = groupBy(sets, (f) => f.sessionId);
    const series = recent.map((s) => bestStrength(bySession.get(s.id) ?? [], kind));
    const values = series.filter((v): v is number => v !== null);
    if (values.length) {
      exercises.push({ exerciseId, kind, series, first: values[0], latest: values.at(-1)! });
    }
  }
  const count = sessions.length || 1;
  return {
    sessions,
    avgDurationMs: sessions.reduce((sum, s) => sum + sessionDurationMs(s), 0) / count,
    avgVolumeKg: sessions.reduce((sum, s) => sum + s.volumeKg, 0) / count,
    exercises,
  };
}

function strengthKind(sets: readonly HistorySetFact[]): StrengthKind {
  return sets.some((f) => estimatedOneRepMax(f.weightKg, f.reps) !== null) ? 'e1rm' : 'reps';
}

function bestStrength(sets: readonly HistorySetFact[], kind: StrengthKind): number | null {
  let best: number | null = null;
  for (const f of sets) {
    const value = kind === 'e1rm' ? estimatedOneRepMax(f.weightKg, f.reps) : f.reps || null;
    if (value !== null) {
      best = best === null ? value : Math.max(best, value);
    }
  }
  return best;
}

function volume(sets: readonly HistorySetFact[]): number {
  return sets.reduce((sum, f) => sum + (f.weightKg ?? 0) * (f.reps ?? 0), 0);
}

/** Groups in first-seen order. */
function groupBy<T>(items: readonly T[], key: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    const group = groups.get(k);
    if (group) {
      group.push(item);
    } else {
      groups.set(k, [item]);
    }
  }
  return groups;
}
