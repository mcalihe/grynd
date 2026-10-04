import { durationMs, UtcTimestamp } from '../utils/time';

const DAY_MS = 24 * 60 * 60 * 1000;

/** One finished workout as shown in the history list. */
export interface HistorySummary {
  id: string;
  /** Null only for sessions without a plan; the plan itself may be deleted. */
  planId: string | null;
  planName: string;
  startedAt: UtcTimestamp;
  finishedAt: UtcTimestamp;
  exerciseCount: number;
  setCount: number;
  volumeKg: number;
}

export interface HistoryWeek {
  /** 0 = this week, 1 = last week, … */
  offset: number;
  /** Local Monday 00:00. */
  start: Date;
  sessions: HistorySummary[];
}

export interface WeekBar {
  day: Date;
  trained: boolean;
  /** Share of the longest training day of the week, 0–1. */
  value: number;
}

/** Local Monday 00:00 of the week containing `date` (weeks start on Monday, plan.md §8). */
export function startOfWeek(date: Date): Date {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start;
}

/** Whole calendar days from `from` to `to` in local time (DST-safe). */
export function daysBetween(from: Date, to: Date): number {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b.getTime() - a.getTime()) / DAY_MS);
}

/** How many weeks before the week of `now` the date lies (0 = same week). */
export function weekOffset(date: Date, now: Date): number {
  return Math.round(daysBetween(startOfWeek(date), startOfWeek(now)) / 7);
}

export function sessionDurationMs(session: HistorySummary): number {
  return Math.max(0, durationMs(session.startedAt, session.finishedAt));
}

/** Sessions grouped by week, newest week and newest session first. */
export function groupByWeek(sessions: readonly HistorySummary[], now: Date): HistoryWeek[] {
  const weeks = new Map<number, HistoryWeek>();
  const sorted = [...sessions].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  for (const session of sorted) {
    const started = new Date(session.startedAt);
    const offset = weekOffset(started, now);
    let week = weeks.get(offset);
    if (!week) {
      week = { offset, start: startOfWeek(started), sessions: [] };
      weeks.set(offset, week);
    }
    week.sessions.push(session);
  }
  return [...weeks.values()].sort((a, b) => a.offset - b.offset);
}

/** Monday to Sunday of the current week; bar height = training time of the day. */
export function weekBars(sessions: readonly HistorySummary[], now: Date): WeekBar[] {
  const monday = startOfWeek(now);
  const perDay = new Array<number>(7).fill(0);
  const trained = new Array<boolean>(7).fill(false);
  for (const session of sessions) {
    const index = daysBetween(monday, new Date(session.startedAt));
    if (index >= 0 && index < 7) {
      perDay[index] += sessionDurationMs(session);
      trained[index] = true;
    }
  }
  const max = Math.max(...perDay);
  return perDay.map((ms, index) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + index);
    return { day, trained: trained[index], value: max > 0 ? ms / max : 0 };
  });
}

/** Count and time of this week plus the count of last week (for the trend). */
export function weekTotals(
  sessions: readonly HistorySummary[],
  now: Date,
): { count: number; durationMs: number; previousCount: number } {
  let count = 0;
  let total = 0;
  let previousCount = 0;
  for (const session of sessions) {
    const offset = weekOffset(new Date(session.startedAt), now);
    if (offset === 0) {
      count++;
      total += sessionDurationMs(session);
    } else if (offset === 1) {
      previousCount++;
    }
  }
  return { count, durationMs: total, previousCount };
}

/** Rounded to whole minutes; anything above zero shows at least one minute. */
export function durationParts(ms: number): { hours: number; minutes: number } {
  const total = ms <= 0 ? 0 : Math.max(1, Math.round(ms / 60_000));
  return { hours: Math.floor(total / 60), minutes: total % 60 };
}

export type DayLabel = 'today' | 'yesterday' | 'weekday' | 'date';

/** «Heute», «Gestern», the weekday within this and last week, otherwise the date. */
export function dayLabel(date: Date, now: Date): DayLabel {
  const days = daysBetween(date, now);
  if (days === 0) {
    return 'today';
  }
  if (days === 1) {
    return 'yesterday';
  }
  return weekOffset(date, now) <= 1 ? 'weekday' : 'date';
}

/** Σ kg × reps; sets without weight (bodyweight) count as 0. */
export function volumeKg(
  sets: readonly { weightKg: number | null; reps: number | null }[],
): number {
  return sets.reduce((sum, s) => sum + (s.weightKg ?? 0) * (s.reps ?? 0), 0);
}
