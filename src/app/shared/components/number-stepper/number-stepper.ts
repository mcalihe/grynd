import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ComponentRef,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  Injector,
  input,
  inputBinding,
  model,
  signal,
  viewChild,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { createGlobalPositionStrategy, createOverlayRef, OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon } from '@ng-icons/core';
import { HapticsService } from '../../../core/services/haptics.service';
import { play, SPRING } from '../../motion/motion';
import { ValueScrubber } from '../value-scrubber/value-scrubber';
import {
  clamp,
  edgeScroll,
  edgeSpeed,
  formatNumber,
  majorEvery,
  parseNumber,
  RulerFrame,
  rulerOffset,
  scrubValue,
  stepValue,
  SWIPE_THRESHOLD_PX,
} from './number-stepper.logic';

/** A click this soon after a scrub ends belongs to the scrub, not to what is under the finger. */
const CLICK_GUARD_MS = 400;
/** The ruler fades out in 160 ms; it is removed after this at the latest. */
const LEAVE_MAX_MS = 300;
/** Longest gap between two edge-scroll frames that still counts (e.g. after a hidden tab). */
const MAX_FRAME_MS = 100;

interface Scrub {
  pointerId: number;
  startX: number;
  startY: number;
  /** Value when the press started; restored when the scrub is cancelled. */
  start: number | null;
  x: number;
  active: boolean;
  /** Esc ended the scrub; the press itself is still waiting for its pointerup. */
  cancelled: boolean;
  /** Screen x of the start value on the ruler (the finger when the scrub began). */
  originX: number;
  scrollPx: number;
  /** Timestamp of the last edge-scroll frame; the scroll is derived from elapsed time. */
  frameTime?: number;
  frame?: number;
  overlay?: OverlayRef;
  view?: ComponentRef<ValueScrubber>;
}

/**
 * −/value/+ stepper from the set row (Figma 56:48064, 121×44). Tap the value to type it, or drag
 * sideways anywhere on the stepper to scrub (decision 0018): a full-screen ruler appears, every
 * tick is one step, right increases, and resting the finger at a screen edge keeps it scrolling.
 * The value is a spinbutton for keyboards and screen readers.
 * In a narrower slot (set row on phones below ~364 px) the −/+ buttons give up width first, down to
 * 24 px, so the row still fits a 280 px Galaxy Fold; they stay 44 px tall and the value keeps at
 * least 32 px for «WDH» and «82,5» (decision 0009).
 */
@Component({
  selector: 'app-number-stepper',
  imports: [NgIcon, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'bg-muted flex h-11 min-w-0 touch-pan-y items-center rounded-md',
    '[class.w-[121px]]': '!stretch()',
    '[class.w-full]': 'stretch()',
    '(pointerdown)': 'scrubStart($event)',
  },
  template: `
    <button
      type="button"
      class="flex h-11 w-11 min-w-6 items-center justify-center rounded-md active:bg-accent"
      [attr.aria-label]="'common.decrease' | transloco: { label: label() }"
      [disabled]="disabled()"
      (click)="step(-1)"
    >
      <ng-icon name="lucideMinus" size="18" />
    </button>

    <div
      class="flex h-full min-w-8 flex-1 flex-col items-center justify-center rounded-md leading-none outline-none select-none focus-visible:ring-2 focus-visible:ring-ring"
      [class.cursor-ew-resize]="!disabled() && !editing()"
      [attr.role]="editing() ? null : 'spinbutton'"
      [attr.tabindex]="editing() || disabled() ? null : 0"
      [attr.aria-label]="editing() ? null : label()"
      [attr.aria-valuenow]="editing() ? null : value()"
      [attr.aria-valuemin]="editing() ? null : min()"
      [attr.aria-valuemax]="editing() ? null : max()"
      [attr.aria-valuetext]="editing() || value() === null ? null : display()"
      [attr.aria-disabled]="!editing() && disabled() ? true : null"
      (click)="startEditing()"
      (keydown)="onKey($event)"
    >
      <span class="text-xs leading-4 text-muted-foreground" aria-hidden="true">{{ label() }}</span>
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
        <span #number class="text-sm leading-5 font-semibold">{{ display() }}</span>
      }
    </div>

    <button
      type="button"
      class="flex h-11 w-11 min-w-6 items-center justify-center rounded-md active:bg-accent"
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
  private readonly number = viewChild<ElementRef<HTMLElement>>('number');
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly document = inject(DOCUMENT);
  private readonly haptics = inject(HapticsService);

  protected readonly editing = signal(false);
  private scrub?: Scrub;
  /** What the ruler overlay follows: the finger and the edge scroll. */
  private readonly ruler = signal({ x: 0, scrollPx: 0 });
  private scrubEndedAt = -Infinity;
  // Moves are tracked on the window: the finger leaves the stepper right away.
  private readonly onMove = (event: PointerEvent) => this.scrubMove(event);
  private readonly onEnd = (event: PointerEvent) => this.scrubEnd(event);
  private readonly onEscape = (event: KeyboardEvent) => this.escape(event);
  private readonly preventScroll = (event: TouchEvent) => event.preventDefault();
  /** Swallows the click that ends a scrub, before it reaches −, + or the value (capture phase). */
  private readonly guardClick = (event: MouseEvent) => {
    if (event.timeStamp - this.scrubEndedAt < CLICK_GUARD_MS) {
      event.stopImmediatePropagation();
      event.preventDefault();
      this.scrubEndedAt = -Infinity;
    }
  };

  protected readonly display = computed(() =>
    formatNumber(this.value(), this.lang(), this.decimals()),
  );

  constructor() {
    const host = this.host.nativeElement;
    host.addEventListener('click', this.guardClick, true);
    inject(DestroyRef).onDestroy(() => {
      host.removeEventListener('click', this.guardClick, true);
      this.endScrub();
    });
  }

  private get bounds() {
    return { min: this.min(), max: this.max(), decimals: this.decimals() };
  }

  private get view(): Window | null {
    return this.document.defaultView;
  }

  step(direction: 1 | -1): void {
    this.value.set(stepValue(this.value(), direction * this.stepSize(), this.bounds));
  }

  /** Spinbutton keys: arrows ±1 step, Page Up/Down ±1 labelled ruler interval, Home/End, Enter. */
  protected onKey(event: KeyboardEvent): void {
    if (this.disabled() || this.editing()) {
      return;
    }
    const step = this.stepSize();
    const page = majorEvery(step) * step;
    const deltas: Record<string, number> = {
      ArrowUp: step,
      ArrowRight: step,
      ArrowDown: -step,
      ArrowLeft: -step,
      PageUp: page,
      PageDown: -page,
    };
    if (event.key in deltas) {
      this.value.set(stepValue(this.value(), deltas[event.key], this.bounds));
    } else if (event.key === 'Home') {
      this.value.set(this.min());
    } else if (event.key === 'End') {
      this.value.set(this.max());
    } else if (event.key === 'Enter' || event.key === ' ') {
      this.startEditing();
    } else {
      return;
    }
    event.preventDefault();
  }

  protected scrubStart(event: PointerEvent): void {
    // A new press means no click from an earlier scrub is still coming.
    this.scrubEndedAt = -Infinity;
    if (this.scrub || this.disabled() || this.editing() || event.button !== 0) {
      return;
    }
    this.scrub = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      start: this.value(),
      x: event.clientX,
      active: false,
      cancelled: false,
      originX: event.clientX,
      scrollPx: 0,
    };
    this.listen(true);
  }

  private scrubMove(event: PointerEvent): void {
    const scrub = this.scrub;
    if (!scrub || scrub.cancelled || event.pointerId !== scrub.pointerId) {
      return;
    }
    if (!scrub.active) {
      const dx = event.clientX - scrub.startX;
      const dy = event.clientY - scrub.startY;
      if (Math.abs(dy) > SWIPE_THRESHOLD_PX && Math.abs(dy) > Math.abs(dx)) {
        this.endScrub(); // vertical: let the page scroll
        return;
      }
      if (Math.abs(dx) < SWIPE_THRESHOLD_PX) {
        return;
      }
      this.activate(scrub, event.clientX);
    }
    scrub.x = event.clientX;
    this.update(scrub);
    this.followEdge(scrub);
  }

  private activate(scrub: Scrub, x: number): void {
    scrub.active = true;
    // The ruler starts with the start value under the finger, so nothing jumps.
    scrub.originX = scrub.x = x;
    this.haptics.selectionStart();
    this.view?.addEventListener('touchmove', this.preventScroll, { passive: false });
    this.document.addEventListener('keydown', this.onEscape, true);
    this.openOverlay(scrub);
  }

  private frameOf(scrub: Scrub): RulerFrame {
    return {
      base: scrub.start ?? this.min(),
      step: this.stepSize(),
      originX: scrub.originX,
      scrollPx: scrub.scrollPx,
    };
  }

  /** Sets the value under the finger and redraws the ruler. */
  private update(scrub: Scrub): void {
    const offset = rulerOffset(scrub.x, this.frameOf(scrub));
    const next = scrubValue(scrub.start, offset, this.stepSize(), this.bounds);
    if (next !== this.value()) {
      this.haptics.tick();
      this.value.set(next);
    }
    this.ruler.set({ x: scrub.x, scrollPx: scrub.scrollPx });
  }

  /** While the finger rests in an edge zone, scrolls the ruler on every animation frame. */
  private followEdge(scrub: Scrub): void {
    const view = this.view;
    if (!view || scrub.frame !== undefined || edgeSpeed(scrub.x, view.innerWidth) === 0) {
      return;
    }
    const tick = (time: number) => {
      if (this.scrub !== scrub || !scrub.active) {
        return;
      }
      const width = view.innerWidth;
      if (edgeSpeed(scrub.x, width) === 0) {
        scrub.frame = scrub.frameTime = undefined;
        return;
      }
      const elapsed =
        scrub.frameTime === undefined ? 0 : Math.min(MAX_FRAME_MS, time - scrub.frameTime);
      scrub.frameTime = time;
      scrub.scrollPx = edgeScroll(scrub.x, width, elapsed, this.frameOf(scrub), this.bounds);
      this.update(scrub);
      scrub.frame = view.requestAnimationFrame(tick);
    };
    scrub.frame = view.requestAnimationFrame(tick);
  }

  private scrubEnd(event: PointerEvent): void {
    const scrub = this.scrub;
    if (!scrub || event.pointerId !== scrub.pointerId) {
      return;
    }
    if (scrub.active || scrub.cancelled) {
      this.scrubEndedAt = event.timeStamp;
    }
    if (scrub.active) {
      // The system took the touch over (call, gesture): keep what was there before.
      if (event.type === 'pointercancel') {
        this.value.set(scrub.start);
      }
      this.haptics.selectionEnd();
      void play(this.number()?.nativeElement, { scale: [1.3, 1] }, SPRING.snappy);
    }
    this.endScrub();
  }

  /** Esc (mouse) restores the start value; the button is still down, so wait for its release. */
  private escape(event: KeyboardEvent): void {
    const scrub = this.scrub;
    if (event.key !== 'Escape' || !scrub?.active) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    this.value.set(scrub.start);
    this.haptics.selectionEnd();
    this.stopActive(scrub);
    scrub.cancelled = true;
  }

  private endScrub(): void {
    const scrub = this.scrub;
    this.scrub = undefined;
    this.listen(false);
    if (scrub) {
      this.stopActive(scrub);
    }
  }

  private stopActive(scrub: Scrub): void {
    scrub.active = false;
    if (scrub.frame !== undefined) {
      this.view?.cancelAnimationFrame(scrub.frame);
      scrub.frame = undefined;
    }
    this.view?.removeEventListener('touchmove', this.preventScroll);
    this.document.removeEventListener('keydown', this.onEscape, true);
    const { overlay, view } = scrub;
    scrub.overlay = scrub.view = undefined;
    if (overlay && view) {
      // A stalled animation (hidden tab, throttled frames) must not leave the ruler up.
      const late = new Promise((resolve) => setTimeout(resolve, LEAVE_MAX_MS));
      void Promise.race([view.instance.leave(), late]).then(() => overlay.dispose());
    }
  }

  private openOverlay(scrub: Scrub): void {
    const overlay = createOverlayRef(this.injector, {
      positionStrategy: createGlobalPositionStrategy(this.injector),
      width: '100%',
      height: '100%',
      panelClass: 'pointer-events-none',
    });
    this.ruler.set({ x: scrub.x, scrollPx: scrub.scrollPx });
    const { start, originX } = scrub;
    const width = this.view?.innerWidth ?? 0;
    const rect = this.host.nativeElement.getBoundingClientRect();
    const anchorY = rect.top + rect.height / 2;
    // Bound at creation, so the first frame already shows the right ruler.
    const bindings = [
      inputBinding('label', this.label),
      inputBinding('value', this.value),
      inputBinding('start', () => start),
      inputBinding('step', this.stepSize),
      inputBinding('min', this.min),
      inputBinding('max', this.max),
      inputBinding('decimals', this.decimals),
      inputBinding('locale', this.lang),
      inputBinding('originX', () => originX),
      inputBinding('scrollPx', () => this.ruler().scrollPx),
      inputBinding('pointerX', () => this.ruler().x),
      inputBinding('anchorY', () => anchorY),
      inputBinding('width', () => width),
    ];
    const portal = new ComponentPortal(ValueScrubber, null, this.injector, null, bindings);
    const view = overlay.attach(portal);
    scrub.overlay = overlay;
    scrub.view = view;
  }

  private listen(on: boolean): void {
    const view = this.view;
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
    if (this.disabled() || this.editing()) {
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
