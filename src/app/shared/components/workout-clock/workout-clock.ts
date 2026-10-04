import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { RollingNumber } from '../rolling-number/rolling-number';

/** Elapsed time counting up: m:ss, from one hour h:mm:ss; partial seconds are dropped. */
export function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return hours > 0
    ? `${hours}:${minutes.toString().padStart(2, '0')}:${seconds}`
    : `${minutes}:${seconds}`;
}

/**
 * Workout clock in the training header (code only, plan.md §Training): the time since the
 * workout started with a stop symbol. A tap emits `stop`, the page opens the end dialog.
 * Changed digits roll in like the rest timer in `TimerBar` (RollingNumber).
 * Purely presentational, the page derives the elapsed time from the session's start timestamp.
 */
@Component({
  selector: 'app-workout-clock',
  imports: [RollingNumber, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="flex h-11 items-center gap-2.5 rounded-full bg-secondary pr-1.5 pl-3.5 text-sm font-semibold text-secondary-foreground tabular-nums"
      [attr.aria-label]="'workout.end' | transloco: { time: time() }"
      (click)="stop.emit()"
    >
      <app-rolling-number [text]="time()" />
      <span class="flex size-8 items-center justify-center rounded-full bg-input">
        <span class="size-2.5 rounded-xs bg-foreground"></span>
      </span>
    </button>
  `,
})
export class WorkoutClock {
  readonly elapsedMs = input(0);

  readonly stop = output<void>();

  protected readonly time = computed(() => formatElapsed(this.elapsedMs()));
}
