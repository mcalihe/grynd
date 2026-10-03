import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmSheetImports } from '@spartan-ng/helm/sheet';
import { toggle } from '../../core/exercises/exercise-search';

/**
 * Options of one picker filter group (decision 0016): a bottom sheet with toggle chips. Every tap
 * applies right away, so the list behind already shows the result; close via X, backdrop or Esc.
 */
@Component({
  selector: 'app-exercise-filter-sheet',
  imports: [HlmSheetImports, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <hlm-sheet side="bottom" [state]="open() ? 'open' : 'closed'" (closed)="open.set(false)">
      <hlm-sheet-content *hlmSheetPortal="let ctx">
        <hlm-sheet-header>
          <h3 hlmSheetTitle>{{ title() | transloco }}</h3>
        </hlm-sheet-header>
        <div class="flex flex-wrap gap-2 px-4 pb-6" role="group">
          @for (option of options(); track option) {
            <button
              type="button"
              class="h-10 rounded-full px-4 text-sm font-medium"
              [class]="
                value().includes(option)
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground'
              "
              [attr.aria-pressed]="value().includes(option)"
              (click)="value.set(toggle(value(), option))"
            >
              {{ labelPrefix() + option | transloco }}
            </button>
          }
        </div>
      </hlm-sheet-content>
    </hlm-sheet>
  `,
})
export class ExerciseFilterSheet {
  readonly open = model(false);
  /** Translation key of the group name. */
  readonly title = input.required<string>();
  /** Translation key prefix of the options, e.g. `muscles.`. */
  readonly labelPrefix = input.required<string>();
  readonly options = input.required<readonly string[]>();
  readonly value = model<readonly string[]>([]);

  protected readonly toggle = toggle;
}
