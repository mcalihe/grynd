import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { KeepAwake } from '@capacitor-community/keep-awake';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon } from '@ng-icons/core';
import { HlmButton } from '@spartan-ng/helm/button';
import { SetLog } from '../../core/db/models';
import { BackButtonService } from '../../core/services/back-button.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { ExerciseCatalogService } from '../../core/exercises/exercise-catalog.service';
import { RestTimerService } from '../../core/workout/rest-timer.service';
import { WorkoutService } from '../../core/workout/workout.service';
import { SegmentProgress } from '../../shared/components/segment-progress/segment-progress';
import { StickyAction } from '../../shared/components/sticky-action/sticky-action';
import { TimerBar } from '../../shared/components/timer-bar/timer-bar';
import { ExercisePage } from './exercise-page';
import { OverviewSheet } from './overview-sheet';

/**
 * Active workout (Figma Training 56:48015 / Swipe 60:3568): one exercise per page with
 * horizontal scroll-snap; header, progress, timer and the next button stay in place.
 */
@Component({
  selector: 'app-workout-page',
  imports: [
    ExercisePage,
    OverviewSheet,
    SegmentProgress,
    StickyAction,
    TimerBar,
    HlmButton,
    NgIcon,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'bg-background pt-safe px-safe fixed inset-0 z-10 flex flex-col' },
  template: `
    @if (workout.workout(); as w) {
      <header class="flex h-13 shrink-0 items-center justify-between px-4">
        <button
          type="button"
          class="flex h-11 items-center gap-2 rounded-full bg-secondary px-3 text-sm font-semibold text-secondary-foreground"
          [attr.aria-label]="'workout.overview' | transloco"
          (click)="overviewOpen.set(true)"
        >
          <ng-icon name="lucideList" size="18" />
          {{ current() + 1 }} / {{ w.exercises.length }}
          <ng-icon name="lucideChevronDown" size="16" />
        </button>
        <button hlmBtn variant="ghost" size="sm" (click)="end()">
          <ng-icon name="lucideX" />{{ 'workout.end' | transloco }}
        </button>
      </header>

      <app-segment-progress
        class="shrink-0 px-4 pt-2 pb-2"
        [segments]="segments()"
        [current]="current()"
      />

      <div
        #pager
        class="flex min-h-0 flex-1 snap-x snap-mandatory [scrollbar-width:none] overflow-x-auto overscroll-x-contain"
      >
        @for (item of w.exercises; track item.entry.id; let i = $index) {
          <section
            class="w-full shrink-0 snap-start snap-always overflow-y-auto"
            [attr.data-index]="i"
            [attr.aria-label]="catalog.nameById(item.entry.exerciseId)"
          >
            <app-exercise-page
              [item]="item"
              [index]="i"
              [menuSetId]="menuSet()?.id ?? null"
              [isLast]="i === w.exercises.length - 1"
              (setMenu)="menuSet.set($event)"
              (moveBack)="moveBack(i, $event)"
              (setCompleted)="timer.start($event)"
            />
          </section>
        }
      </div>

      <div class="shrink-0 px-4 pb-2">
        <app-timer-bar
          [running]="timer.running()"
          [remainingMs]="timer.remainingMs()"
          [totalMs]="timer.totalMs()"
          [durationSec]="restSeconds()"
          (start)="timer.start(restSeconds())"
          (stop)="timer.stop()"
          (adjust)="timer.adjust($event)"
          (durationChange)="workout.setRestSeconds(current(), $event)"
        />
      </div>

      <app-sticky-action [divider]="true">
        @if (next(); as nextItem) {
          <button hlmBtn size="lg" (click)="goTo(current() + 1)">
            <ng-icon name="lucideArrowRight" />
            <span class="truncate">
              {{
                'workout.next' | transloco: { name: catalog.nameById(nextItem.entry.exerciseId) }
              }}
            </span>
          </button>
        } @else {
          <button hlmBtn size="lg" [disabled]="busy()" (click)="finish()">
            <ng-icon name="lucideCheck" />{{ 'workout.finish' | transloco }}
          </button>
        }
      </app-sticky-action>

      <app-overview-sheet [(open)]="overviewOpen" />
    }
  `,
})
export class WorkoutPage {
  protected readonly workout = inject(WorkoutService);
  protected readonly timer = inject(RestTimerService);
  protected readonly catalog = inject(ExerciseCatalogService);
  private readonly router = inject(Router);
  private readonly confirm = inject(ConfirmService);
  private readonly pager = viewChild<ElementRef<HTMLElement>>('pager');

  protected readonly current = this.workout.current;
  protected readonly menuSet = signal<SetLog | null>(null);
  protected readonly overviewOpen = signal(false);
  protected readonly busy = signal(false);

  protected readonly segments = computed(() =>
    (this.workout.workout()?.exercises ?? []).map(({ sets }) => ({
      done: sets.filter((s) => s.completedAt !== null).length,
      total: sets.length,
    })),
  );
  protected readonly next = computed(
    () => this.workout.workout()?.exercises[this.current() + 1] ?? null,
  );
  protected readonly restSeconds = computed(
    () => this.workout.workout()?.exercises[this.current()]?.entry.restSeconds ?? 90,
  );

  constructor() {
    void this.catalog.load();
    const destroyRef = inject(DestroyRef);

    // Android back opens the end dialog instead of leaving the workout.
    const backButton = inject(BackButtonService);
    backButton.setHandler(() => void this.end());
    destroyRef.onDestroy(() => backButton.setHandler(null));

    // Keep the screen on while training (Wake Lock API in the browser, if supported).
    void keepAwake(true);
    destroyRef.onDestroy(() => void keepAwake(false));

    afterNextRender(() => {
      const pager = this.pager()?.nativeElement;
      if (!pager) {
        return;
      }
      this.scrollTo(this.current(), 'instant');
      // The page that is mostly visible becomes the current exercise (starts its time interval).
      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              void this.workout.setCurrent(Number((entry.target as HTMLElement).dataset['index']));
            }
          }
        },
        { root: pager, threshold: 0.6 },
      );
      pager.querySelectorAll('section[data-index]').forEach((page) => observer.observe(page));
      destroyRef.onDestroy(() => observer.disconnect());
    });

    // Keep the pager in sync when the current exercise changes elsewhere (overview, reorder).
    effect(() => {
      const index = this.current();
      queueMicrotask(() => this.scrollTo(index, 'smooth'));
    });
  }

  protected goTo(index: number): void {
    this.scrollTo(index, 'smooth');
  }

  /**
   * «1 nach hinten» (1) / «Ans Ende» (-1). The page position stays, so the user now sees the
   * exercise that moved up, which is usually the point of moving one back.
   */
  protected async moveBack(index: number, how: 1 | -1): Promise<void> {
    const last = (this.workout.workout()?.exercises.length ?? 1) - 1;
    await this.workout.moveExercise(index, how === 1 ? index + 1 : last);
    await this.workout.setCurrent(index);
  }

  protected async finish(): Promise<void> {
    this.busy.set(true);
    try {
      this.timer.stop();
      const id = await this.workout.finish();
      await this.router.navigate(['/history', id], { replaceUrl: true });
    } finally {
      this.busy.set(false);
    }
  }

  /** «Beenden»: save (→ history detail), discard (→ plans, not in the history) or continue. */
  protected async end(): Promise<void> {
    const choice = await this.confirm.choose({
      title: 'workout.endDialog.title',
      message: 'workout.endDialog.text',
      confirm: 'workout.endDialog.save',
      alternative: 'workout.endDialog.discard',
      alternativeDestructive: true,
      cancel: 'workout.endDialog.continue',
    });
    if (choice === 'confirm') {
      await this.finish();
    } else if (choice === 'alternative') {
      this.timer.stop();
      await this.workout.abort();
      await this.router.navigate(['/plans'], { replaceUrl: true });
    }
  }

  private scrollTo(index: number, behavior: ScrollBehavior): void {
    const page = this.pager()?.nativeElement.querySelector<HTMLElement>(
      `section[data-index="${index}"]`,
    );
    const pager = this.pager()?.nativeElement;
    if (page && pager && Math.abs(pager.scrollLeft - page.offsetLeft) > 2) {
      pager.scrollTo({ left: page.offsetLeft, behavior });
    }
  }
}

async function keepAwake(on: boolean): Promise<void> {
  try {
    if ((await KeepAwake.isSupported()).isSupported) {
      await (on ? KeepAwake.keepAwake() : KeepAwake.allowSleep());
    }
  } catch {
    // Not critical: the screen may just turn off.
  }
}
