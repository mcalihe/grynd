import { inject, Injectable } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoService } from '@jsverse/transloco';
import { DateRange, StatsPeriod, StrengthKind } from '../../core/history/history-insights';
import {
  dayLabel,
  durationParts,
  HistorySummary,
  HistoryWeek,
  sessionDurationMs,
} from '../../core/history/history-stats';
import { DeltaTone } from '../../shared/components/key-figures/key-figures';
import { SettingsService } from '../../core/settings/settings.service';
import { kgToDisplay, weightDecimals } from '../../core/units/weight';

/**
 * Locale-aware texts for the history screens. Every method reads `ready`, so computeds that use
 * them run again once the translation file is loaded and whenever the language changes.
 */
@Injectable({ providedIn: 'root' })
export class HistoryFormat {
  private readonly transloco = inject(TranslocoService);
  private readonly ready = toSignal(this.transloco.selectTranslation());
  private readonly settings = inject(SettingsService);
  readonly locale = toSignal(this.transloco.langChanges$, { initialValue: 'de' });

  t(key: string, params?: Record<string, unknown>): string {
    this.ready();
    return this.transloco.translate(key, params);
  }

  /** "54 Min.", "2 Std. 41 Min.", "1 Std."; from 10 hours on whole hours only ("11 Std."). */
  duration(ms: number): string {
    const { hours, minutes } = durationParts(ms);
    if (hours === 0) {
      return this.t('history.minutes', { minutes });
    }
    if (hours >= 10) {
      return this.t('history.hours', { hours: Math.round(hours + minutes / 60) });
    }
    return minutes === 0
      ? this.t('history.hours', { hours })
      : this.t('history.hoursMinutes', { hours, minutes });
  }

  /** Signed change such as "+320 kg" or "−4 Min."; empty when it rounds to nothing. */
  delta(value: number, format: (amount: number) => string): string {
    const text = format(Math.abs(value));
    if (value === 0 || !/[1-9]/.test(text)) {
      return '';
    }
    return `${value > 0 ? '+' : '−'}${text}`;
  }

  /** More is better for counts, volume and strength; time is neither. */
  tone(value: number): DeltaTone {
    return value > 0 ? 'up' : 'down';
  }

  /** A weight such as an estimated 1RM, to 0.1 in the chosen unit: "102,5 kg". */
  weight(kg: number): string {
    const unit = this.settings.settings().unit;
    return this.t('history.volume', { volume: this.number(kgToDisplay(kg, unit) ?? 0, 1), unit });
  }

  /** Strength of an exercise: estimated 1RM as a weight, bodyweight exercises in reps. */
  strength(value: number, kind: StrengthKind): string {
    return kind === 'e1rm' ? this.weight(value) : this.t('history.repsOnly', { reps: value });
  }

  /** "Diese Woche", "Vorwoche", "28. Sep. – 4. Okt."; "September 2026"; "2026". */
  period(period: StatsPeriod, range: DateRange, offset: number): string {
    if (period === 'week') {
      return this.week({ offset, start: range.start, sessions: [] });
    }
    return period === 'month' ? this.monthYear(range.start) : String(range.start.getFullYear());
  }

  monthYear(date: Date): string {
    return new Intl.DateTimeFormat(this.locale(), { month: 'long', year: 'numeric' }).format(date);
  }

  /** "Dienstag, 29. September" */
  dayLong(date: Date): string {
    return new Intl.DateTimeFormat(this.locale(), {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }).format(date);
  }

  /** "16. Juli" */
  dateShort(date: Date): string {
    return new Intl.DateTimeFormat(this.locale(), { day: 'numeric', month: 'short' }).format(date);
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

  /** History row details: "Heute · 54 Min. · 6 Übungen". */
  sessionDetails(session: HistorySummary, now: Date): string {
    return [
      this.day(new Date(session.startedAt), now),
      this.duration(sessionDurationMs(session)),
      this.count(session.exerciseCount, 'plans.exerciseCountOne', 'plans.exerciseCount'),
    ].join(' · ');
  }

  workouts(count: number): string {
    return this.count(count, 'history.trainingOne', 'history.trainings');
  }

  /** Singular/plural by key pair, e.g. `history.trainingOne` / `history.trainings`. */
  count(count: number, one: string, other: string): string {
    return this.t(count === 1 ? one : other, { count });
  }

  number(value: number, decimals = 2): string {
    return new Intl.NumberFormat(this.locale(), { maximumFractionDigits: decimals }).format(value);
  }

  /** "80 kg × 8" / "176,4 lb × 8", or "12 Wdh." without weight. */
  set(weightKg: number | null, reps: number | null): string {
    if (!weightKg) {
      return this.t('history.repsOnly', { reps: reps ?? 0 });
    }
    const unit = this.settings.settings().unit;
    return this.t('history.setValue', {
      weight: this.number(kgToDisplay(weightKg, unit) ?? 0, weightDecimals(unit)),
      unit,
      reps: reps ?? 0,
    });
  }

  /** Total volume in the chosen unit, e.g. "8.420 kg". */
  volume(kg: number): string {
    const unit = this.settings.settings().unit;
    return this.t('history.volume', { volume: this.number(kgToDisplay(kg, unit) ?? 0, 0), unit });
  }
}
