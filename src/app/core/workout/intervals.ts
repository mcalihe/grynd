import { durationMs, UtcTimestamp } from '../utils/time';

/** Visits shorter than this (swiping past an exercise) are not stored (plan.md §7). */
export const MIN_INTERVAL_MS = 3000;

export function keepInterval(enteredAt: UtcTimestamp, leftAt: UtcTimestamp): boolean {
  return durationMs(enteredAt, leftAt) >= MIN_INTERVAL_MS;
}

/**
 * An interval left open because the app was closed ends at the last set completed after it was
 * entered; without such a set it carries no information and is dropped (returns null).
 */
export function closeStaleInterval(
  enteredAt: UtcTimestamp,
  lastCompletedAt: UtcTimestamp | null,
): UtcTimestamp | null {
  if (lastCompletedAt && durationMs(enteredAt, lastCompletedAt) >= MIN_INTERVAL_MS) {
    return lastCompletedAt;
  }
  return null;
}
