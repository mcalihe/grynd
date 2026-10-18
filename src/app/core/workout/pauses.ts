import { durationMs, UtcTimestamp } from '../utils/time';

/** The part of a pause the duration needs; `resumedAt` is null while the workout is paused. */
export interface PauseSpan {
  pausedAt: UtcTimestamp;
  resumedAt: UtcTimestamp | null;
}

/** Paused time up to `until`; a pause still open counts until then (decision 0023). */
export function pausedMs(pauses: readonly PauseSpan[], until: UtcTimestamp): number {
  return pauses.reduce(
    (sum, p) => sum + Math.max(0, durationMs(p.pausedAt, p.resumedAt ?? until)),
    0,
  );
}

/** Training time from the start until `until` without the pauses, so it stands still while paused. */
export function activeDurationMs(
  startedAt: UtcTimestamp,
  until: UtcTimestamp,
  pauses: readonly PauseSpan[],
): number {
  return Math.max(0, durationMs(startedAt, until) - pausedMs(pauses, until));
}
