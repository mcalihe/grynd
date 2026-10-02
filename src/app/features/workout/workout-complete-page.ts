import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  Injector,
  input,
  OnInit,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon } from '@ng-icons/core';
import { HlmButton } from '@spartan-ng/helm/button';
import { sessionDurationMs } from '../../core/history/history-stats';
import { HistoryDetail, HistoryService } from '../../core/history/history.service';
import { BackButtonService } from '../../core/services/back-button.service';
import { StickyAction } from '../../shared/components/sticky-action/sticky-action';
import { CelebrationService } from '../../shared/motion/celebration.service';
import { countUp, EASE_OUT, enter, play, SPRING } from '../../shared/motion/motion';
import { HistoryFormat } from '../history/history-format';

/** Key figures of a finished workout, as shown on the celebration screen. */
export interface CompleteStats {
  durationMs: number;
  volumeKg: number;
  sets: number;
  records: number;
}

export function completeStats(detail: HistoryDetail): CompleteStats {
  return {
    durationMs: sessionDurationMs(detail.summary),
    volumeKg: detail.summary.volumeKg,
    sets: detail.summary.setCount,
    records: detail.exercises.reduce((n, e) => n + e.sets.filter((s) => s.record).length, 0),
  };
}

/**
 * Celebration after «Training abschliessen» (decision 0015): confetti cannons and fireworks, a
 * trophy springs in, the title rises word by word and the key figures count up. «Weiter» (and
 * Android back) leads to the history detail of the workout.
 */
@Component({
  selector: 'app-workout-complete-page',
  imports: [StickyAction, HlmButton, NgIcon, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'bg-background pt-safe px-safe fixed inset-0 z-10 flex flex-col' },
  template: `
    <div
      class="relative flex min-h-0 flex-1 flex-col items-center justify-center gap-6 overflow-x-hidden overflow-y-auto px-4 py-6"
    >
      <div
        class="pointer-events-none absolute inset-x-0 top-0 h-3/4 bg-radial-[at_50%_30%] from-primary/25 to-transparent to-70%"
        aria-hidden="true"
      ></div>

      <div class="relative flex size-52 shrink-0 items-center justify-center" aria-hidden="true">
        <span
          #rays
          class="absolute -inset-10 rounded-full bg-[repeating-conic-gradient(var(--primary)_0deg_6deg,transparent_6deg_22deg)] mask-radial-from-10% mask-radial-to-70% opacity-40 motion-safe:animate-[spin_30s_linear_infinite]"
        ></span>
        <span #halo class="absolute size-36 rounded-full bg-primary/40 blur-2xl"></span>
        <span
          #trophy
          class="relative flex size-28 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl ring-8 ring-primary/25"
        >
          <ng-icon name="lucideTrophy" size="56" strokeWidth="1.75" />
        </span>
      </div>

      @if (detail(); as d) {
        <div class="relative flex flex-col items-center gap-2 text-center">
          <h1
            class="flex flex-wrap justify-center gap-x-2.5 text-display font-bold"
            [attr.aria-label]="'workout.complete.title' | transloco"
          >
            @for (word of ('workout.complete.title' | transloco).split(' '); track $index) {
              <span #word class="inline-block" aria-hidden="true">{{ word }}</span>
            }
          </h1>
          @if (d.summary.planName) {
            <p #subtitle class="text-sm font-medium text-muted-foreground">
              {{ d.summary.planName }}
            </p>
          }
        </div>

        <dl class="relative grid w-full grid-cols-2 gap-3">
          @for (stat of stats(); track stat.key; let first = $first) {
            <div
              #card
              class="flex min-w-0 flex-col-reverse gap-1 rounded-xl border bg-card p-4"
              [class.col-span-2]="first && stats().length % 2 === 1"
              [class.border-primary]="stat.key === 'records'"
              [attr.data-stat]="stat.key"
            >
              <dt class="text-xs text-muted-foreground">{{ stat.label | transloco }}</dt>
              <dd class="truncate text-2xl font-semibold">{{ stat.text }}</dd>
            </div>
          }
        </dl>
      }
    </div>

    <app-sticky-action>
      <button hlmBtn size="lg" (click)="continue()">
        {{ 'workout.complete.continue' | transloco }}
      </button>
    </app-sticky-action>
  `,
})
export class WorkoutCompletePage implements OnInit {
  /** Route parameter. */
  readonly sessionId = input.required<string>();

  private readonly history = inject(HistoryService);
  private readonly router = inject(Router);
  private readonly celebration = inject(CelebrationService);
  private readonly format = inject(HistoryFormat);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);

  private readonly rays = viewChild.required<ElementRef<HTMLElement>>('rays');
  private readonly halo = viewChild.required<ElementRef<HTMLElement>>('halo');
  private readonly trophy = viewChild.required<ElementRef<HTMLElement>>('trophy');
  private readonly words = viewChildren<ElementRef<HTMLElement>>('word');
  private readonly subtitle = viewChild<ElementRef<HTMLElement>>('subtitle');
  private readonly cards = viewChildren<ElementRef<HTMLElement>>('card');

  protected readonly detail = signal<HistoryDetail | undefined>(undefined);
  private destroyed = false;
  private readonly totals = computed(() => {
    const detail = this.detail();
    return detail ? completeStats(detail) : undefined;
  });
  /** The values currently shown; they count up from 0 to `totals`. */
  private readonly shown = signal<CompleteStats>({
    durationMs: 0,
    volumeKg: 0,
    sets: 0,
    records: 0,
  });

  protected readonly stats = computed(() => {
    const totals = this.totals();
    if (!totals) {
      return [];
    }
    const shown = this.shown();
    const stats = [
      {
        key: 'duration',
        label: 'history.stats.duration',
        text: this.format.duration(shown.durationMs),
      },
      { key: 'volume', label: 'history.stats.volume', text: this.format.volume(shown.volumeKg) },
      { key: 'sets', label: 'history.stats.sets', text: String(Math.round(shown.sets)) },
    ];
    if (totals.records > 0) {
      stats.push({
        key: 'records',
        label: 'workout.complete.records',
        text: String(Math.round(shown.records)),
      });
    }
    return stats;
  });

  constructor() {
    const backButton = inject(BackButtonService);
    backButton.setHandler(() => void this.continue());
    this.destroyRef.onDestroy(() => {
      backButton.setHandler(null);
      this.destroyed = true;
    });
  }

  async ngOnInit(): Promise<void> {
    const detail = await this.history.detail(this.sessionId());
    if (!detail) {
      await this.router.navigate(['/history'], { replaceUrl: true });
      return;
    }
    this.detail.set(detail);
    afterNextRender(() => this.celebrate(), { injector: this.injector });
  }

  protected continue(): Promise<boolean> {
    return this.router.navigate(['/history', this.sessionId()], { replaceUrl: true });
  }

  private celebrate(): void {
    const totals = this.totals();
    if (!totals) {
      return;
    }
    const stop = this.celebration.finale();
    this.destroyRef.onDestroy(stop);

    const trophy = this.trophy().nativeElement;
    void play(
      this.rays().nativeElement,
      { scale: [0.3, 1], opacity: [0, 0.4] },
      { duration: 1.2, ease: EASE_OUT },
    );
    void play(
      this.halo().nativeElement,
      { scale: [0.2, 1.15, 1], opacity: [0, 1] },
      { duration: 0.9, ease: EASE_OUT },
    );
    void play(trophy, { scale: [0, 1], rotate: [-25, 0] }, SPRING.bouncy).then(() =>
      play(trophy, { rotate: [0, -10, 9, -5, 2, 0] }, { duration: 0.7, ease: 'easeInOut' }),
    );
    void enter(
      this.words().map((w) => w.nativeElement),
      { y: 32, delay: 0.25, each: 0.1 },
    );
    const subtitle = this.subtitle()?.nativeElement;
    void enter(subtitle ? [subtitle] : [], { y: 12, delay: 0.5 });
    void enter(
      this.cards().map((c) => c.nativeElement),
      { delay: 0.65, each: 0.1 },
    );

    const update = (patch: Partial<CompleteStats>) =>
      this.shown.update((s) => ({ ...s, ...patch }));
    const count = { duration: 1.4, delay: 0.8 };
    void countUp(totals.durationMs, (durationMs) => update({ durationMs }), count);
    void countUp(totals.volumeKg, (volumeKg) => update({ volumeKg }), { ...count, delay: 0.9 });
    void countUp(totals.sets, (sets) => update({ sets }), { ...count, delay: 1 });
    if (totals.records > 0) {
      void countUp(totals.records, (records) => update({ records }), {
        duration: 0.8,
        delay: 1.3,
      }).then(() => {
        if (this.destroyed) {
          return;
        }
        const card = this.cards().find((c) => c.nativeElement.dataset['stat'] === 'records');
        this.celebration.record(card?.nativeElement);
        void play(card?.nativeElement, { scale: [1, 1.06, 1] }, { duration: 0.4 });
      });
    }
  }
}
