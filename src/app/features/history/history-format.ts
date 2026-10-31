import { inject, Injectable } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoService } from '@jsverse/transloco';
import { activityProfile } from '../../core/energy/activities';
import { Energy } from '../../core/energy/energy';
import { ExerciseCatalogService } from '../../core/exercises/exercise-catalog.service';
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
import { formatDistance, formatTempo, tempo } from '../../core/units/distance';
import { kgToDisplay, weightDecimals } from '../../core/units/weight';
import { formatDuration } from '../../shared/components/number-stepper/number-stepper.logic';

/** A cardio entry as the history shows it (decision 0024). */
export interface CardioEntryValues {
  durationSec: number | null;
  distanceM: number | null;
  level: number | null;
  kcal: number | null;
  heartRate: number | null;
}

/**
 * Locale-aware texts for the history screens. Every method reads `ready`, so computeds that use
 * them run again once the translation file is loaded and whenever the language changes.
 */
@Injectable({ providedIn: 'root' })
export class HistoryFormat {
  private readonly transloco = inject(TranslocoService);
  private readonly ready = toSignal(this.transloco.selectTranslation());
  private readonly settings = inject(SettingsService);
  private readonly catalog = inject(ExerciseCatalogService);
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

  /**
   * History row details: "Heute · 54 Min. · 6 Übungen"; a cardio workout without a plan ends
   * with its distance instead (decision 0024).
   */
  sessionDetails(session: HistorySummary, now: Date): string {
    const last = session.activityId
      ? session.distanceM > 0
        ? this.distance(session.distanceM)
        : ''
      : this.count(session.exerciseCount, 'plans.exerciseCountOne', 'plans.exerciseCount');
    return [this.day(new Date(session.startedAt), now), this.duration(sessionDurationMs(session))]
      .concat(last ? [last] : [])
      .join(' · ');
  }

  /** The plan name, or the activity of a cardio workout without a plan, else "Training". */
  sessionName(session: Pick<HistorySummary, 'planName' | 'activityId'>): string {
    return (
      session.planName ||
      (session.activityId ? this.catalog.nameById(session.activityId) : '') ||
      this.t('history.untitled')
    );
  }

  /** Icon of a workout: the activity's for cardio without a plan, else a dumbbell. */
  sessionIcon(session: Pick<HistorySummary, 'activityId'>): string {
    const activity = session.activityId ? this.catalog.byId().get(session.activityId) : undefined;
    return activity ? activityProfile(activity.key).icon : 'lucideDumbbell';
  }

  /** "310 kcal", or "≈ 310 kcal" for an estimate. */
  kcal(energy: Energy | number): string {
    const { kcal, estimated } =
      typeof energy === 'number' ? { kcal: energy, estimated: false } : energy;
    return this.t(estimated ? 'history.kcalEstimated' : 'history.kcal', {
      kcal: this.number(kcal, 0),
    });
  }

  /** "5,2 km" / "3,23 mi" in the chosen distance unit. */
  distance(meters: number): string {
    return formatDistance(meters, this.settings.settings().distanceUnit, this.locale());
  }

  /** «4:48 /km», «25,3 km/h» or «2:00 /500 m» for the activity; empty without distance. */
  tempo(exerciseKey: string, durationSec: number | null, distanceM: number | null): string {
    const unit = this.settings.settings().distanceUnit;
    const value = tempo(activityProfile(exerciseKey).tempo, durationSec, distanceM, unit);
    return value ? formatTempo(value, unit, this.locale()) : '';
  }

  /** "25:00 · 5,2 km · 4:48 /km · Stufe 8 · 142 bpm · ≈ 310 kcal" (decision 0024). */
  cardio(exerciseKey: string, entry: CardioEntryValues, energy: Energy | null): string {
    const parts = [
      entry.durationSec ? formatDuration(entry.durationSec) : '',
      entry.distanceM ? this.distance(entry.distanceM) : '',
      this.tempo(exerciseKey, entry.durationSec, entry.distanceM),
      entry.level !== null ? this.t('history.level', { level: this.number(entry.level, 1) }) : '',
      entry.heartRate ? this.t('history.heartRate', { bpm: entry.heartRate }) : '',
      energy && energy.kcal > 0 ? this.kcal(energy) : '',
    ];
    return parts.filter(Boolean).join(' · ');
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
