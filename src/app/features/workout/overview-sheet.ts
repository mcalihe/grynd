import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, inject, model } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon } from '@ng-icons/core';
import { HlmSheetImports } from '@spartan-ng/helm/sheet';
import { ExerciseCatalogService } from '../../core/exercises/exercise-catalog.service';
import { HapticsService } from '../../core/services/haptics.service';
import { WorkoutExercise, WorkoutService } from '../../core/workout/workout.service';
import { ProgressRing } from '../../shared/components/progress-ring/progress-ring';

/** Completed share of an exercise's sets (extra sets included), 0–1. */
export function exerciseProgress(item: WorkoutExercise): number {
  const total = item.sets.length;
  return total === 0 ? 0 : item.sets.filter((s) => s.completedAt !== null).length / total;
}

/**
 * Workout overview (Figma Training · Übersicht 56:48605): all exercises with progress ring,
 * drag handle to reorder, the current one highlighted; a tap jumps to that exercise.
 */
@Component({
  selector: 'app-overview-sheet',
  imports: [
    HlmSheetImports,
    CdkDropList,
    CdkDrag,
    CdkDragHandle,
    ProgressRing,
    NgIcon,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <hlm-sheet side="bottom" [state]="open() ? 'open' : 'closed'" (closed)="open.set(false)">
      <hlm-sheet-content *hlmSheetPortal="let ctx" class="max-h-[85dvh]">
        <hlm-sheet-header>
          <h3 hlmSheetTitle>{{ 'workout.overview' | transloco }}</h3>
        </hlm-sheet-header>
        <div
          cdkDropList
          cdkDropListLockAxis="y"
          class="flex flex-col gap-2 overflow-y-auto px-4 pb-6"
          (cdkDropListSorted)="haptics.tick()"
          (cdkDropListDropped)="drop($event)"
        >
          @for (item of workout.workout()?.exercises ?? []; track item.entry.id; let i = $index) {
            <div
              cdkDrag
              (cdkDragStarted)="haptics.selectionStart()"
              class="flex min-h-14 items-center gap-1 rounded-lg border bg-card"
              [class.border-primary]="i === workout.current()"
              [class.bg-accent]="i === workout.current()"
            >
              <button
                type="button"
                class="flex min-w-0 flex-1 items-center gap-3 py-2 pl-3 text-left"
                [attr.aria-current]="i === workout.current() ? 'step' : null"
                (click)="jump(i)"
              >
                <app-progress-ring [value]="progress(item)" />
                <span class="flex min-w-0 flex-col gap-0.5">
                  <span class="truncate text-sm font-semibold">
                    {{ catalog.nameById(item.entry.exerciseId) }}
                  </span>
                  <span class="text-xs text-muted-foreground">
                    {{
                      'workout.overviewSets'
                        | transloco: { done: done(item), total: item.sets.length }
                    }}
                  </span>
                </span>
              </button>
              <span
                cdkDragHandle
                class="flex size-11 shrink-0 cursor-grab touch-none items-center justify-center text-muted-foreground"
                [attr.aria-label]="'plans.reorder' | transloco"
              >
                <ng-icon name="lucideMenu" size="20" />
              </span>
            </div>
          }
        </div>
      </hlm-sheet-content>
    </hlm-sheet>
  `,
})
export class OverviewSheet {
  readonly open = model(false);

  protected readonly workout = inject(WorkoutService);
  protected readonly catalog = inject(ExerciseCatalogService);
  protected readonly haptics = inject(HapticsService);
  protected readonly progress = exerciseProgress;

  protected done(item: WorkoutExercise): number {
    return item.sets.filter((s) => s.completedAt !== null).length;
  }

  protected async jump(index: number): Promise<void> {
    this.open.set(false);
    await this.workout.setCurrent(index);
  }

  protected async drop(event: CdkDragDrop<unknown>): Promise<void> {
    this.haptics.selectionEnd();
    if (event.previousIndex !== event.currentIndex) {
      await this.workout.moveExercise(event.previousIndex, event.currentIndex);
    }
  }
}
