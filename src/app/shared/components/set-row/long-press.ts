import { Directive, DOCUMENT, inject, OnDestroy, output } from '@angular/core';
import { HapticsService } from '../../../core/services/haptics.service';

export const LONG_PRESS_MS = 500;
const LONG_PRESS_SLOP_PX = 8;

/**
 * Long press (500 ms, with haptics) or right-click on the host emits `longPress`: the menu of a
 * set row or cardio row (plan.md §8). Shared by `SetRow` and `CardioRow` as a host directive.
 */
@Directive({
  selector: '[appLongPress]',
  host: {
    '(pointerdown)': 'startPress($event)',
    '(pointermove)': 'movePress($event)',
    '(pointerup)': 'cancelPress()',
    '(pointercancel)': 'cancelPress()',
    '(pointerleave)': 'cancelPress()',
    '(contextmenu)': 'openContextMenu($event)',
  },
})
export class LongPress implements OnDestroy {
  readonly longPress = output<void>();

  private readonly haptics = inject(HapticsService);
  private readonly document = inject(DOCUMENT);
  private pressTimer?: ReturnType<typeof setTimeout>;
  private pressStart?: { x: number; y: number };
  private lastPointerType = '';
  private disarmClickGuard?: () => void;

  /**
   * Right-click (or the context-menu key) opens the menu on the web. Android also fires
   * `contextmenu` on a touch long press, which the press timer already handles.
   */
  protected openContextMenu(event: MouseEvent): void {
    event.preventDefault();
    if (this.lastPointerType === 'touch' || this.lastPointerType === 'pen') {
      return;
    }
    this.cancelPress();
    this.longPress.emit();
  }

  protected startPress(event: PointerEvent): void {
    this.lastPointerType = event.pointerType;
    if (event.button !== 0) {
      return;
    }
    this.cancelPress();
    this.pressStart = { x: event.clientX, y: event.clientY };
    this.pressTimer = setTimeout(() => {
      this.guardNextClick();
      this.haptics.press();
      this.longPress.emit();
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

  /**
   * The click that ends a long press must not also press what is under the finger: a button in
   * the row, or the backdrop of the menu that just opened there, which would close it at once.
   * Listens on the document in the capture phase; the next press or key means no click is coming.
   */
  private guardNextClick(): void {
    this.disarmClickGuard?.();
    const swallow = (event: Event) => {
      event.stopPropagation();
      event.preventDefault();
      disarm();
    };
    const disarm = () => {
      this.document.removeEventListener('click', swallow, true);
      this.document.removeEventListener('pointerdown', disarm, true);
      this.document.removeEventListener('keydown', disarm, true);
      this.disarmClickGuard = undefined;
    };
    this.document.addEventListener('click', swallow, true);
    this.document.addEventListener('pointerdown', disarm, true);
    this.document.addEventListener('keydown', disarm, true);
    this.disarmClickGuard = disarm;
  }

  ngOnDestroy(): void {
    this.cancelPress();
    this.disarmClickGuard?.();
  }
}
