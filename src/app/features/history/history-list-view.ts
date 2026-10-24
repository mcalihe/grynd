import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon } from '@ng-icons/core';
import {
  groupByWeek,
  HistorySummary,
  weekBars,
  weekTotals,
} from '../../core/history/history-stats';
import { HistoryService } from '../../core/history/history.service';
import { Clock } from '../../core/utils/time';
import { HistoryRow } from '../../shared/components/history-row/history-row';
import { WeekChart } from '../../shared/components/week-chart/week-chart';
import { weekdayShort } from '../../shared/utils/weekdays';
import { HistoryFormat } from './history-format';

/** Verlauf · Liste (Figma 37:29734, empty 106:1654): this week as a chart, then all workouts. */
@Component({
  selector: 'app-history-list-view',
  imports: [WeekChart, HistoryRow, NgIcon, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-1 flex-col gap-4' },
  template: `
    <app-week-chart
      [title]="chartTitle()"
      [subtitle]="chartSubtitle()"
      [trend]="trend()"
      [trendLabel]="trendLabel()"
      [chartLabel]="chartSubtitle()"
      [bars]="bars()"
    />

    @for (week of weeks(); track week.offset) {
      <section class="flex flex-col gap-1" [attr.data-week]="week.offset">
        <h2
          [class]="
            week.offset === 0
              ? 'text-xl font-semibold'
              : 'pt-2 text-sm font-medium text-muted-foreground'
          "
        >
          {{ format.week(week) }}
        </h2>
        @for (session of week.sessions; track session.id) {
          <app-history-row
            [name]="session.planName || ('history.untitled' | transloco)"
            [details]="details(session)"
            (open)="open(session.id)"
          />
        }
      </section>
    } @empty {
      <section class="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <span class="flex size-14 items-center justify-center rounded-md bg-muted">
          <ng-icon name="lucideChartLine" size="24" />
        </span>
        <h2 class="text-xl font-semibold">{{ 'history.empty.title' | transloco }}</h2>
        <p class="w-64 text-sm text-muted-foreground">
          {{ 'history.empty.text' | transloco }}
        </p>
      </section>
    }
  `,
})
export class HistoryListView {
  private readonly history = inject(HistoryService);
  protected readonly format = inject(HistoryFormat);
  private readonly router = inject(Router);
  /** Taken when the view opens, like the rest of the history. */
  private readonly now = inject(Clock).now();

  protected readonly weeks = computed(() => groupByWeek(this.history.summaries(), this.now));
  private readonly totals = computed(() => weekTotals(this.history.summaries(), this.now));
  protected readonly trend = computed(() => this.totals().count - this.totals().previousCount);
  protected readonly trendLabel = computed(() =>
    this.format.t('history.trend', { count: this.trend() }),
  );
  protected readonly chartTitle = computed(() => this.format.workouts(this.totals().count));
  protected readonly chartSubtitle = computed(
    () =>
      `${this.format.t('history.thisWeek')} · ${this.format.duration(this.totals().durationMs)}`,
  );
  protected readonly bars = computed(() =>
    weekBars(this.history.summaries(), this.now).map((bar) => ({
      ...bar,
      label: weekdayShort(bar.day.getDay(), this.format.locale()),
    })),
  );

  protected details(session: HistorySummary): string {
    return this.format.sessionDetails(session, this.now);
  }

  protected open(id: string): void {
    void this.router.navigate(['/history', id]);
  }
}
