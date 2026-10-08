import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon } from '@ng-icons/core';
import { HlmBadge } from '@spartan-ng/helm/badge';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmDropdownMenuImports } from '@spartan-ng/helm/dropdown-menu';
import { SetLog } from '../../core/db/models';
import { ExerciseCatalogService } from '../../core/exercises/exercise-catalog.service';
import { ExerciseNotesService } from '../../core/exercises/exercise-notes.service';
import { SettingsService } from '../../core/settings/settings.service';
import {
  exerciseJustDone,
  WorkoutExercise,
  WorkoutService,
} from '../../core/workout/workout.service';
import { ExerciseNote } from '../../shared/components/exercise-note/exercise-note';
import { SetRow, SetRowState } from '../../shared/components/set-row/set-row';
import { SetMenu } from './set-menu';

/** "Ziel 8–10" or "Ziel 10" for a fixed rep count. */
export function repTarget(repMin: number | null, repMax: number | null): string {
  if (repMin === null && repMax === null) {
    return '';
  }
  return repMin === repMax || repMax === null ? `${repMin}` : `${repMin}–${repMax}`;
}

/**
 * One exercise page in the workout pager (Figma Training · Normal 56:48015): header with name,
 * set progress, muscle badge and menu, the target line, the exercise note (decision 0019),
 * set rows and «+ Satz».
 */
@Component({
  selector: 'app-exercise-page',
  imports: [
    SetRow,
    SetMenu,
    ExerciseNote,
    HlmBadge,
    HlmButton,
    HlmDropdownMenuImports,
    NgIcon,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-2 px-4 pt-4 pb-6' },
  template: `
    <header class="flex items-start gap-2.5">
      <div class="flex min-w-0 flex-1 flex-col gap-1">
        <h2 class="text-2xl font-semibold break-words">{{ name() }}</h2>
        <p class="text-xs text-muted-foreground">
          {{ 'workout.setProgress' | transloco: { current: currentSet(), total: plannedCount() } }}
        </p>
      </div>
      @if (exercise().muscleGroup; as group) {
        <span hlmBadge variant="secondary" class="mt-1">{{ 'muscles.' + group | transloco }}</span>
      }
      <button
        hlmBtn
        variant="ghost"
        size="icon"
        class="-mr-2 text-muted-foreground"
        align="end"
        [hlmDropdownMenuTrigger]="exerciseMenu"
        [attr.aria-label]="'workout.exerciseMenu.label' | transloco"
      >
        <ng-icon name="lucideEllipsis" size="20" />
      </button>
      <ng-template #exerciseMenu>
        <hlm-dropdown-menu class="w-60">
          <button hlmDropdownMenuItem (click)="editNote.emit()">
            {{ (note() ? 'exerciseNote.edit' : 'exerciseNote.add') | transloco }}
          </button>
          <hlm-dropdown-menu-separator />
          <button hlmDropdownMenuItem [disabled]="isLast()" (click)="moveBack.emit(1)">
            {{ 'workout.exerciseMenu.back' | transloco }}
          </button>
          <button hlmDropdownMenuItem [disabled]="isLast()" (click)="moveBack.emit(-1)">
            {{ 'workout.exerciseMenu.end' | transloco }}
          </button>
        </hlm-dropdown-menu>
      </ng-template>
    </header>

    <p class="text-sm font-medium text-muted-foreground">
      {{ 'workout.targetLine' | transloco: { sets: plannedCount(), reps: target() } }}
    </p>

    @if (note(); as text) {
      <app-exercise-note [text]="text" (edit)="editNote.emit()" />
    }

    <div class="flex flex-col gap-1.5">
      @for (set of item().sets; track set.id; let i = $index) {
        <!-- The menu sits in the row's wrapper so opening it does not add a gap. -->
        <div>
          <app-set-row
            [number]="i + 1"
            [weight]="set.weightKg"
            [reps]="set.reps"
            [state]="stateOf(set)"
            [extra]="set.isExtra && !item().sets[i - 1]?.isExtra"
            [unit]="unit()"
            (weightChange)="workout.updateSet(set.id, { weightKg: $event })"
            (repsChange)="workout.updateSet(set.id, { reps: $event })"
            (complete)="complete(set)"
            (menu)="setMenu.emit(set)"
          />
          @if (set.id === menuSetId()) {
            <app-set-menu
              (duplicate)="duplicate(set)"
              (remove)="remove(set)"
              (dismiss)="setMenu.emit(null)"
            />
          }
        </div>
      }
    </div>

    <button hlmBtn variant="ghost" size="sm" class="self-start" (click)="workout.addSet(index())">
      <ng-icon name="lucidePlus" />{{ 'workout.addSet' | transloco }}
    </button>
  `,
})
export class ExercisePage {
  readonly item = input.required<WorkoutExercise>();
  readonly index = input.required<number>();
  /** Set whose menu is open (menu-open state). */
  readonly menuSetId = input<string | null>(null);

  /** Opens (set) or closes (null) the set menu. */
  readonly setMenu = output<SetLog | null>();
  /** «1 nach hinten» (1) or «Ans Ende» (-1). */
  readonly moveBack = output<1 | -1>();
  readonly isLast = input(false);
  /** Emitted after a set was checked (not unchecked), with the exercise's rest in seconds. */
  readonly setCompleted = output<number>();
  /** Emitted when checking a set finished the exercise (all planned sets done). */
  readonly exerciseCompleted = output<void>();
  /** Opens the note editor for this exercise. */
  readonly editNote = output<void>();

  protected readonly workout = inject(WorkoutService);
  private readonly catalog = inject(ExerciseCatalogService);
  private readonly settings = inject(SettingsService);
  private readonly notes = inject(ExerciseNotesService);
  protected readonly unit = computed(() => this.settings.settings().unit);
  protected readonly note = computed(() => this.notes.noteFor(this.item().entry.exerciseId));

  protected readonly exercise = computed(
    () => this.catalog.byId().get(this.item().entry.exerciseId) ?? { muscleGroup: null },
  );
  protected readonly name = computed(() => this.catalog.nameById(this.item().entry.exerciseId));
  protected readonly plannedCount = computed(
    () => this.item().sets.filter((s) => !s.isExtra).length,
  );
  /** Number of the next open set, or the last one when all are done. */
  protected readonly currentSet = computed(() => {
    const sets = this.item().sets;
    const next = sets.findIndex((s) => s.completedAt === null);
    return next === -1 ? sets.length : next + 1;
  });
  protected readonly target = computed(() =>
    repTarget(this.item().entry.repMin, this.item().entry.repMax),
  );

  protected stateOf(set: SetLog): SetRowState {
    if (set.id === this.menuSetId()) {
      return 'menu-open';
    }
    if (set.completedAt === null) {
      return 'open';
    }
    return this.workout.records().has(set.id) ? 'record' : 'completed';
  }

  protected async duplicate(set: SetLog): Promise<void> {
    this.setMenu.emit(null);
    await this.workout.duplicateSet(set.id);
  }

  protected async remove(set: SetLog): Promise<void> {
    this.setMenu.emit(null);
    await this.workout.deleteSet(set.id);
  }

  protected async complete(set: SetLog): Promise<void> {
    const { entry, sets: before } = this.item();
    if (await this.workout.toggleComplete(set.id)) {
      this.setCompleted.emit(entry.restSeconds ?? 90);
      const after = this.workout.workout()?.exercises.find((e) => e.entry.id === entry.id)?.sets;
      if (after && exerciseJustDone(before, after)) {
        this.exerciseCompleted.emit();
      }
    }
  }
}
