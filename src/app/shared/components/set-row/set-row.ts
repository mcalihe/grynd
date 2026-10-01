import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  model,
  OnDestroy,
  output,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon } from '@ng-icons/core';
import { HlmBadge } from '@spartan-ng/helm/badge';
import { WeightUnit } from '../../../core/settings/settings.service';
import { displayToKg, kgToDisplay, WEIGHT_STEP, weightDecimals } from '../../../core/units/weight';
import { HapticsService } from '../../../core/services/haptics.service';
import { NumberStepper } from '../number-stepper/number-stepper';

export type SetRowState = 'open' | 'completed' | 'record' | 'menu-open';

export const LONG_PRESS_MS = 500;
const LONG_PRESS_SLOP_PX = 8;

/**
 * One set in a workout (Figma Grynd/Set Row 96:3055, decision 0009): number, weight and reps
 * steppers, check, menu. `weight` is always kg; `unit` only changes what is shown and typed. Long-press (500 ms) or the ⋯ button opens the set menu.
 */
@Component({
  selector: 'app-set-row',
  imports: [NumberStepper, NgIcon, HlmBadge, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block',
    '(pointerdown)': 'startPress($event)',
    '(pointermove)': 'movePress($event)',
    '(pointerup)': 'cancelPress()',
    '(pointercancel)': 'cancelPress()',
    '(pointerleave)': 'cancelPress()',
    '(contextmenu)': '$event.preventDefault()',
  },
  template: `
    @if (extra()) {
      <span class="mb-1 block text-xs text-muted-foreground">{{
        'workout.set.extra' | transloco
      }}</span>
    }
    <div
      class="relative flex h-20 items-center gap-[3px] rounded-lg border bg-card p-1"
      [class.border-l-4]="state() === 'record'"
      [class.border-l-primary]="state() === 'record'"
      [class.border-2]="state() === 'menu-open'"
      [class.border-primary]="state() === 'menu-open'"
      [attr.data-state]="state()"
    >
      <span
        class="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs"
        [attr.aria-label]="'workout.set.number' | transloco: { number: number() }"
      >
        {{ number() }}
      </span>

      <app-number-stepper
        [label]="'workout.set.' + unit() | transloco"
        [value]="displayWeight()"
        [stepSize]="weightStep"
        [decimals]="decimals()"
        [max]="unit() === 'kg' ? 999 : 2200"
        (valueChange)="weight.set(toKg($event))"
      />
      <app-number-stepper [label]="'workout.set.reps' | transloco" [(value)]="reps" [max]="999" />

      <button
        type="button"
        class="flex size-11 shrink-0 items-center justify-center rounded-full border"
        [class]="
          done() ? 'border-primary bg-primary text-primary-foreground' : 'bg-muted text-foreground'
        "
        [attr.aria-label]="'workout.set.complete' | transloco"
        [attr.aria-pressed]="done()"
        (click)="haptics.tap(); complete.emit()"
      >
        <ng-icon name="lucideCheck" size="22" />
      </button>

      <button
        type="button"
        class="relative flex size-8 shrink-0 items-center justify-center rounded-md bg-background text-muted-foreground after:absolute after:-inset-1.5"
        [attr.aria-label]="'workout.set.menu' | transloco"
        (click)="menu.emit()"
      >
        <ng-icon name="lucideEllipsis" size="16" />
      </button>

      @if (state() === 'record') {
        <span hlmBadge class="absolute -top-3 right-3">{{ 'workout.set.record' | transloco }}</span>
      }
    </div>
  `,
})
export class SetRow implements OnDestroy {
  readonly number = input.required<number>();
  readonly weight = model<number | null>(null);
  readonly reps = model<number | null>(null);
  readonly state = input<SetRowState>('open');
  readonly extra = input(false);
  readonly unit = input<WeightUnit>('kg');

  readonly complete = output<void>();
  readonly menu = output<void>();

  protected readonly weightStep = WEIGHT_STEP;
  protected readonly displayWeight = computed(() => kgToDisplay(this.weight(), this.unit()));
  protected readonly decimals = computed(() => weightDecimals(this.unit()));
  protected readonly haptics = inject(HapticsService);
  private pressTimer?: ReturnType<typeof setTimeout>;
  private longPressFired = false;
  private pressStart?: { x: number; y: number };

  constructor() {
    // Capture phase: runs before the button under the finger handles the click.
    inject<ElementRef<HTMLElement>>(ElementRef).nativeElement.addEventListener(
      'click',
      (event) => this.swallowClickAfterLongPress(event),
      true,
    );
  }

  protected toKg(value: number | null): number | null {
    return displayToKg(value, this.unit());
  }

  protected done(): boolean {
    return this.state() === 'completed' || this.state() === 'record';
  }

  protected startPress(event: PointerEvent): void {
    if (event.button !== 0) {
      return;
    }
    this.longPressFired = false;
    this.cancelPress();
    this.pressStart = { x: event.clientX, y: event.clientY };
    this.pressTimer = setTimeout(() => {
      this.longPressFired = true;
      this.haptics.press();
      this.menu.emit();
    }, LONG_PRESS_MS);
  }

  /** A moving finger (swipe, scroll) is not a long press. */
  protected movePress(event: PointerEvent): void {
    const start = this.pressStart;
    if (
      start &&
      Math.hypot(event.clientX - start.x, event.clientY - start.y) > LONG_PRESS_SLOP_PX
    ) {
      this.cancelPress();
    }
  }

  protected cancelPress(): void {
    clearTimeout(this.pressTimer);
    this.pressTimer = undefined;
  }

  /** The click that ends a long press must not also press the button under the finger. */
  private swallowClickAfterLongPress(event: MouseEvent): void {
    if (this.longPressFired) {
      event.stopPropagation();
      event.preventDefault();
      this.longPressFired = false;
    }
  }

  ngOnDestroy(): void {
    this.cancelPress();
  }
}
