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
import {
  ExerciseSession,
  exerciseHistory,
  shares,
  StrengthKind,
} from '../../core/history/history-insights';
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

/** What the chart shows per workout. */
type ExerciseMetric = 'e1rm' | 'weight' | 'volume' | 'reps' | 'sets';

/** Exercises with weight; without weight there is no 1RM, weight or volume. */
const WEIGHT_METRICS: readonly ExerciseMetric[] = ['e1rm', 'weight', 'volume'];
const REPS_METRICS: readonly ExerciseMetric[] = ['reps', 'sets'];
/** Workouts in the chart and the per-plan trends. */
const RECENT = 12;

/**
 * Übungsverlauf (Figma 138:2082, decision 0028): how one strength exercise developed, over all
 * plans or for one. Key figures, a chart of the latest workouts, the latest workout per plan and
 * every workout with its sets. The plan filter lives in the `plan` query parameter.
 */
@Component({
  selector: 'app-exercise-history-page',
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

    @if (loaded()) {
      <div class="flex flex-col gap-4 px-4 pb-6">
        <div class="flex flex-col gap-1">
          <h1 class="text-display font-semibold break-words">{{ name() }}</h1>
          <p class="text-sm text-muted-foreground">{{ subtitle() }}</p>
        </div>

        @if (sessions().length) {
          @if (filterable()) {
            <div
              class="-mx-4 -my-1.5 flex [scrollbar-width:none] gap-2 overflow-x-auto px-4 py-1.5"
              role="radiogroup"
              data-filter="plans"
              [attr.aria-label]="'history.exercise.plans' | transloco"
            >
              <button
                type="button"
                role="radio"
                [class]="chipClass(planId() === null)"
                [attr.aria-checked]="planId() === null"
                (click)="select(null)"
              >
                {{ 'history.exercise.allPlans' | transloco }}
              </button>
              @for (plan of plans(); track plan.planId) {
                <button
                  type="button"
                  role="radio"
                  [class]="chipClass(planId() === plan.planId)"
                  [attr.aria-checked]="planId() === plan.planId"
                  (click)="select(plan.planId)"
                >
                  {{ planName(plan.planName) }}
                </button>
              }
            </div>
          }

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

          @if (byPlan().length) {
            <section class="flex flex-col gap-3 rounded-xl border bg-card p-4" data-card="by-plan">
              <div class="flex flex-col gap-1">
                <h2 class="text-sm font-semibold">{{ 'history.exercise.byPlan' | transloco }}</h2>
                <p class="text-xs text-muted-foreground">
                  {{ 'history.exercise.byPlanSubtitle' | transloco }}
                </p>
              </div>
              <ul class="flex flex-col">
                @for (row of byPlan(); track row.planId) {
                  <li class="border-b last:border-b-0">
                    <button
                      type="button"
                      class="flex min-h-12 w-full items-center gap-3 py-2 text-left"
                      (click)="select(row.planId)"
                    >
                      <span class="flex min-w-0 flex-1 flex-col gap-1">
                        <span class="truncate text-sm font-semibold">{{ row.name }}</span>
                        <span class="flex gap-2 text-xs">
                          <span class="truncate text-muted-foreground">{{ row.value }}</span>
                          @if (row.delta) {
                            <span
                              class="shrink-0 font-semibold"
                              [class]="row.up ? 'text-success' : 'text-muted-foreground'"
                            >
                              {{ row.delta }}
                            </span>
                          }
                        </span>
                      </span>
                      <app-sparkline [values]="row.series" [label]="row.name" />
                    </button>
                  </li>
                }
              </ul>
            </section>
          }

          <section class="flex flex-col gap-1">
            <h2 class="text-xl font-semibold">{{ 'history.plan.all' | transloco }}</h2>
            @for (row of rows(); track row.id) {
              <app-history-row [name]="row.name" [details]="row.details" (open)="open(row.id)" />
            }
          </section>
        }
      </div>
    }
  `,
})
export class ExerciseHistoryPage implements OnInit {
  /** Route parameter. */
  readonly exerciseId = input.required<string>();
  /** Query parameter: the plan to show; all plans without it. */
  readonly plan = input<string | undefined>();

  private readonly history = inject(HistoryService);
  private readonly catalog = inject(ExerciseCatalogService);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly viewState = inject(HistoryViewState);
  protected readonly format = inject(HistoryFormat);
  private readonly now = inject(Clock).now();

  protected readonly loaded = signal(false);
  protected readonly name = computed(() => this.catalog.nameById(this.exerciseId()));

  /** Every plan the exercise was trained in. */
  protected readonly plans = computed(
    () =>
      exerciseHistory(
        this.history.summaries(),
        this.history.facts(),
        this.exerciseId(),
        null,
        RECENT,
      ).plans,
  );
  protected readonly filterable = computed(() => this.plans().length > 1);
  private readonly chosen = linkedSignal(() => this.plan() ?? null);
  /** The chosen plan, if the exercise was trained in it and in another one; else all plans. */
  protected readonly planId = computed(() => {
    const id = this.chosen();
    return this.filterable() && this.plans().some((p) => p.planId === id) ? id : null;
  });
  private readonly view = computed(() =>
    exerciseHistory(
      this.history.summaries(),
      this.history.facts(),
      this.exerciseId(),
      this.planId(),
      RECENT,
    ),
  );
  private readonly kind = computed<StrengthKind>(() => this.view().kind);
  protected readonly sessions = computed(() => this.view().sessions);
  /** The latest workouts, oldest first. */
  private readonly recent = computed(() => this.sessions().slice(0, RECENT).reverse());

  protected readonly subtitle = computed(() => {
    const sessions = this.sessions();
    const oldest = sessions.at(-1);
    if (!oldest) {
      return this.format.t('history.exercise.empty');
    }
    const params = {
      workouts: this.format.workouts(sessions.length),
      since: this.format.monthYear(new Date(oldest.startedAt)),
    };
    const id = this.planId();
    return id === null
      ? this.format.t('history.plan.subtitle', params)
      : this.format.t('history.exercise.subtitlePlan', {
          ...params,
          plan: this.planName(this.plans().find((p) => p.planId === id)?.planName ?? ''),
        });
  });

  protected readonly figures = computed<KeyFigure[]>(() => {
    const sessions = this.sessions();
    const best = Math.max(...sessions.map((s) => s.best));
    const workouts = {
      label: this.format.t('history.stats.trainings'),
      value: String(sessions.length),
    };
    if (this.kind() === 'reps') {
      return [
        { label: this.format.t('history.exercise.bestReps'), value: this.reps(best) },
        {
          label: this.format.t('history.stats.sets'),
          value: String(sessions.reduce((sum, s) => sum + s.sets.length, 0)),
        },
        workouts,
      ];
    }
    const heaviest = Math.max(...sessions.map((s) => s.topSet.weightKg ?? 0));
    return [
      { label: this.format.t('history.exercise.best'), value: this.format.weight(best) },
      { label: this.format.t('history.exercise.heaviest'), value: this.format.weight(heaviest) },
      workouts,
    ];
  });

  /** 1RM for exercises with weight, reps without; kept when the plan changes. */
  protected readonly metric = linkedSignal<StrengthKind, ExerciseMetric>({
    source: this.kind,
    computation: (kind) => (kind === 'reps' ? 'reps' : 'e1rm'),
  });
  protected readonly metricOptions = computed(() =>
    (this.kind() === 'reps' ? REPS_METRICS : WEIGHT_METRICS).map((value) => ({
      value,
      label: this.metricLabel(value),
    })),
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
      label: i === 0 || i === recent.length - 1 ? this.format.dateShort(started(session)) : '',
      description: this.format.t('history.stats.barDay', {
        day: this.format.dateShort(started(session)),
        value: this.metricText(this.values()[i]),
      }),
    }));
  });
  /** No bar is selected after the metric or the plan changes. */
  protected readonly selectedBar = linkedSignal<unknown, number | null>({
    source: () => [this.metric(), this.planId()],
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
      : `${this.format.dayLong(started(this.recent()[index]))} · ${label}`;
  });
  protected readonly chartLabel = computed(() =>
    this.format.t('history.plan.chart', { metric: this.metricLabel(this.metric()) }),
  );
  /**
   * Change from the first to the latest workout in the chart, e.g. "+9 % seit 16. Juli". Not over
   * several plans: their workouts differ by plan, «Nach Plan» shows a trend per plan instead.
   */
  protected readonly trend = computed(() => {
    if (this.byPlan().length) {
      return null;
    }
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
        since: this.format.dateShort(started(this.recent()[0])),
      }),
      up: change > 0,
    };
  });

  /** The latest workout per plan, only while all plans are shown; a tap picks the plan. */
  protected readonly byPlan = computed(() => {
    if (this.planId() !== null || !this.filterable()) {
      return [];
    }
    const kind = this.kind();
    return this.plans().map((plan) => {
      const { latest, series } = plan;
      const diff = series.length > 1 ? series[series.length - 1] - series[0] : 0;
      const best =
        kind === 'e1rm'
          ? this.format.t('history.plan.oneRepMax', { value: this.format.weight(latest.best) })
          : this.format.t('history.plan.best', { value: this.reps(latest.best) });
      return {
        planId: plan.planId,
        name: this.planName(plan.planName),
        value:
          kind === 'e1rm'
            ? `${this.format.set(latest.topSet.weightKg, latest.topSet.reps)} · ${best}`
            : best,
        delta: this.format.delta(diff, (v) => this.format.strength(v, kind)),
        up: diff > 0,
        series,
      };
    });
  });

  /** Every workout: the day (with the plan when all plans are shown) and its sets. */
  protected readonly rows = computed(() => {
    const withPlan = this.planId() === null && this.filterable();
    return this.sessions().map((session) => {
      const day = this.format.day(started(session), this.now);
      return {
        id: session.sessionId,
        name: withPlan ? `${day} · ${this.planName(session.planName)}` : day,
        details: session.sets.map((s) => this.format.set(s.weightKg, s.reps)).join(' · '),
      };
    });
  });

  async ngOnInit(): Promise<void> {
    await Promise.all([this.history.load(), this.history.loadFacts(), this.catalog.load()]);
    this.loaded.set(true);
  }

  /** Shows one plan or all; kept in the URL so «Zurück» from a workout keeps the choice. */
  protected select(planId: string | null): void {
    this.chosen.set(planId);
    // Without a router navigation, «Zurück» still leaves to where the page was opened from.
    const path = this.location.path().split('?')[0];
    this.location.replaceState(path, planId ? `plan=${encodeURIComponent(planId)}` : '');
  }

  /** Back to wherever the exercise history was opened from (history, plan or workout). */
  protected back(): void {
    if (this.router.lastSuccessfulNavigation()?.previousNavigation) {
      this.location.back();
    } else {
      void this.router.navigate(['/history'], { queryParams: this.viewState.queryParams() });
    }
  }

  protected open(sessionId: string): void {
    void this.router.navigate(['/history', sessionId]);
  }

  /** Same look as the muscle chips of the exercise picker. */
  protected chipClass(active: boolean): string {
    return `relative flex h-8 shrink-0 items-center rounded-full px-3 text-sm font-medium after:absolute after:inset-x-0 after:-inset-y-1.5 ${
      active ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
    }`;
  }

  protected planName(name: string): string {
    return name || this.format.t('history.untitled');
  }

  private reps(value: number): string {
    return this.format.t('history.repsOnly', { reps: value });
  }

  private metricLabel(metric: ExerciseMetric): string {
    return this.format.t(`history.exercise.metric.${metric}`);
  }

  private metricText(value: number): string {
    switch (this.metric()) {
      case 'e1rm':
      case 'weight':
        return this.format.weight(value);
      case 'volume':
        return this.format.volume(value);
      case 'reps':
        return this.reps(value);
      case 'sets':
        return this.format.count(value, 'history.setOne', 'history.setCount');
    }
  }
}

function started(session: ExerciseSession): Date {
  return new Date(session.startedAt);
}

function metricValue(session: ExerciseSession, metric: ExerciseMetric): number {
  switch (metric) {
    case 'e1rm':
    case 'reps':
      return session.best;
    case 'weight':
      return session.topSet.weightKg ?? 0;
    case 'volume':
      return session.volumeKg;
    case 'sets':
      return session.sets.length;
  }
}
