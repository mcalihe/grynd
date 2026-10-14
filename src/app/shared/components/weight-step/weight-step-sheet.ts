import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  model,
  output,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { HlmSheetImports } from '@spartan-ng/helm/sheet';
import { WeightUnit } from '../../../core/settings/settings.service';
import { WEIGHT_STEP, WEIGHT_STEPS, weightStepLabel } from '../../../core/units/weight';

/**
 * Bottom sheet to pick the weight step of an exercise (decision 0022): the steps for the shown
 * unit as chips, the current one in primary. A tap emits `pick` and closes the sheet.
 */
@Component({
  selector: 'app-weight-step-sheet',
  imports: [HlmSheetImports, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <hlm-sheet side="bottom" [state]="open() ? 'open' : 'closed'" (closed)="open.set(false)">
      <hlm-sheet-content *hlmSheetPortal="let ctx">
        <hlm-sheet-header>
          <h3 hlmSheetTitle class="pr-8 break-words">{{ title() }}</h3>
          <p hlmSheetDescription>{{ 'weightStep.hint' | transloco }}</p>
        </hlm-sheet-header>
        <div
          class="grid grid-cols-4 gap-2 px-4 pb-6"
          role="radiogroup"
          [attr.aria-label]="'weightStep.label' | transloco"
        >
          @for (option of options(); track option.value) {
            <button
              type="button"
              role="radio"
              class="h-11 rounded-full px-2 text-sm font-medium tabular-nums"
              [class]="
                option.value === step()
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground'
              "
              [attr.aria-checked]="option.value === step()"
              (click)="choose(option.value)"
            >
              {{ option.label }}
            </button>
          }
        </div>
      </hlm-sheet-content>
    </hlm-sheet>
  `,
})
export class WeightStepSheet {
  readonly open = model(false);
  /** Exercise name, shown as the title. */
  readonly title = input('');
  readonly unit = input<WeightUnit>('kg');
  /** The current step in `unit`. */
  readonly step = input(WEIGHT_STEP);
  /** The picked step in `unit`, also when it is the current one. */
  readonly pick = output<number>();

  private readonly locale = toSignal(inject(TranslocoService).langChanges$, {
    initialValue: 'de',
  });

  protected readonly options = computed(() =>
    WEIGHT_STEPS[this.unit()].map((value) => ({
      value,
      label: weightStepLabel(value, this.unit(), this.locale()),
    })),
  );

  protected choose(step: number): void {
    this.pick.emit(step);
    this.open.set(false);
  }
}
