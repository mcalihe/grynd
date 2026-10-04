import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  OnInit,
  signal,
} from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { ExerciseCatalogService } from '../../core/exercises/exercise-catalog.service';
import { metricValue, planHistory, shares, StatsMetric } from '../../core/history/history-insights';
import { HistorySummary, sessionDurationMs } from '../../core/history/history-stats';
import { HistoryService } from '../../core/history/history.service';
import { Clock } from '../../core/utils/time';
import { BarChart, BarChartBar } from '../../shared/components/bar-chart/bar-chart';
import { HistoryRow } from '../../shared/components/history-row/history-row';
import { KeyFigure, KeyFigures } from '../../shared/components/key-figures/key-figures';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { SegmentedControl } from '../../shared/components/segmented-control/segmented-control';
import { Sparkline } from '../../shared/components/sparkline/sparkline';
import { HistoryFormat } from './history-format';
import { HistoryViewState } from './history-view';

/** Metrics of the chart, one bar per workout. */
const METRICS: readonly StatsMetric[] = ['volume', 'duration', 'sets'];
/** Workouts in the chart and the strength trends. */
const RECENT = 12;

/**
 * Plan-Verlauf (Figma): every workout of one plan with averages, a chart of the latest workouts,
 * the strength trend per exercise and the list of workouts.
 */
@Component({
  selector: 'app-plan-history-page',
  imports: [
    PageHeader,
    KeyFigures,
    SegmentedControl,
    BarChart,
    Sparkline,
    HistoryRow,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-1 flex-col' },
  template: `
    <app-page-header variant="bar" (back)="back()" />

    @if (plan().sessions.length) {
      <div class="flex flex-col gap-4 px-4 pb-6">
        <div class="flex flex-col gap-1">
          <h1 class="text-display font-semibold break-words">
            {{ planName() || ('history.untitled' | transloco) }}
          </h1>
          <p class="text-sm text-muted-foreground">{{ subtitle() }}</p>
        </div>

        <app-key-figures class="rounded-xl border bg-card p-4" [figures]="figures()" />

        <section class="flex flex-col gap-3 rounded-xl border bg-surface-elevated p-4">
          <app-segmented-control [options]="metricOptions()" [(value)]="metric" />
          <div class="flex items-end justify-between gap-3">
            <div class="flex min-w-0 flex-col gap-1">
              <p class="text-2xl font-bold">{{ latestValue() }}</p>
              <p class="text-xs text-muted-foreground" aria-live="polite">{{ caption() }}</p>
            </div>
            @if (trend(); as trend) {
              <span
                class="shrink-0 text-sm font-semibold"
                [class]="trend.up ? 'text-success' : 'text-muted-foreground'"
              >
                {{ trend.text }}
              </span>
            }
          </div>
          <app-bar-chart
            [bars]="bars()"
            [label]="chartLabel()"
            [interactive]="true"
            [(selected)]="selectedBar"
          />
        </section>

        @if (plan().exercises.length) {
          <section class="flex flex-col gap-3 rounded-xl border bg-card p-4">
            <div class="flex flex-col gap-1">
              <h2 class="text-sm font-semibold">{{ 'history.plan.strength' | transloco }}</h2>
              <p class="text-xs text-muted-foreground">
                {{ 'history.plan.strengthSubtitle' | transloco }}
              </p>
            </div>
            <ul class="flex flex-col">
              @for (exercise of exercises(); track exercise.exerciseId) {
                <li class="flex items-center gap-3 border-b py-2 last:border-b-0">
                  <div class="flex min-w-0 flex-1 flex-col gap-1">
                    <span class="truncate text-sm font-semibold">{{ exercise.name }}</span>
                    <span class="flex gap-2 text-xs">
                      <span class="text-muted-foreground">{{ exercise.value }}</span>
                      @if (exercise.delta) {
                        <span
                          class="font-semibold"
                          [class]="exercise.up ? 'text-success' : 'text-muted-foreground'"
                        >
                          {{ exercise.delta }}
                        </span>
                      }
                    </span>
                  </div>
                  <app-sparkline [values]="exercise.series" [label]="exercise.name" />
                </li>
              }
            </ul>
          </section>
        }

        <section class="flex flex-col gap-1">
          <h2 class="text-xl font-semibold">{{ 'history.plan.all' | transloco }}</h2>
          @for (session of plan().sessions; track session.id) {
            <app-history-row
              [name]="format.day(started(session), now)"
              [details]="sessionDetails(session)"
              (open)="open(session.id)"
            />
          }
        </section>
      </div>
    }
  `,
})
export class PlanHistoryPage implements OnInit {
  /** Route parameter. */
  readonly planId = input.required<string>();

  private readonly history = inject(HistoryService);
  private readonly catalog = inject(ExerciseCatalogService);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly viewState = inject(HistoryViewState);
  protected readonly format = inject(HistoryFormat);
  protected readonly now = inject(Clock).now();

  protected readonly plan = computed(() =>
    planHistory(this.history.summaries(), this.history.facts(), this.planId(), RECENT),
  );
  /** The newest name, also for deleted or renamed plans. */
  protected readonly planName = computed(() => this.plan().sessions[0]?.planName ?? '');
  /** The latest workouts, oldest first. */
  private readonly recent = computed(() => this.plan().sessions.slice(0, RECENT).reverse());

  protected readonly subtitle = computed(() => {
    const sessions = this.plan().sessions;
    return this.format.t('history.plan.subtitle', {
      workouts: this.format.workouts(sessions.length),
      since: this.format.monthYear(this.started(sessions[sessions.length - 1])),
    });
  });
  protected readonly figures = computed<KeyFigure[]>(() => [
    {
      label: this.format.t('history.stats.trainings'),
      value: String(this.plan().sessions.length),
    },
    {
      label: this.format.t('history.stats.avgDuration'),
      value: this.format.duration(this.plan().avgDurationMs),
    },
    {
      label: this.format.t('history.stats.avgVolume'),
      value: this.format.volume(this.plan().avgVolumeKg),
    },
  ]);

  protected readonly metric = signal<StatsMetric>('volume');
  protected readonly metricOptions = computed(() =>
    METRICS.map((value) => ({ value, label: this.metricLabel(value) })),
  );
  private readonly values = computed(() =>
    this.recent().map((session) => metricValue(session, this.metric())),
  );
  protected readonly bars = computed<BarChartBar[]>(() => {
    const recent = this.recent();
    const heights = shares(this.values());
    return recent.map((session, i) => ({
      value: heights[i],
      filled: true,
      label: i === 0 || i === recent.length - 1 ? this.format.dateShort(this.started(session)) : '',
      description: this.barText(session),
    }));
  });
  /** No bar is selected after the metric changes. */
  protected readonly selectedBar = linkedSignal<StatsMetric, number | null>({
    source: this.metric,
    computation: () => null,
  });
  protected readonly latestValue = computed(() => {
    const index = this.selectedBar() ?? this.values().length - 1;
    return this.metricText(this.values()[index] ?? 0);
  });
  protected readonly caption = computed(() => {
    const index = this.selectedBar();
    const label = this.metricLabel(this.metric());
    return index === null
      ? `${this.format.t('history.plan.lastWorkout')} · ${label}`
      : `${this.format.dayLong(this.started(this.recent()[index]))} · ${label}`;
  });
  protected readonly chartLabel = computed(() =>
    this.format.t('history.plan.chart', { metric: this.metricLabel(this.metric()) }),
  );
  /** Change from the first to the latest workout in the chart, e.g. "+11 % seit 16. Juli". */
  protected readonly trend = computed(() => {
    const values = this.values();
    const first = values[0];
    if (values.length < 2 || !first) {
      return null;
    }
    const change = (values[values.length - 1] - first) / first;
    if (Math.round(change * 100) === 0) {
      return null;
    }
    const percent = new Intl.NumberFormat(this.format.locale(), {
      style: 'percent',
      signDisplay: 'exceptZero',
      maximumFractionDigits: 0,
    }).format(change);
    return {
      text: this.format.t('history.plan.trend', {
        delta: percent,
        since: this.format.dateShort(this.started(this.recent()[0])),
      }),
      up: change > 0 && this.metric() !== 'duration',
    };
  });

  protected readonly exercises = computed(() =>
    this.plan().exercises.map((exercise) => {
      const diff = exercise.latest - exercise.first;
      const value = this.format.strength(exercise.latest, exercise.kind);
      return {
        exerciseId: exercise.exerciseId,
        name: this.catalog.nameById(exercise.exerciseId),
        series: exercise.series,
        value:
          exercise.kind === 'e1rm'
            ? this.format.t('history.plan.oneRepMax', { value })
            : this.format.t('history.plan.best', { value }),
        delta: this.format.delta(diff, (v) => this.format.strength(v, exercise.kind)),
        up: diff > 0,
      };
    }),
  );

  async ngOnInit(): Promise<void> {
    await Promise.all([this.history.load(), this.history.loadFacts(), this.catalog.load()]);
    if (!this.plan().sessions.length) {
      await this.router.navigate(['/history'], { replaceUrl: true });
    }
  }

  /** Back to wherever the plan history was opened from (workout, statistics or plan). */
  protected back(): void {
    if (this.router.lastSuccessfulNavigation()?.previousNavigation) {
      this.location.back();
    } else {
      void this.router.navigate(['/history'], { queryParams: this.viewState.queryParams() });
    }
  }

  protected open(id: string): void {
    void this.router.navigate(['/history', id]);
  }

  protected started(session: HistorySummary): Date {
    return new Date(session.startedAt);
  }

  protected sessionDetails(session: HistorySummary): string {
    return [
      this.format.duration(sessionDurationMs(session)),
      this.format.volume(session.volumeKg),
      this.format.count(session.setCount, 'history.setOne', 'history.setCount'),
    ].join(' · ');
  }

  private metricLabel(metric: StatsMetric): string {
    return this.format.t(`history.stats.${metric === 'count' ? 'trainings' : metric}`);
  }

  private metricText(value: number): string {
    switch (this.metric()) {
      case 'duration':
        return this.format.duration(value);
      case 'sets':
        return this.format.count(value, 'history.setOne', 'history.setCount');
      default:
        return this.format.volume(value);
    }
  }

  private barText(session: HistorySummary): string {
    return this.format.t('history.stats.barDay', {
      day: this.format.dateShort(this.started(session)),
      value: this.metricText(metricValue(session, this.metric())),
    });
  }
}
