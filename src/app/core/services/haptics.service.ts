import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

/**
 * Haptic feedback (decision 0014). Native only; in the browser every call does nothing, except
 * `success`, which falls back to the Vibration API where it exists.
 */
@Injectable({ providedIn: 'root' })
export class HapticsService {
  private readonly native = Capacitor.isNativePlatform();

  /** Light tap, e.g. checking a set. */
  tap(): void {
    this.run(() => Haptics.impact({ style: ImpactStyle.Light }));
  }

  /** Firmer feedback for a long press. */
  press(): void {
    this.run(() => Haptics.impact({ style: ImpactStyle.Medium }));
  }

  /** Start of a value scrub (swipe on a stepper); follow with `tick` and `selectionEnd`. */
  selectionStart(): void {
    this.run(() => Haptics.selectionStart());
  }

  /** One step while scrubbing. */
  tick(): void {
    this.run(() => Haptics.selectionChanged());
  }

  selectionEnd(): void {
    this.run(() => Haptics.selectionEnd());
  }

  /** Something finished, e.g. the rest timer. */
  success(): void {
    if (!this.native) {
      globalThis.navigator?.vibrate?.([200, 100, 200]);
      return;
    }
    this.run(() => Haptics.notification({ type: NotificationType.Success }));
  }

  private run(effect: () => Promise<void>): void {
    if (this.native) {
      effect().catch(() => undefined); // feedback is never worth an error
    }
  }
}
