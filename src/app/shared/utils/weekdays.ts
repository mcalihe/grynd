/** Weekdays use Date#getDay numbering: 0 = Sunday … 6 = Saturday. The UI lists Monday first. */
export const WEEK_MONDAY_FIRST = [1, 2, 3, 4, 5, 6, 0] as const;

/** Sorts weekday numbers Monday-first. */
export function sortWeekdays(days: readonly number[]): number[] {
  return [...days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
}

/** Two-letter label such as "Mo"/"Tu" for the given locale (1 Jan 2024 was a Monday). */
export function weekdayShort(day: number, locale: string): string {
  const date = new Date(Date.UTC(2024, 0, 1 + ((day + 6) % 7)));
  const name = new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' }).format(date);
  return name.replace('.', '').slice(0, 2);
}
