import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  linkedSignal,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import {
  CalendarDay,
  calendarMonth,
  comparableRange,
  periodRange,
  periodTotals,
  weekStreak,
} from '../../core/history/history-insights';
import { HistorySummary } from '../../core/history/history-stats';
import { HistoryService } from '../../core/history/history.service';
import { Clock } from '../../core/utils/time';
import { HistoryRow } from '../../shared/components/history-row/history-row';
import { KeyFigure, KeyFigures } from '../../shared/components/key-figures/key-figures';
import { MonthCalendar } from '../../shared/components/month-calendar/month-calendar';
import { PeriodPager } from '../../shared/components/period-pager/period-pager';
import { WEEK_MONDAY_FIRST, weekdayShort } from '../../shared/utils/weekdays';
import { HistoryFormat } from './history-format';

const NO_RECORDS = new Map<string, number>();

/** The selected day by default: today when trained, otherwise the last training day shown. */
function defaultDay(weeks: CalendarDay[][], now: Date): Date | null {
  const days = weeks.flat().filter((day) => day.inMonth && day.sessions.length && day.date <= now);
  return days.at(-1)?.date ?? null;
}

/** Verlauf · Kalender: a month of training days, its figures, and the workouts of one day. */
@Component({
  selector: 'app-history-calendar-view',
  imports: [PeriodPager, MonthCalendar, KeyFigures, HistoryRow, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-4' },
  template: `
    <div class="flex flex-col gap-3 rounded-xl border bg-surface-elevated p-4">
      <app-period-pager
        [label]="format.monthYear(month().start)"
        [previousLabel]="'history.calendar.previous' | transloco"
        [nextLabel]="'history.calendar.next' | transloco"
        [canPrevious]="canPrevious()"
        [canNext]="offset() > 0"
        (previous)="offset.set(offset() + 1)"
        (next)="offset.set(offset() - 1)"
      />
      <app-month-calendar
        [weeks]="weeks()"
        [weekdays]="weekdays()"
        [today]="now"
        [dayLabel]="dayLabel"
        [(selected)]="selected"
      />
    </div>

    <app-key-figures class="rounded-xl border bg-card p-4" [figures]="figures()" [columns]="2" />

    @if (selectedSessions().length) {
      <section class="flex flex-col gap-1">
        <h2 class="text-xl font-semibold">{{ format.dayLong(selected()!) }}</h2>
        @for (session of selectedSessions(); track session.id) {
          <app-history-row
            [name]="session.planName || ('history.untitled' | transloco)"
            [details]="format.sessionDetails(session, now)"
            (open)="open(session.id)"
          />
        }
      </section>
    } @else if (!totals().count) {
      <p class="py-4 text-center text-sm text-muted-foreground">
        {{ 'history.calendar.empty' | transloco }}
      </p>
    }
  `,
})
export class HistoryCalendarView {
  private readonly history = inject(HistoryService);
  protected readonly format = inject(HistoryFormat);
  private readonly router = inject(Router);
  protected readonly now = inject(Clock).now();

  /** Months before the current one. */
  protected readonly offset = signal(0);
  protected readonly month = computed(() => periodRange('month', this.offset(), this.now));
  protected readonly weeks = computed(() =>
    calendarMonth(this.month().start, this.history.summaries()),
  );
  protected readonly selected = linkedSignal(() => defaultDay(this.weeks(), this.now));
  protected readonly selectedSessions = computed<HistorySummary[]>(() => {
    const selected = this.selected();
    const day = this.weeks()
      .flat()
      .find((d) => d.inMonth && selected && d.date.getTime() === selected.getTime());
    return day?.sessions ?? [];
  });

  /** Back to the month of the first workout. */
  protected readonly canPrevious = computed(() => {
    const first = this.history.summaries().at(-1);
    return !!first && Date.parse(first.startedAt) < this.month().start.getTime();
  });
  protected readonly weekdays = computed(() =>
    WEEK_MONDAY_FIRST.map((day) => weekdayShort(day, this.format.locale())),
  );
  protected readonly totals = computed(() =>
    periodTotals(this.history.summaries(), this.month(), NO_RECORDS),
  );
  protected readonly figures = computed<KeyFigure[]>(() => {
    const summaries = this.history.summaries();
    const before = periodRange('month', this.offset() + 1, this.now);
    const previous = periodTotals(
      summaries,
      comparableRange(before, this.month(), this.now),
      NO_RECORDS,
    );
    const diff = this.totals().count - previous.count;
    const delta = this.format.delta(diff, String);
    const streak = weekStreak(summaries, this.now);
    return [
      {
        label: this.format.t('history.stats.trainings'),
        value: String(this.totals().count),
        delta: delta && this.format.t('history.calendar.vsLastMonth', { delta }),
        tone: this.format.tone(diff),
      },
      {
        label: this.format.t('history.stats.duration'),
        value: this.format.duration(this.totals().durationMs),
      },
      { label: this.format.t('history.calendar.streak'), value: this.weeksText(streak.current) },
      {
        label: this.format.t('history.calendar.longestStreak'),
        value: this.weeksText(streak.longest),
      },
    ];
  });

  protected readonly dayLabel = (day: CalendarDay): string =>
    this.format.t('history.calendar.day', {
      day: this.format.dayLong(day.date),
      workouts: this.format.workouts(day.sessions.length),
    });

  protected open(id: string): void {
    void this.router.navigate(['/history', id]);
  }

  private weeksText(count: number): string {
    return this.format.count(count, 'history.weekOne', 'history.weeks');
  }
}
