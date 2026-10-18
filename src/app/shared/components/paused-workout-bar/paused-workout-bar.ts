import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon } from '@ng-icons/core';
import { formatElapsed } from '../workout-clock/format-elapsed';

/**
 * A paused workout while the user is elsewhere in the app (code only, decision 0023): sits above
 * the bottom navigation with the plan name and the frozen workout time. A tap emits `open`, the
 * app opens the workout, which stays paused until the user continues.
 */
@Component({
  selector: 'app-paused-workout-bar',
  imports: [NgIcon, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block px-4' },
  template: `
    @let name = planName() || ('workout.title' | transloco);
    <button
      type="button"
      class="flex h-16 w-full items-center gap-3 rounded-full border bg-card p-2 pr-4 text-left shadow-md"
      [attr.aria-label]="'workout.pausedBar.label' | transloco: { name, time: time() }"
      (click)="open.emit()"
    >
      <span
        class="flex size-12 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground"
        aria-hidden="true"
      >
        <ng-icon name="lucidePause" size="20" />
      </span>
      <span class="flex min-w-0 flex-1 flex-col gap-0.5">
        <span class="truncate text-sm font-semibold">{{ name }}</span>
        <span class="text-xs text-muted-foreground tabular-nums">
          {{ 'workout.pausedBar.status' | transloco: { time: time() } }}
        </span>
      </span>
      <ng-icon class="shrink-0 text-muted-foreground" name="lucideChevronRight" size="20" />
    </button>
  `,
})
export class PausedWorkoutBar {
  /** Empty for a workout without a plan; the bar then says «Training». */
  readonly planName = input('');
  readonly elapsedMs = input(0);

  readonly open = output<void>();

  protected readonly time = computed(() => formatElapsed(this.elapsedMs()));
}
