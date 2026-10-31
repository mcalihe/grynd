import { ChangeDetectionStrategy, Component, input, model, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmSheetImports } from '@spartan-ng/helm/sheet';
import { NumberStepper } from '../number-stepper/number-stepper';
import { formatClock, REST_DURATIONS_SEC } from '../timer-bar/timer-bar';

/** Longest rest the stepper allows, as in the plan editor. */
export const REST_MAX_SEC = 600;

/**
 * Bottom sheet to set the rest of an exercise during a workout (decision 0026): the timer's
 * presets as chips, the current one in primary, and a stepper in 15 s steps for other values.
 * A chip emits `pick` and closes the sheet; the stepper emits each change and keeps it open.
 */
@Component({
  selector: 'app-rest-duration-sheet',
  imports: [HlmSheetImports, NumberStepper, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <hlm-sheet side="bottom" [state]="open() ? 'open' : 'closed'" (closed)="open.set(false)">
      <hlm-sheet-content *hlmSheetPortal="let ctx">
        <hlm-sheet-header>
          <h3 hlmSheetTitle class="pr-8 break-words">{{ title() }}</h3>
          <p hlmSheetDescription>{{ 'restDuration.hint' | transloco }}</p>
        </hlm-sheet-header>
        <div class="flex flex-col gap-3 px-4 pb-6">
          <div
            class="grid grid-cols-5 gap-2"
            role="radiogroup"
            [attr.aria-label]="'restDuration.label' | transloco"
          >
            @for (option of presets; track option) {
              <button
                type="button"
                role="radio"
                class="h-11 rounded-full px-2 text-sm font-medium tabular-nums"
                [class]="
                  option === seconds()
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-secondary-foreground'
                "
                [attr.aria-checked]="option === seconds()"
                (click)="choose(option)"
              >
                {{ clock(option * 1000) }}
              </button>
            }
          </div>
          <app-number-stepper
            [stretch]="true"
            [label]="'restDuration.seconds' | transloco"
            [value]="seconds()"
            [stepSize]="15"
            [max]="maxSeconds"
            (valueChange)="pick.emit($event ?? 0)"
          />
        </div>
      </hlm-sheet-content>
    </hlm-sheet>
  `,
})
export class RestDurationSheet {
  readonly open = model(false);
  /** Exercise name, shown as the title. */
  readonly title = input('');
  /** The current rest in seconds. */
  readonly seconds = input(90);
  /** The new rest in seconds. */
  readonly pick = output<number>();

  protected readonly presets = REST_DURATIONS_SEC;
  protected readonly maxSeconds = REST_MAX_SEC;
  protected readonly clock = formatClock;

  protected choose(seconds: number): void {
    this.pick.emit(seconds);
    this.open.set(false);
  }
}
