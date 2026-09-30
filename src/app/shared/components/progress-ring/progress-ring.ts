import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { NgIcon } from '@ng-icons/core';

const RADIUS = 9.5; // 22 px track incl. 3 px stroke → centre line at 9.5
export const RING_CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** stroke-dashoffset for a 0–1 progress value (clamped). */
export function ringOffset(value: number): number {
  const clamped = Math.min(1, Math.max(0, value));
  return RING_CIRCUMFERENCE * (1 - clamped);
}

/**
 * Exercise progress (Figma Grynd/Progress Ring 66:2852): muted track, primary arc,
 * filled primary circle with a check when complete. Always primary (progress colour).
 */
@Component({
  selector: 'app-progress-ring',
  imports: [NgIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'inline-flex size-7 shrink-0 items-center justify-center',
    role: 'progressbar',
    'aria-valuemin': '0',
    'aria-valuemax': '100',
    '[attr.aria-valuenow]': 'percent()',
  },
  template: `
    @if (complete()) {
      <span
        class="flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground"
      >
        <ng-icon name="lucideCheck" size="14" strokeWidth="3" />
      </span>
    } @else {
      <svg viewBox="0 0 22 22" class="size-[22px] -rotate-90" aria-hidden="true">
        <circle
          cx="11"
          cy="11"
          [attr.r]="radius"
          fill="none"
          stroke-width="3"
          class="stroke-muted"
        />
        @if (value() > 0) {
          <circle
            cx="11"
            cy="11"
            [attr.r]="radius"
            fill="none"
            stroke-width="3"
            stroke-linecap="round"
            class="stroke-primary"
            [attr.stroke-dasharray]="circumference"
            [attr.stroke-dashoffset]="offset()"
          />
        }
      </svg>
    }
  `,
})
export class ProgressRing {
  readonly value = input(0);

  protected readonly radius = RADIUS;
  protected readonly circumference = RING_CIRCUMFERENCE;
  protected readonly complete = computed(() => this.value() >= 1);
  protected readonly offset = computed(() => ringOffset(this.value()));
  protected readonly percent = computed(() =>
    Math.round(Math.min(1, Math.max(0, this.value())) * 100),
  );
}
