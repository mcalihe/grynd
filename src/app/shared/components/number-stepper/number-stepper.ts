import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  model,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon } from '@ng-icons/core';
import { clamp, formatNumber, parseNumber, stepValue } from './number-stepper.logic';

/**
 * −/value/+ stepper from the set row (Figma 56:48064, 121×44). Tap the value to type it.
 */
@Component({
  selector: 'app-number-stepper',
  imports: [NgIcon, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'bg-muted flex h-11 w-[121px] shrink-0 items-center rounded-md' },
  template: `
    <button
      type="button"
      class="flex size-11 shrink-0 items-center justify-center rounded-md active:bg-accent"
      [attr.aria-label]="'common.decrease' | transloco: { label: label() }"
      [disabled]="disabled()"
      (click)="step(-1)"
    >
      <ng-icon name="lucideMinus" size="18" />
    </button>

    <div class="flex min-w-0 flex-1 flex-col items-center leading-none">
      <span class="text-xs leading-4 text-muted-foreground">{{ label() }}</span>
      @if (editing()) {
        <input
          #field
          class="w-full bg-transparent text-center text-sm leading-5 font-semibold outline-none"
          inputmode="decimal"
          [attr.aria-label]="label()"
          enterkeyhint="done"
          [value]="value() ?? ''"
          (blur)="commit(field.value)"
          (keydown.enter)="field.blur()"
        />
      } @else {
        <button
          type="button"
          class="w-full text-sm leading-5 font-semibold"
          [disabled]="disabled()"
          (click)="startEditing()"
        >
          {{ display() }}
        </button>
      }
    </div>

    <button
      type="button"
      class="flex size-11 shrink-0 items-center justify-center rounded-md active:bg-accent"
      [attr.aria-label]="'common.increase' | transloco: { label: label() }"
      [disabled]="disabled()"
      (click)="step(1)"
    >
      <ng-icon name="lucidePlus" size="18" />
    </button>
  `,
})
export class NumberStepper {
  readonly value = model<number | null>(null);
  readonly label = input.required<string>();
  readonly stepSize = input(1);
  readonly min = input(0);
  readonly max = input(9999);
  readonly decimals = input(0);
  readonly disabled = input(false);

  private readonly lang = toSignal(inject(TranslocoService).langChanges$, { initialValue: 'de' });
  private readonly field = viewChild<ElementRef<HTMLInputElement>>('field');

  protected readonly editing = signal(false);
  protected readonly display = computed(() =>
    formatNumber(this.value(), this.lang(), this.decimals()),
  );

  private get bounds() {
    return { min: this.min(), max: this.max(), decimals: this.decimals() };
  }

  step(direction: 1 | -1): void {
    this.value.set(stepValue(this.value(), direction * this.stepSize(), this.bounds));
  }

  protected startEditing(): void {
    this.editing.set(true);
    queueMicrotask(() => {
      const element = this.field()?.nativeElement;
      element?.focus();
      element?.select();
    });
  }

  protected commit(text: string): void {
    const parsed = parseNumber(text);
    this.value.set(parsed === null ? null : clamp(parsed, this.bounds));
    this.editing.set(false);
  }
}
