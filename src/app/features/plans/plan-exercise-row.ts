import { CdkDragHandle } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon } from '@ng-icons/core';

/** "3 × 8–12", or "3 × 10" for a fixed rep count. */
export function targetSummary(sets: number, repMin: number, repMax: number): string {
  return repMin === repMax ? `${sets} × ${repMin}` : `${sets} × ${repMin}–${repMax}`;
}

/**
 * One exercise in a plan (Figma rows in Plan-Detail 37:27708 / Plan bearbeiten 37:28096):
 * optional drag handle, name, targets, chevron that expands projected details.
 */
@Component({
  selector: 'app-plan-exercise-row',
  imports: [NgIcon, TranslocoPipe, CdkDragHandle],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'bg-card block rounded-lg border' },
  template: `
    <div class="flex min-h-16 items-center gap-3 px-3 py-2">
      @if (draggable()) {
        <span
          cdkDragHandle
          class="-ml-1 flex size-11 shrink-0 cursor-grab touch-none items-center justify-center text-muted-foreground"
          [attr.aria-label]="'plans.reorder' | transloco"
        >
          <ng-icon name="lucideGripVertical" size="20" />
        </span>
      }
      <span class="flex min-w-0 flex-1 flex-col gap-1">
        <span class="truncate text-sm font-semibold">{{ name() }}</span>
        <span class="text-xs text-muted-foreground">{{ summary() }}</span>
      </span>
      <button
        type="button"
        class="flex size-11 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground"
        [attr.aria-expanded]="expanded()"
        [attr.aria-label]="'plans.details' | transloco"
        (click)="expanded.set(!expanded())"
      >
        <ng-icon [name]="expanded() ? 'lucideChevronUp' : 'lucideChevronDown'" size="20" />
      </button>
    </div>
    @if (expanded()) {
      <div class="border-t px-3 py-3">
        <ng-content />
      </div>
    }
  `,
})
export class PlanExerciseRow {
  readonly name = input.required<string>();
  readonly summary = input.required<string>();
  readonly draggable = input(false);
  readonly expanded = model(false);
}
