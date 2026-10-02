import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon } from '@ng-icons/core';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmPopoverImports } from '@spartan-ng/helm/popover';
import { RollingNumber } from '../rolling-number/rolling-number';

export const REST_DURATIONS_SEC = [30, 60, 90, 120, 180] as const;
export const WARNING_MS = 10_000;

/** m:ss, rounding up so the display never shows 0:00 while time is left. */
export function formatClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export type TimerBarState = 'ready' | 'running' | 'warning';

export function timerState(running: boolean, remainingMs: number): TimerBarState {
  if (!running) {
    return 'ready';
  }
  return remainingMs <= WARNING_MS ? 'warning' : 'running';
}

/**
 * Rest timer bar above the next button (Figma Grynd/Timer Bar 72:2641). Purely presentational:
 * the TimerService (M5) owns the end time and passes the remaining time in. The running clock
 * rolls each changed digit in (RollingNumber).
 */
@Component({
  selector: 'app-timer-bar',
  imports: [NgIcon, HlmButton, HlmPopoverImports, RollingNumber, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'bg-card relative flex h-12 items-center gap-2 overflow-hidden rounded-lg border px-3',
    '[class.border-warning]': "state() === 'warning'",
    '[attr.data-state]': 'state()',
  },
  template: `
    <ng-icon
      name="lucideTimer"
      size="24"
      class="shrink-0"
      [class.text-warning]="state() === 'warning'"
    />

    @if (state() === 'ready') {
      <hlm-popover sideOffset="8" align="start" class="flex flex-1">
        <button
          type="button"
          hlmPopoverTrigger
          class="flex h-11 flex-1 items-center gap-1 text-sm font-medium text-muted-foreground"
          [attr.aria-label]="'workout.timer.duration' | transloco"
        >
          {{ clock(durationSec() * 1000) }}
          <ng-icon name="lucideChevronDown" size="16" />
        </button>
        <hlm-popover-content *hlmPopoverPortal="let ctx" class="w-auto flex-row gap-1 p-2">
          @for (seconds of durations; track seconds) {
            <button
              type="button"
              hlmBtn
              size="sm"
              class="h-8 w-14 px-0 text-xs font-normal"
              [variant]="seconds === durationSec() ? 'default' : 'secondary'"
              [attr.aria-pressed]="seconds === durationSec()"
              (click)="durationChange.emit(seconds); ctx.close()"
            >
              {{ clock(seconds * 1000) }}
            </button>
          }
        </hlm-popover-content>
      </hlm-popover>

      <button
        type="button"
        class="flex h-10 w-11 items-center justify-center rounded-lg bg-secondary text-secondary-foreground"
        [attr.aria-label]="'workout.timer.start' | transloco"
        (click)="start.emit()"
      >
        <ng-icon name="lucidePlay" size="16" class="[&_svg]:fill-current" />
      </button>
    } @else {
      <span
        class="flex-1 text-2xl leading-7 font-bold"
        [class.text-warning]="state() === 'warning'"
        role="timer"
        aria-live="off"
      >
        <app-rolling-number [text]="clock(remainingMs())" />
      </span>
      <button
        type="button"
        class="h-11 w-11 rounded-lg text-xs"
        [attr.aria-label]="'workout.timer.minus15' | transloco"
        (click)="adjust.emit(-15)"
      >
        −15
      </button>
      <button
        type="button"
        class="h-11 w-11 rounded-lg text-xs"
        [attr.aria-label]="'workout.timer.plus15' | transloco"
        (click)="adjust.emit(15)"
      >
        +15
      </button>
      <button
        type="button"
        class="relative flex size-9 items-center justify-center rounded-lg bg-secondary after:absolute after:-inset-1"
        [attr.aria-label]="'workout.timer.stop' | transloco"
        (click)="stop.emit()"
      >
        <span
          class="size-2.5 rounded-xs"
          [class]="state() === 'warning' ? 'bg-warning' : 'bg-foreground'"
        ></span>
      </button>
      <span
        class="absolute bottom-0 left-0 h-[3px] rounded-full transition-[width] duration-1000 ease-linear"
        [class]="state() === 'warning' ? 'bg-warning' : 'bg-primary'"
        [style.width.%]="progress() * 100"
      ></span>
    }
  `,
})
export class TimerBar {
  readonly running = input(false);
  readonly remainingMs = input(0);
  readonly totalMs = input(0);
  /** Default rest in seconds, shown while ready. */
  readonly durationSec = input(90);

  readonly start = output<void>();
  readonly stop = output<void>();
  readonly adjust = output<number>();
  readonly durationChange = output<number>();

  protected readonly durations = REST_DURATIONS_SEC;
  protected readonly clock = formatClock;
  protected readonly state = computed(() => timerState(this.running(), this.remainingMs()));
  protected readonly progress = computed(() =>
    this.totalMs() > 0 ? Math.min(1, Math.max(0, this.remainingMs() / this.totalMs())) : 0,
  );
}
