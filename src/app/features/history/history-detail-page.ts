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
import { sessionDurationMs } from '../../core/history/history-stats';
import { HistoryDetail, HistoryService } from '../../core/history/history.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { Clock } from '../../core/utils/time';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { HistoryFormat } from './history-format';

/**
 * One finished workout (Figma Verlauf-Detail 84:3364): key figures, then per exercise its time and
 * the completed sets with «Rekord»/«Extra». The menu deletes the workout (soft delete).
 */
@Component({
  selector: 'app-history-detail-page',
  imports: [PageHeader, HlmBadge, HlmButton, HlmDropdownMenuImports, NgIcon, TranslocoPipe],
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

        <dl class="grid grid-cols-3 gap-3 rounded-xl border bg-card p-4">
          @for (stat of stats(); track stat.label) {
            <div class="flex min-w-0 flex-col-reverse gap-1">
              <dt class="text-xs text-muted-foreground">{{ stat.label | transloco }}</dt>
              <dd class="truncate text-xl font-semibold">{{ stat.value }}</dd>
            </div>
          }
        </dl>

        @for (exercise of d.exercises; track exercise.exerciseId + $index) {
          <section class="flex flex-col gap-3 rounded-xl border bg-card p-4">
            <header class="flex items-baseline justify-between gap-3">
              <h2 class="text-sm font-semibold">{{ catalog.nameById(exercise.exerciseId) }}</h2>
              @if (exercise.timeMs > 0) {
                <span class="shrink-0 text-xs text-muted-foreground">
                  {{ format.duration(exercise.timeMs) }}
                </span>
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

  protected readonly detail = signal<HistoryDetail | undefined>(undefined);

  protected readonly when = computed(() => {
    const summary = this.detail()?.summary;
    if (!summary) {
      return '';
    }
    const start = new Date(summary.startedAt);
    return `${this.format.day(start, this.clock.now())} · ${this.format.time(start)}`;
  });

  protected readonly stats = computed(() => {
    const summary = this.detail()?.summary;
    if (!summary) {
      return [];
    }
    return [
      { label: 'history.stats.duration', value: this.format.duration(sessionDurationMs(summary)) },
      {
        label: 'history.stats.volume',
        value: this.format.t('history.volume', { volume: this.format.number(summary.volumeKg, 0) }),
      },
      { label: 'history.stats.sets', value: String(summary.setCount) },
    ];
  });

  async ngOnInit(): Promise<void> {
    const [detail] = await Promise.all([
      this.history.detail(this.sessionId()),
      this.catalog.load(),
    ]);
    if (!detail) {
      await this.router.navigate(['/history'], { replaceUrl: true });
      return;
    }
    this.detail.set(detail);
  }

  protected back(): void {
    void this.router.navigate(['/history']);
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
      await this.router.navigate(['/history'], { replaceUrl: true });
    }
  }
}
