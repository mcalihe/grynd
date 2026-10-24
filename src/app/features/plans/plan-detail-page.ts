import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  OnInit,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon } from '@ng-icons/core';
import { HlmButton } from '@spartan-ng/helm/button';
import { ExerciseCatalogService } from '../../core/exercises/exercise-catalog.service';
import { ExerciseNotesService } from '../../core/exercises/exercise-notes.service';
import { ExerciseSettingsService } from '../../core/exercises/exercise-settings.service';
import { sessionDurationMs } from '../../core/history/history-stats';
import { HistoryService } from '../../core/history/history.service';
import { PlanDraft } from '../../core/plans/plan-draft';
import { PlansService } from '../../core/plans/plans.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { SettingsService } from '../../core/settings/settings.service';
import { weightStepLabel } from '../../core/units/weight';
import { Clock } from '../../core/utils/time';
import { WorkoutService } from '../../core/workout/workout.service';
import { ExerciseNote } from '../../shared/components/exercise-note/exercise-note';
import { ExerciseNoteSheet } from '../../shared/components/exercise-note/exercise-note-sheet';
import { toastAddImagesResult } from '../../shared/components/exercise-note/note-image-feedback';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { StickyAction } from '../../shared/components/sticky-action/sticky-action';
import { WeekdayChips } from '../../shared/components/weekday-chips/weekday-chips';
import { WeightStepSheet } from '../../shared/components/weight-step/weight-step-sheet';
import { HistoryFormat } from '../history/history-format';
import { PlanExerciseRow, targetSummary } from './plan-exercise-row';

/**
 * Read-only plan view with «Bearbeiten» and «Training starten» (Figma 37:27708, decision 0010).
 * Exercise notes and weight steps are not plan data, so they can be edited here directly
 * (decisions 0019, 0021, 0022).
 */
@Component({
  selector: 'app-plan-detail-page',
  imports: [
    PageHeader,
    StickyAction,
    WeekdayChips,
    PlanExerciseRow,
    ExerciseNote,
    ExerciseNoteSheet,
    WeightStepSheet,
    HlmButton,
    NgIcon,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-1 flex-col' },
  template: `
    <app-page-header variant="bar" (back)="back()">
      <button headerAction hlmBtn variant="ghost" size="sm" (click)="edit()">
        {{ 'plans.editAction' | transloco }}
      </button>
    </app-page-header>

    @if (plan(); as plan) {
      <div class="flex flex-1 flex-col gap-4 px-4 pb-4">
        <h1 class="text-display font-semibold break-words">{{ plan.name }}</h1>

        <section class="flex flex-col gap-2">
          <h2 class="text-sm font-medium text-muted-foreground">
            {{ 'plans.weekdays' | transloco }}
          </h2>
          <app-weekday-chips [value]="plan.weekdays" [readonly]="true" />
        </section>

        @if (planHistory(); as history) {
          <section class="flex flex-col gap-2">
            <h2 class="text-sm font-medium text-muted-foreground">
              {{ 'plans.history.title' | transloco }}
            </h2>
            <button
              type="button"
              class="flex w-full items-center gap-3 rounded-lg border bg-card p-3 text-left"
              (click)="openHistory()"
            >
              <span
                class="flex size-10 shrink-0 items-center justify-center rounded-md bg-secondary text-secondary-foreground"
                aria-hidden="true"
              >
                <ng-icon name="lucideChartLine" size="24" />
              </span>
              <span class="flex min-w-0 flex-1 flex-col gap-1">
                <span class="truncate text-sm font-semibold">{{ history.title }}</span>
                <span class="truncate text-xs text-muted-foreground">{{ history.details }}</span>
              </span>
              <ng-icon name="lucideChevronRight" size="20" aria-hidden="true" />
            </button>
          </section>
        }

        <section class="flex flex-col gap-2">
          <h2 class="text-sm font-medium text-muted-foreground">
            {{ 'plans.fixedOrder' | transloco: { count: plan.exercises.length } }}
          </h2>
          @for (exercise of plan.exercises; track exercise.planExerciseId) {
            <app-plan-exercise-row
              [name]="catalog.nameById(exercise.exerciseId)"
              [summary]="summary(exercise.targetSets, exercise.repMin, exercise.repMax)"
              [hasNote]="notes.hasNote(exercise.exerciseId)"
            >
              <div class="flex flex-col gap-3">
                <p class="text-sm text-muted-foreground">
                  {{ 'plans.restSeconds' | transloco: { seconds: exercise.restSeconds } }}
                </p>
                <button
                  hlmBtn
                  variant="ghost"
                  size="sm"
                  class="-ml-2 self-start"
                  (click)="editWeightStep(exercise.exerciseId)"
                >
                  <ng-icon name="lucideDumbbell" />{{
                    'weightStep.detail' | transloco: { step: weightStepLabel(exercise.exerciseId) }
                  }}
                </button>
                @if (notes.hasNote(exercise.exerciseId)) {
                  <app-exercise-note
                    [text]="notes.noteFor(exercise.exerciseId)"
                    [images]="notes.imagesFor(exercise.exerciseId)"
                    (edit)="editNote(exercise.exerciseId)"
                  />
                } @else {
                  <button
                    hlmBtn
                    variant="ghost"
                    size="sm"
                    class="-ml-2 self-start"
                    (click)="editNote(exercise.exerciseId)"
                  >
                    <ng-icon name="lucideStickyNote" />{{ 'exerciseNote.add' | transloco }}
                  </button>
                }
              </div>
            </app-plan-exercise-row>
          }
        </section>
      </div>

      <app-sticky-action>
        <button hlmBtn size="lg" (click)="start()">
          <ng-icon name="lucideArrowRight" />{{ 'plans.startWorkout' | transloco }}
        </button>
      </app-sticky-action>

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
    }
  `,
})
export class PlanDetailPage implements OnInit {
  /** Route parameter. */
  readonly id = input.required<string>();

  private readonly plans = inject(PlansService);
  private readonly router = inject(Router);
  private readonly workout = inject(WorkoutService);
  private readonly confirm = inject(ConfirmService);
  protected readonly catalog = inject(ExerciseCatalogService);
  protected readonly notes = inject(ExerciseNotesService);
  private readonly transloco = inject(TranslocoService);
  protected readonly exerciseSettings = inject(ExerciseSettingsService);
  private readonly settings = inject(SettingsService);
  private readonly locale = toSignal(inject(TranslocoService).langChanges$, {
    initialValue: 'de',
  });

  private readonly history = inject(HistoryService);
  private readonly format = inject(HistoryFormat);
  private readonly clock = inject(Clock);

  protected readonly plan = signal<PlanDraft | undefined>(undefined);
  protected readonly summary = targetSummary;
  protected readonly noteExerciseId = signal('');
  protected readonly noteOpen = signal(false);
  protected readonly stepExerciseId = signal('');
  protected readonly stepOpen = signal(false);
  protected readonly unit = computed(() => this.settings.settings().unit);

  /** Entry to the plan history: number of workouts, the last one and the average time. */
  protected readonly planHistory = computed(() => {
    const sessions = this.history.summaries().filter((s) => s.planId === this.id());
    if (!sessions.length) {
      return null;
    }
    const average = sessions.reduce((sum, s) => sum + sessionDurationMs(s), 0) / sessions.length;
    return {
      title: this.format.workouts(sessions.length),
      details: this.format.t('plans.history.summary', {
        day: this.format.day(new Date(sessions[0].startedAt), this.clock.now()),
        duration: this.format.duration(average),
      }),
    };
  });

  async ngOnInit(): Promise<void> {
    void this.history.load();
    const [plan] = await Promise.all([
      this.plans.getDraft(this.id()),
      this.catalog.load(),
      this.notes.load(),
      this.exerciseSettings.load(),
    ]);
    if (!plan) {
      await this.router.navigate(['/plans']);
      return;
    }
    this.plan.set(plan);
  }

  protected back(): void {
    void this.router.navigate(['/plans']);
  }

  protected openHistory(): void {
    void this.router.navigate(['/history/plans', this.id()]);
  }

  protected editNote(exerciseId: string): void {
    this.noteExerciseId.set(exerciseId);
    this.noteOpen.set(true);
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

  /** "2,5 kg": the exercise's weight step in the shown unit. */
  protected weightStepLabel(exerciseId: string): string {
    const unit = this.unit();
    return weightStepLabel(
      this.exerciseSettings.weightStepFor(exerciseId, unit),
      unit,
      this.locale(),
    );
  }

  protected editWeightStep(exerciseId: string): void {
    this.stepExerciseId.set(exerciseId);
    this.stepOpen.set(true);
  }

  protected edit(): void {
    void this.router.navigate(['/plans', this.id(), 'edit']);
  }

  protected async start(): Promise<void> {
    // Only one workout at a time: offer to continue the running one instead.
    if (this.workout.isActive()) {
      const resume = await this.confirm.confirm({
        title: 'workout.resume.title',
        message: 'workout.resume.text',
        confirm: 'workout.resume.confirm',
        cancel: 'common.cancel',
      });
      if (resume) {
        await this.router.navigate(['/workout']);
      }
      return;
    }
    await this.workout.start(this.id());
    await this.router.navigate(['/workout']);
  }
}
