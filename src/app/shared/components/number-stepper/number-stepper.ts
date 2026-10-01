import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  Injector,
  input,
  model,
  signal,
  viewChild,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon } from '@ng-icons/core';
import { HapticsService } from '../../../core/services/haptics.service';
import {
  clamp,
  formatNumber,
  parseNumber,
  stepValue,
  SWIPE_THRESHOLD_PX,
  swipeSteps,
} from './number-stepper.logic';

interface Swipe {
  pointerId: number;
  startX: number;
  startY: number;
  lastX: number;
  lastTime: number;
  /** Smoothed finger speed in px/ms. */
  velocity: number;
  /** Travel not yet turned into steps. */
  travel: number;
  active: boolean;
}

/**
 * −/value/+ stepper from the set row (Figma 56:48064, 121×44). Tap the value to type it, or swipe
 * across it: right increases, left decreases, faster swipes take bigger leaps (decision 0013).
 */
@Component({
  selector: 'app-number-stepper',
  imports: [NgIcon, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'bg-muted flex h-11 shrink-0 items-center rounded-md',
    '[class.w-[121px]]': '!stretch()',
    '[class.w-full]': 'stretch()',
  },
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

    <div
      class="flex h-full min-w-0 flex-1 touch-pan-y flex-col items-center justify-center leading-none select-none"
      [class.cursor-ew-resize]="!disabled()"
      (pointerdown)="swipeStart($event)"
    >
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
  /** Fill the container instead of the fixed 121 px from the set row. */
  readonly stretch = input(false);

  private readonly lang = toSignal(inject(TranslocoService).langChanges$, { initialValue: 'de' });
  private readonly field = viewChild<ElementRef<HTMLInputElement>>('field');
  private readonly injector = inject(Injector);
  private readonly document = inject(DOCUMENT);
  private readonly haptics = inject(HapticsService);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.listen(false));
  }

  protected readonly editing = signal(false);
  private swipe?: Swipe;
  // Moves are tracked on the window: a finger easily leaves the narrow value area.
  private readonly onMove = (event: PointerEvent) => this.swipeMove(event);
  private readonly onEnd = (event: PointerEvent) => this.swipeEnd(event);
  private swallowNextClick = false;
  protected readonly display = computed(() =>
    formatNumber(this.value(), this.lang(), this.decimals()),
  );

  private get bounds() {
    return { min: this.min(), max: this.max(), decimals: this.decimals() };
  }

  step(direction: 1 | -1): void {
    this.value.set(stepValue(this.value(), direction * this.stepSize(), this.bounds));
  }

  protected swipeStart(event: PointerEvent): void {
    // A swipe released without a click must not swallow the next tap.
    this.swallowNextClick = false;
    if (this.disabled() || this.editing() || event.button !== 0) {
      return;
    }
    this.swipe = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastTime: event.timeStamp,
      velocity: 0,
      travel: 0,
      active: false,
    };
    this.listen(true);
  }

  private swipeMove(event: PointerEvent): void {
    const swipe = this.swipe;
    if (!swipe || event.pointerId !== swipe.pointerId) {
      return;
    }
    if (!swipe.active) {
      const dx = event.clientX - swipe.startX;
      const dy = event.clientY - swipe.startY;
      if (Math.abs(dy) > SWIPE_THRESHOLD_PX && Math.abs(dy) > Math.abs(dx)) {
        this.endSwipe(); // vertical: let the page scroll
        return;
      }
      if (Math.abs(dx) < SWIPE_THRESHOLD_PX) {
        return;
      }
      swipe.active = true;
      swipe.lastX = swipe.startX + Math.sign(dx) * SWIPE_THRESHOLD_PX;
      this.haptics.selectionStart();
    }
    const delta = event.clientX - swipe.lastX;
    const elapsed = Math.max(1, event.timeStamp - swipe.lastTime);
    swipe.velocity = 0.6 * swipe.velocity + 0.4 * (Math.abs(delta) / elapsed);
    swipe.lastX = event.clientX;
    swipe.lastTime = event.timeStamp;
    const { steps, rest } = swipeSteps(swipe.travel + delta, swipe.velocity);
    swipe.travel = rest;
    if (steps !== 0) {
      const next = stepValue(this.value(), steps * this.stepSize(), this.bounds);
      if (next !== this.value()) {
        this.haptics.tick();
      }
      this.value.set(next);
    }
  }

  private swipeEnd(event: PointerEvent): void {
    if (this.swipe && event.pointerId !== this.swipe.pointerId) {
      return;
    }
    if (this.swipe?.active) {
      this.swallowNextClick = true;
      this.haptics.selectionEnd();
    }
    this.endSwipe();
  }

  private endSwipe(): void {
    this.swipe = undefined;
    this.listen(false);
  }

  private listen(on: boolean): void {
    const view = this.document.defaultView;
    if (!view) {
      return;
    }
    if (on) {
      view.addEventListener('pointermove', this.onMove);
      view.addEventListener('pointerup', this.onEnd);
      view.addEventListener('pointercancel', this.onEnd);
    } else {
      view.removeEventListener('pointermove', this.onMove);
      view.removeEventListener('pointerup', this.onEnd);
      view.removeEventListener('pointercancel', this.onEnd);
    }
  }

  protected startEditing(): void {
    // The click that ends a swipe must not open the text field.
    if (this.swallowNextClick) {
      this.swallowNextClick = false;
      return;
    }
    this.editing.set(true);
    // Focus once the input exists; a microtask runs before Angular renders it.
    afterNextRender(
      () => {
        const element = this.field()?.nativeElement;
        element?.focus();
        element?.select();
      },
      { injector: this.injector },
    );
  }

  protected commit(text: string): void {
    const parsed = parseNumber(text);
    this.value.set(parsed === null ? null : clamp(parsed, this.bounds));
    this.editing.set(false);
  }
}
