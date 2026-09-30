import { Injectable } from '@angular/core';

/** Timestamps are stored as ISO 8601 UTC strings, e.g. `2026-09-30T18:00:00.000Z`. */
export type UtcTimestamp = string;

export function toUtc(date: Date): UtcTimestamp {
  return date.toISOString();
}

/** Milliseconds between two stored timestamps (durations always come from timestamps). */
export function durationMs(from: UtcTimestamp, to: UtcTimestamp): number {
  return Date.parse(to) - Date.parse(from);
}

/** Source of "now"; replace in tests with a fixed clock. */
@Injectable({ providedIn: 'root' })
export class Clock {
  now(): Date {
    return new Date();
  }

  nowUtc(): UtcTimestamp {
    return toUtc(this.now());
  }
}
