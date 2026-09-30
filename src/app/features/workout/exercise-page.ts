import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon } from '@ng-icons/core';
import { HlmBadge } from '@spartan-ng/helm/badge';
import { HlmButton } from '@spartan-ng/helm/button';
import { SetLog } from '../../core/db/models';
import { ExerciseCatalogService } from '../../core/exercises/exercise-catalog.service';
import { WorkoutExercise, WorkoutService } from '../../core/workout/workout.service';
import { SetRow, SetRowState } from '../../shared/components/set-row/set-row';

/** "Ziel 8–10" or "Ziel 10" for a fixed rep count. */
export function repTarget(repMin: number | null, repMax: number | null): string {
  if (repMin === null && repMax === null) {
    return '';
  }
  return repMin === repMax || repMax === null ? `${repMin}` : `${repMin}–${repMax}`;
}

/**
 * One exercise page in the workout pager (Figma Training · Normal 56:48015): header with name,
 * set progress, muscle badge and menu, the target line, set rows and «+ Satz».
 */
@Component({
  selector: 'app-exercise-page',
  imports: [SetRow, HlmBadge, HlmButton, NgIcon, TranslocoPipe],
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
      <ng-content select="[exerciseMenu]" />
    </header>

    <p class="text-sm font-medium text-muted-foreground">
      {{ 'workout.targetLine' | transloco: { sets: plannedCount(), reps: target() } }}
    </p>

    <div class="flex flex-col">
      @for (set of item().sets; track set.id; let i = $index) {
        <app-set-row
          [number]="i + 1"
          [weight]="set.weightKg"
          [reps]="set.reps"
          [state]="stateOf(set)"
          [extra]="set.isExtra && !item().sets[i - 1]?.isExtra"
          (weightChange)="workout.updateSet(set.id, { weightKg: $event })"
          (repsChange)="workout.updateSet(set.id, { reps: $event })"
          (complete)="complete(set)"
          (menu)="setMenu.emit(set)"
        />
      }
    </div>

    <button
      hlmBtn
      variant="ghost"
      size="sm"
      class="self-start"
      (click)="workout.addExtraSet(index())"
    >
      <ng-icon name="lucidePlus" />{{ 'workout.addSet' | transloco }}
    </button>
  `,
})
export class ExercisePage {
  readonly item = input.required<WorkoutExercise>();
  readonly index = input.required<number>();
  /** Set whose menu is open (menu-open state). */
  readonly menuSetId = input<string | null>(null);

  readonly setMenu = output<SetLog>();
  /** Emitted after a set was checked (not unchecked), with the exercise's rest in seconds. */
  readonly setCompleted = output<number>();

  protected readonly workout = inject(WorkoutService);
  private readonly catalog = inject(ExerciseCatalogService);

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

  protected async complete(set: SetLog): Promise<void> {
    if (await this.workout.toggleComplete(set.id)) {
      this.setCompleted.emit(this.item().entry.restSeconds ?? 90);
    }
  }
}
