import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  OnInit,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon } from '@ng-icons/core';
import { HlmBadge } from '@spartan-ng/helm/badge';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmDropdownMenuImports } from '@spartan-ng/helm/dropdown-menu';
import { ExerciseCatalogService } from '../../core/exercises/exercise-catalog.service';
import { exerciseComparison, previousSessionOfPlan } from '../../core/history/history-insights';
import { sessionDurationMs } from '../../core/history/history-stats';
import { HistoryDetail, HistoryService } from '../../core/history/history.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { Clock } from '../../core/utils/time';
import { KeyFigure, KeyFigures } from '../../shared/components/key-figures/key-figures';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { HistoryFormat } from './history-format';
import { HistoryViewState } from './history-view';

/**
 * One finished workout (Figma Verlauf-Detail 84:3364, «Vergleich»): key figures against the last
 * workout of the same plan, a link to the plan history, then per exercise its time, volume and the
 * completed sets with «Rekord»/«Extra». The menu deletes the workout (soft delete).
 */
@Component({
  selector: 'app-history-detail-page',
  imports: [
    PageHeader,
    KeyFigures,
    HlmBadge,
    HlmButton,
    HlmDropdownMenuImports,
    NgIcon,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-1 flex-col' },
  template: `
    <app-page-header variant="bar" (back)="back()">
      <ng-container headerAction>
        <button
          hlmBtn
          variant="ghost"
          size="icon"
          [hlmDropdownMenuTrigger]="menu"
          align="end"
          [attr.aria-label]="'history.menu' | transloco"
        >
          <ng-icon name="lucideEllipsis" />
        </button>
        <ng-template #menu>
          <hlm-dropdown-menu class="w-56">
            <button hlmDropdownMenuItem variant="destructive" (click)="delete()">
              {{ 'history.delete.action' | transloco }}
            </button>
          </hlm-dropdown-menu>
        </ng-template>
      </ng-container>
    </app-page-header>

    @if (detail(); as d) {
      <div class="flex flex-col gap-4 px-4 pb-6">
        <div class="flex flex-col gap-1">
          <h1 class="text-display font-semibold break-words">
            {{ d.summary.planName || ('history.untitled' | transloco) }}
          </h1>
          <p class="text-sm text-muted-foreground">{{ when() }}</p>
        </div>

        <app-key-figures class="rounded-xl border bg-card p-4" [figures]="figures()" [columns]="2">
          @if (previous()) {
            <p class="mt-4 text-xs text-muted-foreground">
              {{ 'history.compare' | transloco: { day: previousDay() } }}
            </p>
          }
        </app-key-figures>

        @if (d.summary.planId; as planId) {
          <button
            type="button"
            class="flex w-full items-center gap-3 rounded-xl border bg-card py-3 pr-3 pl-4 text-left"
            (click)="openPlan(planId)"
          >
            <span
              class="flex size-10 shrink-0 items-center justify-center rounded-md bg-secondary text-secondary-foreground"
              aria-hidden="true"
            >
              <ng-icon name="lucideChartLine" size="24" />
            </span>
            <span class="flex min-w-0 flex-1 flex-col gap-1">
              <span class="truncate text-sm font-semibold">{{ planTitle() }}</span>
              <span class="truncate text-xs text-muted-foreground">{{ planDetails() }}</span>
            </span>
            <ng-icon name="lucideChevronRight" size="20" aria-hidden="true" />
          </button>
        }

        @for (exercise of d.exercises; track exercise.exerciseId + $index) {
          <section class="flex flex-col gap-3 rounded-xl border bg-card p-4">
            <header class="flex flex-col gap-1">
              <div class="flex items-baseline justify-between gap-3">
                <h2 class="text-sm font-semibold">{{ catalog.nameById(exercise.exerciseId) }}</h2>
                @if (exercise.timeMs > 0) {
                  <span class="shrink-0 text-xs text-muted-foreground">
                    {{ format.duration(exercise.timeMs) }}
                  </span>
                }
              </div>
              @if (volumes().get(exercise.exerciseId); as volume) {
                <p class="flex gap-2 text-xs">
                  <span class="text-muted-foreground">
                    {{ 'history.exerciseVolume' | transloco: { volume: volume.value } }}
                  </span>
                  @if (volume.delta) {
                    <span
                      class="font-semibold"
                      [class]="volume.up ? 'text-success' : 'text-muted-foreground'"
                    >
                      {{ volume.delta }}
                    </span>
                  }
                </p>
              }
            </header>
            <ol class="flex flex-col">
              @for (set of exercise.sets; track set.id; let i = $index) {
                <li class="flex min-h-8 items-center gap-3 text-sm">
                  <span class="w-4 text-muted-foreground">{{ i + 1 }}</span>
                  <span class="flex-1">{{ format.set(set.weightKg, set.reps) }}</span>
                  @if (set.record) {
                    <span hlmBadge variant="success">{{ 'history.record' | transloco }}</span>
                  } @else if (set.isExtra) {
                    <span hlmBadge variant="secondary">{{ 'history.extra' | transloco }}</span>
                  }
                </li>
              }
            </ol>
          </section>
        }
      </div>
    }
  `,
})
export class HistoryDetailPage implements OnInit {
  /** Route parameter. */
  readonly sessionId = input.required<string>();

  private readonly history = inject(HistoryService);
  private readonly router = inject(Router);
  private readonly confirm = inject(ConfirmService);
  private readonly clock = inject(Clock);
  protected readonly catalog = inject(ExerciseCatalogService);
  protected readonly format = inject(HistoryFormat);
  private readonly viewState = inject(HistoryViewState);

  protected readonly detail = signal<HistoryDetail | undefined>(undefined);

  protected readonly when = computed(() => {
    const summary = this.detail()?.summary;
    if (!summary) {
      return '';
    }
    const start = new Date(summary.startedAt);
    return `${this.format.day(start, this.clock.now())} · ${this.format.time(start)}`;
  });

  /** The last workout of the same plan before this one; the deltas compare against it. */
  protected readonly previous = computed(() => {
    const summary = this.detail()?.summary;
    return summary ? previousSessionOfPlan(this.history.summaries(), summary) : undefined;
  });
  protected readonly previousDay = computed(() => {
    const previous = this.previous();
    return previous ? this.format.day(new Date(previous.startedAt), this.clock.now()) : '';
  });

  protected readonly figures = computed<KeyFigure[]>(() => {
    const detail = this.detail();
    if (!detail) {
      return [];
    }
    const { summary } = detail;
    const before = this.previous();
    const duration = before ? sessionDurationMs(summary) - sessionDurationMs(before) : 0;
    const volume = before ? summary.volumeKg - before.volumeKg : 0;
    const sets = before ? summary.setCount - before.setCount : 0;
    const records = detail.exercises.flatMap((e) => e.sets).filter((s) => s.record).length;
    return [
      {
        label: this.format.t('history.stats.duration'),
        value: this.format.duration(sessionDurationMs(summary)),
        delta: this.format.delta(duration, (ms) => this.format.duration(ms)),
        tone: 'neutral',
      },
      {
        label: this.format.t('history.stats.volume'),
        value: this.format.volume(summary.volumeKg),
        delta: this.format.delta(volume, (kg) => this.format.volume(kg)),
        tone: this.format.tone(volume),
      },
      {
        label: this.format.t('history.stats.sets'),
        value: String(summary.setCount),
        delta: this.format.delta(sets, String),
        tone: this.format.tone(sets),
      },
      { label: this.format.t('history.stats.records'), value: String(records) },
    ];
  });

  /** Volume per exercise and the change since the exercise was last trained. */
  protected readonly volumes = computed(() => {
    const volumes = new Map<string, { value: string; delta: string; up: boolean }>();
    for (const [exerciseId, c] of exerciseComparison(this.history.facts(), this.sessionId())) {
      const diff = c.previousVolumeKg === null ? 0 : c.volumeKg - c.previousVolumeKg;
      volumes.set(exerciseId, {
        value: this.format.volume(c.volumeKg),
        delta: this.format.delta(diff, (kg) => this.format.volume(kg)),
        up: diff > 0,
      });
    }
    return volumes;
  });

  protected readonly planTitle = computed(() =>
    this.format.t('history.planLink.title', {
      plan: this.detail()?.summary.planName || this.format.t('history.untitled'),
    }),
  );
  protected readonly planDetails = computed(() => {
    const planId = this.detail()?.summary.planId;
    const count = this.history.summaries().filter((s) => s.planId === planId).length;
    return this.format.t('history.planLink.details', { workouts: this.format.workouts(count) });
  });

  async ngOnInit(): Promise<void> {
    const [detail] = await Promise.all([
      this.history.detail(this.sessionId()),
      this.catalog.load(),
      this.history.load(),
      this.history.loadFacts(),
    ]);
    if (!detail) {
      await this.router.navigate(['/history'], { replaceUrl: true });
      return;
    }
    this.detail.set(detail);
  }

  protected openPlan(planId: string): void {
    void this.router.navigate(['/history/plans', planId]);
  }

  /** Back to the history tab the workout was opened from. */
  protected back(): void {
    void this.router.navigate(['/history'], { queryParams: this.viewState.queryParams() });
  }

  protected async delete(): Promise<void> {
    const confirmed = await this.confirm.confirm({
      title: 'history.delete.title',
      message: 'history.delete.text',
      confirm: 'history.delete.confirm',
      cancel: 'common.cancel',
      destructive: true,
    });
    if (confirmed) {
      await this.history.delete(this.sessionId());
      await this.router.navigate(['/history'], {
        queryParams: this.viewState.queryParams(),
        replaceUrl: true,
      });
    }
  }
}
