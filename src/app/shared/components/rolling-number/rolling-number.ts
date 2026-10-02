import { ChangeDetectionStrategy, Component, computed, input, linkedSignal } from '@angular/core';

export type RollDirection = 'up' | 'down';

/** Numeric value of a display string (digits only), e.g. "1:12" → 112. */
export function digitValue(text: string): number {
  const digits = text.replace(/\D/g, '');
  return digits ? Number(digits) : 0;
}

/**
 * Slots aligned from the right, so "10:00" → "9:59" keeps the seconds in place and only
 * the leading slot disappears. The key is the position from the end.
 */
export function rollSlots(text: string): { key: number; char: string }[] {
  const chars = [...text];
  return chars.map((char, i) => ({ key: chars.length - i, char }));
}

/** Rising values roll up (new digit from below), falling values roll down (from above). */
export function rollDirection(next: number, previous: number | undefined): RollDirection {
  return previous !== undefined && next > previous ? 'up' : 'down';
}

/**
 * Text whose changed characters roll in like an odometer (motion spec in the description of
 * Figma Grynd/Timer Bar 72:2641).
 * Only changed slots animate; respects prefers-reduced-motion.
 */
@Component({
  selector: 'app-rolling-number',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'inline-flex tabular-nums',
    '[attr.data-direction]': 'direction()',
    '[attr.aria-label]': 'text()',
  },
  styles: `
    .slot {
      position: relative;
      display: inline-flex;
      overflow: hidden;
    }
    .char {
      display: inline-block;
    }
    .roll-enter {
      animation: roll-in-down 400ms cubic-bezier(0.2, 0.8, 0.2, 1);
    }
    .roll-leave {
      position: absolute;
      inset: 0;
      animation: roll-out-down 400ms cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
    }
    :host([data-direction='up']) .roll-enter {
      animation-name: roll-in-up;
    }
    :host([data-direction='up']) .roll-leave {
      animation-name: roll-out-up;
    }
    @keyframes roll-in-down {
      from {
        transform: translateY(-100%);
        opacity: 0;
      }
    }
    @keyframes roll-out-down {
      to {
        transform: translateY(100%);
        opacity: 0;
      }
    }
    @keyframes roll-in-up {
      from {
        transform: translateY(100%);
        opacity: 0;
      }
    }
    @keyframes roll-out-up {
      to {
        transform: translateY(-100%);
        opacity: 0;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .roll-enter,
      .roll-leave {
        animation: none;
      }
    }
  `,
  template: `
    @for (slot of slots(); track slot.key) {
      <span class="slot" aria-hidden="true">
        @for (char of [slot.char]; track char) {
          <span class="char" animate.enter="roll-enter" animate.leave="roll-leave">{{ char }}</span>
        }
      </span>
    }
  `,
})
export class RollingNumber {
  readonly text = input.required<string>();

  protected readonly slots = computed(() => rollSlots(this.text()));
  protected readonly direction = linkedSignal<number, RollDirection>({
    source: computed(() => digitValue(this.text())),
    computation: (next, previous) => rollDirection(next, previous?.source),
  });
}
