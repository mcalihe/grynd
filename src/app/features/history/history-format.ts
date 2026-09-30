import { inject, Injectable } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoService } from '@jsverse/transloco';
import { dayLabel, durationParts, HistoryWeek } from '../../core/history/history-stats';

/**
 * Locale-aware texts for the history screens. Every method reads `ready`, so computeds that use
 * them run again once the translation file is loaded and whenever the language changes.
 */
@Injectable({ providedIn: 'root' })
export class HistoryFormat {
  private readonly transloco = inject(TranslocoService);
  private readonly ready = toSignal(this.transloco.selectTranslation());
  readonly locale = toSignal(this.transloco.langChanges$, { initialValue: 'de' });

  t(key: string, params?: Record<string, unknown>): string {
    this.ready();
    return this.transloco.translate(key, params);
  }

  /** "54 Min.", "2 Std. 41 Min.", "1 Std." */
  duration(ms: number): string {
    const { hours, minutes } = durationParts(ms);
    if (hours === 0) {
      return this.t('history.minutes', { minutes });
    }
    return minutes === 0
      ? this.t('history.hours', { hours })
      : this.t('history.hoursMinutes', { hours, minutes });
  }

  /** "Heute", "Gestern", "Freitag" (this and last week) or "Mo., 7. Sep." */
  day(date: Date, now: Date): string {
    switch (dayLabel(date, now)) {
      case 'today':
        return this.t('history.today');
      case 'yesterday':
        return this.t('history.yesterday');
      case 'weekday':
        return new Intl.DateTimeFormat(this.locale(), { weekday: 'long' }).format(date);
      default:
        return new Intl.DateTimeFormat(this.locale(), {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
        }).format(date);
    }
  }

  time(date: Date): string {
    return new Intl.DateTimeFormat(this.locale(), { hour: '2-digit', minute: '2-digit' }).format(
      date,
    );
  }

  /** "Diese Woche", "Vorwoche", then the date range "7.–13. Sep.". */
  week(week: HistoryWeek): string {
    if (week.offset === 0) {
      return this.t('history.thisWeek');
    }
    if (week.offset === 1) {
      return this.t('history.lastWeek');
    }
    const end = new Date(week.start);
    end.setDate(end.getDate() + 6);
    return new Intl.DateTimeFormat(this.locale(), { day: 'numeric', month: 'short' }).formatRange(
      week.start,
      end,
    );
  }

  /** Singular/plural by key pair, e.g. `history.trainingOne` / `history.trainings`. */
  count(count: number, one: string, other: string): string {
    return this.t(count === 1 ? one : other, { count });
  }

  number(value: number, decimals = 2): string {
    return new Intl.NumberFormat(this.locale(), { maximumFractionDigits: decimals }).format(value);
  }

  /** "80 kg × 8", or "12 Wdh." without weight. */
  set(weightKg: number | null, reps: number | null): string {
    if (!weightKg) {
      return this.t('history.repsOnly', { reps: reps ?? 0 });
    }
    return this.t('history.setValue', { weight: this.number(weightKg), reps: reps ?? 0 });
  }
}
