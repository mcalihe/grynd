import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  linkedSignal,
  OnInit,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon } from '@ng-icons/core';
import { HlmBadge } from '@spartan-ng/helm/badge';
import { HlmButton } from '@spartan-ng/helm/button';
import { ExerciseCatalogService } from '../../core/exercises/exercise-catalog.service';
import {
  bucketSeries,
  comparableRange,
  DateRange,
  exerciseProgress,
  muscleGroupSets,
  periodBuckets,
  periodRange,
  periodTotals,
  planBreakdown,
  recordsBySession,
  shares,
  StatsMetric,
  StatsPeriod,
  trainingsPerWeek,
  weekStreak,
} from '../../core/history/history-insights';
import { HistoryService } from '../../core/history/history.service';
import { Clock } from '../../core/utils/time';
import { BarChart, BarChartBar } from '../../shared/components/bar-chart/bar-chart';
import { DonutChart, DonutSegment } from '../../shared/components/donut-chart/donut-chart';
import { KeyFigure, KeyFigures } from '../../shared/components/key-figures/key-figures';
import { PeriodPager } from '../../shared/components/period-pager/period-pager';
import { SegmentedControl } from '../../shared/components/segmented-control/segmented-control';
import { HistoryFormat } from './history-format';

/** Tiles of the overview, in order; tapping one shows it in the chart. */
const METRICS: readonly StatsMetric[] = ['count', 'duration', 'volume', 'sets'];
const PERIODS: readonly StatsPeriod[] = ['week', 'month', 'year'];
/** Exercises in the strength card before «Alle anzeigen». */
const STRENGTH_PREVIEW = 5;

/**
 * Verlauf · Statistik (Figma): a period with key figures and a chart, then strength, muscle groups,
 * consistency and plans. Everything is computed from the history in memory (decision 0016).
 */
@Component({
  selector: 'app-history-stats-view',
  imports: [
    SegmentedControl,
    PeriodPager,
    KeyFigures,
    BarChart,
    DonutChart,
    HlmBadge,
    HlmButton,
    NgIcon,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-4' },
  template: `
    <section class="flex flex-col gap-3 rounded-xl border bg-surface-elevated p-4">
      <app-segmented-control
        [attr.aria-label]="'history.period.label' | transloco"
        [options]="periodOptions()"
        [(value)]="period"
      />
      <app-period-pager
        [label]="format.period(period(), range(), offset())"
        [previousLabel]="'history.period.previous' | transloco"
        [nextLabel]="'history.period.next' | transloco"
        [canPrevious]="canPrevious()"
        [canNext]="offset() > 0"
        (previous)="offset.set(offset() + 1)"
        (next)="offset.set(offset() - 1)"
      />
      <app-key-figures
        [figures]="tiles()"
        [columns]="2"
        [selectable]="true"
        [(selected)]="metricIndex"
      />
      <app-bar-chart
        [bars]="bars()"
        [label]="chartLabel()"
        [emptyHeight]="period() === 'month' ? 4 : 12"
        [interactive]="true"
        [(selected)]="selectedBar"
      />
      <p class="text-xs text-muted-foreground" aria-live="polite">{{ chartCaption() }}</p>
    </section>

    @if (!totals().count) {
      <p class="py-2 text-center text-sm text-muted-foreground">
        {{ 'history.stats.empty' | transloco }}
      </p>
    } @else if (history.factsLoaded()) {
      @if (strength().length) {
        <section class="flex flex-col gap-3 rounded-xl border bg-card p-4">
          <header class="flex items-start gap-3">
            <div class="flex min-w-0 flex-1 flex-col gap-1">
              <h2 class="text-sm font-semibold">
                {{ 'history.stats.strength.title' | transloco }}
              </h2>
              <p class="text-xs text-muted-foreground">
                {{ 'history.stats.strength.subtitle' | transloco }}
              </p>
            </div>
            @if (totals().records) {
              <span hlmBadge variant="success">{{ recordsText() }}</span>
            }
          </header>
          <ul class="flex flex-col">
            @for (item of visibleStrength(); track item.exerciseId) {
              <li class="flex items-center gap-3 border-b py-2 last:border-b-0">
                <div class="flex min-w-0 flex-1 flex-col gap-1">
                  <span class="truncate text-sm font-semibold">
                    {{ catalog.nameById(item.exerciseId) }}
                  </span>
                  <span class="text-xs text-muted-foreground">{{ item.details }}</span>
                </div>
                <div class="flex shrink-0 flex-col items-end gap-1">
                  <span class="text-sm font-semibold">{{ item.value }}</span>
                  @if (item.delta) {
                    <span
                      class="text-xs font-semibold"
                      [class]="item.up ? 'text-success' : 'text-muted-foreground'"
                    >
                      {{ item.delta }}
                    </span>
                  }
                </div>
              </li>
            }
          </ul>
          @if (strength().length > preview) {
            <button hlmBtn variant="secondary" (click)="showAll.set(!showAll())">
              {{
                showAll()
                  ? ('history.stats.strength.showLess' | transloco)
                  : ('history.stats.strength.showAll' | transloco: { count: strength().length })
              }}
            </button>
          }
        </section>
      }

      @if (muscleTotal()) {
        <section class="flex flex-col gap-3 rounded-xl border bg-card p-4">
          <div class="flex flex-col gap-1">
            <h2 class="text-sm font-semibold">{{ 'history.stats.muscles.title' | transloco }}</h2>
            <p class="text-xs text-muted-foreground">{{ musclesSubtitle() }}</p>
          </div>
          <app-donut-chart
            [segments]="muscles()"
            [totalLabel]="'history.stats.muscles.total' | transloco"
          />
        </section>
      }
    }

    <section class="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <h2 class="text-sm font-semibold">{{ 'history.stats.consistency.title' | transloco }}</h2>
      <app-key-figures [figures]="consistency()" [columns]="2" />
    </section>

    @if (plans().length) {
      <section class="flex flex-col gap-1 rounded-xl border bg-card p-4">
        <h2 class="text-sm font-semibold">{{ 'history.stats.plans.title' | transloco }}</h2>
        @for (plan of plans(); track plan.planId) {
          <button
            type="button"
            class="flex min-h-14 w-full items-center gap-3 border-b py-2 text-left last:border-b-0"
            [disabled]="!plan.planId"
            (click)="openPlan(plan.planId)"
          >
            <span
              class="flex size-10 shrink-0 items-center justify-center rounded-md bg-secondary text-secondary-foreground"
              aria-hidden="true"
            >
              <ng-icon name="lucideClipboardList" size="24" />
            </span>
            <span class="flex min-w-0 flex-1 flex-col gap-1">
              <span class="truncate text-sm font-semibold">
                {{ plan.planName || ('history.untitled' | transloco) }}
              </span>
              <span class="truncate text-xs text-muted-foreground">{{ plan.details }}</span>
            </span>
            @if (plan.planId) {
              <ng-icon name="lucideChevronRight" size="20" aria-hidden="true" />
            }
          </button>
        }
      </section>
    }
  `,
})
export class HistoryStatsView implements OnInit {
  protected readonly history = inject(HistoryService);
  protected readonly catalog = inject(ExerciseCatalogService);
  protected readonly format = inject(HistoryFormat);
  private readonly router = inject(Router);
  private readonly now = inject(Clock).now();

  protected readonly preview = STRENGTH_PREVIEW;
  protected readonly period = signal<StatsPeriod>('month');
  /** Periods before the current one; back to the current period when the period type changes. */
  protected readonly offset = linkedSignal<StatsPeriod, number>({
    source: this.period,
    computation: () => 0,
  });
  protected readonly metricIndex = signal(METRICS.indexOf('volume'));
  protected readonly showAll = signal(false);

  protected readonly range = computed(() => periodRange(this.period(), this.offset(), this.now));
  /** The period before, up to the same point when the current one is still running. */
  private readonly previousRange = computed(() =>
    comparableRange(
      periodRange(this.period(), this.offset() + 1, this.now),
      this.range(),
      this.now,
    ),
  );
  private readonly records = computed(() => recordsBySession(this.history.facts()));
  protected readonly totals = computed(() =>
    periodTotals(this.history.summaries(), this.range(), this.records()),
  );
  private readonly previousTotals = computed(() =>
    periodTotals(this.history.summaries(), this.previousRange(), this.records()),
  );

  protected readonly periodOptions = computed(() =>
    PERIODS.map((value) => ({ value, label: this.format.t(`history.period.${value}`) })),
  );
  protected readonly canPrevious = computed(() => {
    const first = this.history.summaries().at(-1);
    return !!first && Date.parse(first.startedAt) < this.range().start.getTime();
  });

  protected readonly tiles = computed<KeyFigure[]>(() => {
    const now = this.totals();
    const before = this.previousTotals();
    const count = now.count - before.count;
    const duration = now.durationMs - before.durationMs;
    const volume = now.volumeKg - before.volumeKg;
    const sets = now.setCount - before.setCount;
    return [
      {
        label: this.format.t('history.stats.trainings'),
        value: String(now.count),
        delta: this.format.delta(count, String),
        tone: this.format.tone(count),
      },
      {
        label: this.format.t('history.stats.duration'),
        value: this.format.duration(now.durationMs),
        delta: this.format.delta(duration, (ms) => this.format.duration(ms)),
        tone: 'neutral',
      },
      {
        label: this.format.t('history.stats.volume'),
        value: this.format.volume(now.volumeKg),
        delta: this.format.delta(volume, (kg) => this.format.volume(kg)),
        tone: this.format.tone(volume),
      },
      {
        label: this.format.t('history.stats.sets'),
        value: String(now.setCount),
        delta: this.format.delta(sets, String),
        tone: this.format.tone(sets),
      },
    ];
  });

  private readonly metric = computed(() => METRICS[this.metricIndex()]);
  private readonly buckets = computed(() => periodBuckets(this.period(), this.range()));
  private readonly series = computed(() =>
    bucketSeries(this.history.summaries(), this.buckets(), this.metric()),
  );
  protected readonly bars = computed<BarChartBar[]>(() => {
    const values = this.series();
    const heights = shares(values);
    return this.buckets().map((bucket, i) => ({
      value: heights[i],
      filled: values[i] > 0,
      label: this.axisLabel(bucket, i),
      description: this.barText(bucket, values[i]),
    }));
  });
  /** No bar is selected after the period or the metric changes. */
  protected readonly selectedBar = linkedSignal<unknown, number | null>({
    source: () => [this.range(), this.metric()],
    computation: () => null,
  });
  protected readonly chartLabel = computed(() =>
    this.format.t('history.stats.chart', {
      metric: this.tiles()[this.metricIndex()].label,
      period: this.format.period(this.period(), this.range(), this.offset()),
    }),
  );
  protected readonly chartCaption = computed(() => {
    const index = this.selectedBar();
    return index === null ? this.chartLabel() : this.bars()[index].description;
  });

  protected readonly strength = computed(() =>
    exerciseProgress(this.history.facts(), this.range()).map((item) => {
      const diff = item.bestBefore === null ? 0 : item.best - item.bestBefore;
      return {
        exerciseId: item.exerciseId,
        details: `${this.format.workouts(item.sessions)} · ${this.setsText(item.sets)}`,
        value: this.format.strength(item.best, item.kind),
        delta: this.format.delta(diff, (v) => this.format.strength(v, item.kind)),
        up: diff > 0,
      };
    }),
  );
  protected readonly visibleStrength = computed(() =>
    this.showAll() ? this.strength() : this.strength().slice(0, STRENGTH_PREVIEW),
  );
  protected readonly recordsText = computed(() =>
    this.format.count(
      this.totals().records,
      'history.stats.strength.recordOne',
      'history.stats.strength.records',
    ),
  );

  protected readonly muscles = computed<DonutSegment[]>(() => {
    const byId = this.catalog.byId();
    return muscleGroupSets(
      this.history.facts(),
      this.range(),
      (id) => byId.get(id)?.muscleGroup ?? null,
    ).map(({ group, sets }) => ({
      key: group,
      label: this.format.t(`muscles.${group}`),
      value: sets,
      color: `var(--muscle-${group})`,
    }));
  });
  protected readonly muscleTotal = computed(() =>
    this.muscles().reduce((sum, segment) => sum + segment.value, 0),
  );
  protected readonly musclesSubtitle = computed(() =>
    this.format.t('history.stats.muscles.subtitle', {
      period: this.format.period(this.period(), this.range(), this.offset()),
    }),
  );

  protected readonly consistency = computed<KeyFigure[]>(() => {
    const streak = weekStreak(this.history.summaries(), this.now);
    const { count, durationMs } = this.totals();
    return [
      {
        label: this.format.t('history.stats.consistency.current'),
        value: this.weeks(streak.current),
      },
      {
        label: this.format.t('history.stats.consistency.longest'),
        value: this.weeks(streak.longest),
      },
      {
        label: this.format.t('history.stats.consistency.perWeek'),
        value: this.format.number(trainingsPerWeek(count, this.range(), this.now), 1),
      },
      {
        label: this.format.t('history.stats.avgDuration'),
        value: count ? this.format.duration(durationMs / count) : '–',
      },
    ];
  });

  protected readonly plans = computed(() =>
    planBreakdown(this.history.summaries(), this.range()).map((plan) => ({
      ...plan,
      details: this.format.t('history.stats.plans.details', {
        workouts: this.format.workouts(plan.count),
        duration: this.format.duration(plan.durationMs / plan.count),
      }),
    })),
  );

  ngOnInit(): void {
    void this.history.loadFacts();
    void this.catalog.load();
  }

  protected openPlan(planId: string | null): void {
    if (planId) {
      void this.router.navigate(['/history/plans', planId]);
    }
  }

  /** Weekday letters for a week, every 7th day of a month, month letters for a year. */
  private axisLabel(bucket: DateRange, index: number): string {
    const locale = this.format.locale();
    switch (this.period()) {
      case 'week':
        return new Intl.DateTimeFormat(locale, { weekday: 'short' })
          .format(bucket.start)
          .replace('.', '')
          .slice(0, 2);
      case 'month':
        return index % 7 === 0 ? String(bucket.start.getDate()) : '';
      case 'year':
        return new Intl.DateTimeFormat(locale, { month: 'narrow' }).format(bucket.start);
    }
  }

  private barText(bucket: DateRange, value: number): string {
    const locale = this.format.locale();
    const day =
      this.period() === 'year'
        ? this.format.monthYear(bucket.start)
        : new Intl.DateTimeFormat(locale, {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
          }).format(bucket.start);
    return this.format.t('history.stats.barDay', { day, value: this.metricText(value) });
  }

  private metricText(value: number): string {
    switch (this.metric()) {
      case 'count':
        return this.format.workouts(value);
      case 'duration':
        return this.format.duration(value);
      case 'volume':
        return this.format.volume(value);
      case 'sets':
        return this.setsText(value);
    }
  }

  private setsText(count: number): string {
    return this.format.count(count, 'history.setOne', 'history.setCount');
  }

  private weeks(count: number): string {
    return this.format.count(count, 'history.weekOne', 'history.weeks');
  }
}
