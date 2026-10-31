import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  Injector,
  signal,
  viewChild,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { Router } from '@angular/router';
import { KeepAwake } from '@capacitor-community/keep-awake';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon } from '@ng-icons/core';
import { HlmButton } from '@spartan-ng/helm/button';
import { SetLog } from '../../core/db/models';
import { BackButtonService } from '../../core/services/back-button.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { ExerciseCatalogService } from '../../core/exercises/exercise-catalog.service';
import { ExerciseNotesService } from '../../core/exercises/exercise-notes.service';
import { ExerciseSettingsService } from '../../core/exercises/exercise-settings.service';
import { SettingsService } from '../../core/settings/settings.service';
import { RestTimerService } from '../../core/workout/rest-timer.service';
import { isExerciseDone, WorkoutService, workoutPercent } from '../../core/workout/workout.service';
import { Clock, toUtc } from '../../core/utils/time';
import { ExerciseNoteSheet } from '../../shared/components/exercise-note/exercise-note-sheet';
import { toastAddImagesResult } from '../../shared/components/exercise-note/note-image-feedback';
import { WeightStepSheet } from '../../shared/components/weight-step/weight-step-sheet';
import { RollingNumber } from '../../shared/components/rolling-number/rolling-number';
import { SegmentProgress } from '../../shared/components/segment-progress/segment-progress';
import { StickyAction } from '../../shared/components/sticky-action/sticky-action';
import { TimerBar } from '../../shared/components/timer-bar/timer-bar';
import { formatElapsed } from '../../shared/components/workout-clock/format-elapsed';
import { WorkoutClock } from '../../shared/components/workout-clock/workout-clock';
import { CelebrationService } from '../../shared/motion/celebration.service';
import { enter, play } from '../../shared/motion/motion';
import { ExerciseCelebration } from './exercise-celebration';
import { CardioSession } from './cardio-session';
import { ExercisePage } from './exercise-page';
import { OverviewSheet } from './overview-sheet';

/** Number of `workout.praise.N` texts, one is picked at random per finished exercise. */
export const PRAISE_COUNT = 6;

/** A finished exercise being celebrated. */
interface ExerciseMoment {
  index: number;
  praise: string;
  done: number;
  total: number;
  /** Progress segment the badge flies into. */
  target: DOMRect | null;
}

/**
 * Active workout (Figma Training 56:48015 / Swipe 60:3568): one exercise per page with
 * horizontal scroll-snap; header, progress (segments plus the overall percent), timer and the
 * next button stay in place.
 * A finished exercise is celebrated once (decision 0015); when all are done, the finish button pulses.
 * Paused (decision 0023), the clock stands still, the exercises can't be touched and the user may
 * leave for the rest of the app until continuing.
 * A cardio workout without a plan (decision 0025) shows `CardioSession` instead of the pager.
 */
@Component({
  selector: 'app-workout-page',
  imports: [
    NgTemplateOutlet,
    CardioSession,
    ExercisePage,
    ExerciseCelebration,
    ExerciseNoteSheet,
    WeightStepSheet,
    OverviewSheet,
    RollingNumber,
    SegmentProgress,
    StickyAction,
    TimerBar,
    WorkoutClock,
    HlmButton,
    NgIcon,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'bg-background pt-safe px-safe fixed inset-0 z-10 flex flex-col' },
  template: `
    <ng-template #controls>
      <div class="flex shrink-0 items-center gap-2">
        <button
          type="button"
          class="flex size-11 items-center justify-center rounded-full bg-secondary text-secondary-foreground"
          [attr.aria-label]="(paused() ? 'workout.resumeWorkout' : 'workout.pause') | transloco"
          [disabled]="busy()"
          (click)="paused() ? resume() : pause()"
        >
          <ng-icon [name]="paused() ? 'lucidePlay' : 'lucidePause'" size="18" />
        </button>
        <app-workout-clock [elapsedMs]="elapsedMs()" (stop)="end()" />
      </div>
    </ng-template>

    @if (workout.workout(); as w) {
      @if (workout.standalone()) {
        <!-- Cardio without a plan (decision 0025): one activity, the clock is the stopwatch. -->
        <header class="flex h-13 shrink-0 items-center justify-between gap-2 px-4">
          <h1 class="min-w-0 truncate text-xl font-semibold">
            {{ catalog.name(w.activity ?? undefined) }}
          </h1>
          <ng-container *ngTemplateOutlet="controls" />
        </header>
        <app-cardio-session
          class="min-h-0 flex-1"
          [item]="w.exercises[0]"
          [elapsedMs]="elapsedMs()"
          [paused]="paused()"
          (leave)="leave()"
        />
        <app-sticky-action [divider]="true">
          <button hlmBtn size="lg" [disabled]="busy()" (click)="finish()">
            <ng-icon name="lucideCheck" />{{ 'workout.finish' | transloco }}
          </button>
        </app-sticky-action>
      } @else {
        <header class="flex h-13 shrink-0 items-center justify-between px-4">
          <button
            type="button"
            class="flex h-11 items-center gap-2 rounded-full bg-secondary px-3 text-sm font-semibold text-secondary-foreground disabled:opacity-50"
            [attr.aria-label]="'workout.overview' | transloco"
            [disabled]="paused()"
            (click)="overviewOpen.set(true)"
          >
            <ng-icon name="lucideList" size="18" />
            {{ current() + 1 }} / {{ w.exercises.length }}
            <ng-icon name="lucideChevronDown" size="16" />
          </button>
          <ng-container *ngTemplateOutlet="controls" />
        </header>

        <div
          class="flex shrink-0 items-center gap-3 px-4 pt-2 pb-2"
          role="progressbar"
          aria-valuemin="0"
          aria-valuemax="100"
          [attr.aria-valuenow]="percent()"
          [attr.aria-label]="'workout.progress' | transloco"
        >
          <app-segment-progress
            class="min-w-0 flex-1"
            [segments]="segments()"
            [current]="current()"
          />
          <app-rolling-number
            class="min-w-10 justify-end text-xs leading-none font-semibold text-muted-foreground"
            [text]="'workout.percent' | transloco: { percent: percent() }"
          />
        </div>

        <div class="relative flex min-h-0 flex-1 flex-col">
          <div
            #pager
            class="flex min-h-0 flex-1 snap-x snap-mandatory [scrollbar-width:none] overflow-x-auto overscroll-x-contain"
            [attr.inert]="paused() ? '' : null"
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
                  (setCompleted)="timer.autoStart($event)"
                  (exerciseCompleted)="exerciseCompleted(i)"
                  (editNote)="editNote(item.entry.exerciseId)"
                  (editWeightStep)="editWeightStep(item.entry.exerciseId)"
                />
              </section>
            }
          </div>

          <div class="shrink-0 px-4 pb-2" [attr.inert]="paused() ? '' : null">
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

          @if (paused()) {
            <div
              #pausedPanel
              class="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/90 px-6 text-center backdrop-blur-sm"
            >
              <span
                class="flex size-16 items-center justify-center rounded-full bg-secondary text-secondary-foreground"
                aria-hidden="true"
              >
                <ng-icon name="lucidePause" size="28" />
              </span>
              <h2 class="text-xl font-semibold">{{ 'workout.paused.title' | transloco }}</h2>
              <p class="text-4xl font-semibold tabular-nums">{{ elapsedText() }}</p>
              <p class="max-w-72 text-sm text-muted-foreground">
                {{ 'workout.paused.text' | transloco }}
              </p>
              <button hlmBtn variant="secondary" class="mt-3" (click)="leave()">
                <ng-icon name="lucideClipboardList" />{{ 'workout.paused.leave' | transloco }}
              </button>
            </div>
          }
        </div>

        <app-sticky-action [divider]="true">
          @if (paused()) {
            <button hlmBtn size="lg" [disabled]="busy()" (click)="resume()">
              <ng-icon name="lucidePlay" />{{ 'workout.paused.resume' | transloco }}
            </button>
          } @else if (next(); as nextItem) {
            <button #nextButton hlmBtn size="lg" (click)="goTo(current() + 1)">
              <ng-icon name="lucideArrowRight" />
              <span class="truncate">
                {{
                  'workout.next' | transloco: { name: catalog.nameById(nextItem.entry.exerciseId) }
                }}
              </span>
            </button>
          } @else {
            <button
              hlmBtn
              size="lg"
              [class.animate-attention]="allDone()"
              [disabled]="busy()"
              (click)="finish()"
            >
              <ng-icon name="lucideCheck" />{{ 'workout.finish' | transloco }}
            </button>
          }
        </app-sticky-action>

        <app-overview-sheet [(open)]="overviewOpen" />

        <app-exercise-note-sheet
          [(open)]="noteOpen"
          [title]="catalog.nameById(noteExerciseId())"
          [note]="notes.noteFor(noteExerciseId())"
          [images]="notes.imagesFor(noteExerciseId())"
          [pending]="notes.pendingFor(noteExerciseId())"
          (save)="saveNote($event)"
          (addImages)="addNoteImages($event)"
          (removeImage)="removeNoteImage($event)"
        />

        <app-weight-step-sheet
          [(open)]="stepOpen"
          [title]="catalog.nameById(stepExerciseId())"
          [unit]="unit()"
          [step]="exerciseSettings.weightStepFor(stepExerciseId(), unit())"
          (pick)="exerciseSettings.setWeightStep(stepExerciseId(), unit(), $event)"
        />

        @if (moment(); as m) {
          <app-exercise-celebration
            [praise]="(m.done === m.total ? 'workout.allDone' : m.praise) | transloco"
            [subline]="'workout.exerciseDone' | transloco: { done: m.done, total: m.total }"
            [target]="m.target"
            (landed)="landed(m.index)"
            (done)="moment.set(null)"
          />
        }
      }
    }
  `,
})
export class WorkoutPage {
  protected readonly workout = inject(WorkoutService);
  protected readonly timer = inject(RestTimerService);
  protected readonly catalog = inject(ExerciseCatalogService);
  protected readonly notes = inject(ExerciseNotesService);
  private readonly transloco = inject(TranslocoService);
  protected readonly exerciseSettings = inject(ExerciseSettingsService);
  private readonly settings = inject(SettingsService);
  protected readonly unit = computed(() => this.settings.settings().unit);
  private readonly router = inject(Router);
  private readonly confirm = inject(ConfirmService);
  private readonly celebration = inject(CelebrationService);
  private readonly clock = inject(Clock);
  private readonly pager = viewChild<ElementRef<HTMLElement>>('pager');
  private readonly progress = viewChild(SegmentProgress);
  private readonly nextButton = viewChild<ElementRef<HTMLElement>>('nextButton');
  private readonly pausedPanel = viewChild<ElementRef<HTMLElement>>('pausedPanel');
  private readonly injector = inject(Injector);
  /** Session exercises already celebrated: unchecking and re-checking does not repeat it. */
  private readonly celebrated = new Set<string>();

  protected readonly current = this.workout.current;
  protected readonly paused = this.workout.paused;
  protected readonly menuSet = signal<SetLog | null>(null);
  protected readonly overviewOpen = signal(false);
  /** Exercise whose note the sheet edits; kept after closing so the sheet can save on close. */
  protected readonly noteExerciseId = signal('');
  protected readonly noteOpen = signal(false);
  /** Exercise whose weight step the sheet picks. */
  protected readonly stepExerciseId = signal('');
  protected readonly stepOpen = signal(false);
  protected readonly busy = signal(false);
  protected readonly moment = signal<ExerciseMoment | null>(null);
  /** Refreshed every second for the workout clock; the time itself comes from the timestamps. */
  private readonly now = signal(this.clock.now().getTime());

  /** Since `startedAt` without the pauses, so the clock stands still while paused. */
  protected readonly elapsedMs = computed(() =>
    this.workout.elapsedMs(toUtc(new Date(this.now()))),
  );
  protected readonly elapsedText = computed(() => formatElapsed(this.elapsedMs()));

  protected readonly segments = computed(() =>
    (this.workout.workout()?.exercises ?? []).map(({ sets }) => ({
      done: sets.filter((s) => s.completedAt !== null).length,
      total: sets.length,
    })),
  );
  /** Share of all sets done, shown next to the segments (which stay without numbers). */
  protected readonly percent = computed(() =>
    workoutPercent(this.workout.workout()?.exercises ?? []),
  );
  protected readonly next = computed(
    () => this.workout.workout()?.exercises[this.current() + 1] ?? null,
  );
  protected readonly allDone = computed(() => {
    const exercises = this.workout.workout()?.exercises ?? [];
    return exercises.length > 0 && exercises.every((e) => isExerciseDone(e.sets));
  });
  protected readonly restSeconds = computed(
    () => this.workout.workout()?.exercises[this.current()]?.entry.restSeconds ?? 90,
  );

  constructor() {
    void this.catalog.load();
    void this.notes.load();
    void this.exerciseSettings.load();
    const destroyRef = inject(DestroyRef);

    // Android back opens the end dialog instead of leaving the workout; paused, it leaves.
    const backButton = inject(BackButtonService);
    backButton.setHandler(() => void (this.paused() ? this.leave() : this.end()));
    destroyRef.onDestroy(() => backButton.setHandler(null));

    // Keep the screen on while training, not while paused (Wake Lock API in the browser).
    effect(() => void keepAwake(!this.paused()));
    destroyRef.onDestroy(() => void keepAwake(false));

    const tick = setInterval(() => this.tick(), 1000);
    destroyRef.onDestroy(() => clearInterval(tick));

    afterNextRender(() => {
      const pager = this.pager()?.nativeElement;
      if (!pager) {
        // Without a plan there is no pager: the one activity is tracked right away (decision 0025).
        void this.workout.setCurrent(0);
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

  protected exerciseCompleted(index: number): void {
    const exercises = this.workout.workout()?.exercises ?? [];
    const entry = exercises[index]?.entry;
    if (!entry || this.celebrated.has(entry.id)) {
      return;
    }
    this.celebrated.add(entry.id);
    this.moment.set({
      index,
      praise: `workout.praise.${1 + Math.floor(Math.random() * PRAISE_COUNT)}`,
      done: exercises.filter((e) => isExerciseDone(e.sets)).length,
      total: exercises.length,
      target: this.progress()?.segmentRect(index) ?? null,
    });
  }

  /** The badge reached its segment: the segment bounces and the next button invites to go on. */
  protected landed(index: number): void {
    const progress = this.progress();
    void progress?.flash(index);
    this.celebration.collect(progress?.segmentRect(index));
    void play(
      this.nextButton()?.nativeElement,
      {
        scale: [1, 1.05, 1, 1.05, 1],
        filter: [
          'brightness(1)',
          'brightness(1.2)',
          'brightness(1)',
          'brightness(1.2)',
          'brightness(1)',
        ],
      },
      { duration: 0.9, ease: 'easeInOut' },
    );
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

  protected editNote(exerciseId: string): void {
    this.noteExerciseId.set(exerciseId);
    this.noteOpen.set(true);
  }

  protected editWeightStep(exerciseId: string): void {
    this.stepExerciseId.set(exerciseId);
    this.stepOpen.set(true);
  }

  protected saveNote(text: string): void {
    void this.notes.save(this.noteExerciseId(), text);
  }

  protected async addNoteImages(files: File[]): Promise<void> {
    toastAddImagesResult(await this.notes.addImages(this.noteExerciseId(), files), this.transloco);
  }

  protected removeNoteImage(imageId: string): void {
    void this.notes.removeImage(this.noteExerciseId(), imageId);
  }

  /** Stops the clock and the rest timer; the overlay offers to continue or to leave. */
  protected async pause(): Promise<void> {
    this.busy.set(true);
    try {
      this.timer.stop();
      await this.workout.pause();
      this.tick(); // freeze the clock at the pause, not at the last tick
    } finally {
      this.busy.set(false);
    }
    afterNextRender(
      () =>
        void enter([...(this.pausedPanel()?.nativeElement.children ?? [])], { y: 12, each: 0.05 }),
      { injector: this.injector },
    );
  }

  protected async resume(): Promise<void> {
    this.busy.set(true);
    try {
      await this.workout.resume();
      this.tick(); // a stale tick would show the clock a second behind the frozen time
    } finally {
      this.busy.set(false);
    }
  }

  /** «Zu den Plänen»: the workout stays paused; a bar above the tabs leads back to it. */
  protected async leave(): Promise<void> {
    await this.router.navigate(['/plans'], { replaceUrl: true });
  }

  protected async finish(): Promise<void> {
    this.busy.set(true);
    try {
      this.timer.stop();
      const id = await this.workout.finish();
      await this.router.navigate(['/workout/done', id], { replaceUrl: true });
    } finally {
      this.busy.set(false);
    }
  }

  /** «Beenden»: save (→ celebration), discard (→ plans, not in the history) or continue. */
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

  private tick(): void {
    this.now.set(this.clock.now().getTime());
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
