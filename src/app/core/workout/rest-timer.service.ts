import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { HapticsService } from '../services/haptics.service';
import { SettingsService } from '../settings/settings.service';
import { Clock } from '../utils/time';
import { TimerNotificationService } from './timer-notification.service';

const STORAGE_KEY = 'grynd.restTimer';
const TICK_MS = 250;

interface TimerState {
  /** Epoch ms when the rest is over. */
  endAt: number;
  totalMs: number;
}

/**
 * Rest timer between sets (plan.md §8). Stores the end time, never a counter, so it survives a
 * reload and background throttling; the remaining time is always derived from the clock.
 */
@Injectable({ providedIn: 'root' })
export class RestTimerService {
  private readonly clock = inject(Clock);
  private readonly settings = inject(SettingsService);
  private readonly haptics = inject(HapticsService);
  private readonly notification = inject(TimerNotificationService);
  private readonly state = signal<TimerState | null>(this.read());
  private readonly now = signal(this.clock.now().getTime());
  private tick?: ReturnType<typeof setInterval>;

  readonly running = computed(() => this.state() !== null);
  readonly totalMs = computed(() => this.state()?.totalMs ?? 0);
  readonly remainingMs = computed(() => {
    const state = this.state();
    return state ? Math.max(0, state.endAt - this.now()) : 0;
  });

  constructor() {
    if (this.state()) {
      this.startTicking();
    }
    inject(DestroyRef).onDestroy(() => this.stopTicking());
  }

  start(seconds: number): void {
    const totalMs = Math.max(0, seconds) * 1000;
    this.set({ endAt: this.clock.now().getTime() + totalMs, totalMs });
    this.now.set(this.clock.now().getTime());
    this.startTicking();
  }

  /** After a set was checked: starts only when «Timer automatisch starten» is on. */
  autoStart(seconds: number): void {
    if (this.settings.settings().timerAutostart) {
      this.start(seconds);
    }
  }

  /** −15 / +15 seconds; the bar length follows the new total. */
  adjust(seconds: number): void {
    const state = this.state();
    if (!state) {
      return;
    }
    const delta = seconds * 1000;
    this.set({ endAt: state.endAt + delta, totalMs: Math.max(0, state.totalMs + delta) });
    this.update();
  }

  stop(): void {
    this.set(null);
    this.stopTicking();
  }

  /** Recomputes the remaining time; ends the rest when it reaches zero. */
  update(): void {
    this.now.set(this.clock.now().getTime());
    if (this.state() && this.remainingMs() === 0) {
      this.stop();
      // In the background the scheduled notification brings the sound.
      this.haptics.success();
    }
  }

  private startTicking(): void {
    this.stopTicking();
    this.tick = setInterval(() => this.update(), TICK_MS);
  }

  private stopTicking(): void {
    clearInterval(this.tick);
    this.tick = undefined;
  }

  private set(state: TimerState | null): void {
    this.state.set(state);
    void (state ? this.notification.schedule(state.endAt) : this.notification.cancel());
    try {
      if (state) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // Without storage the timer still works, it just does not survive a reload.
    }
  }

  private read(): TimerState | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? (JSON.parse(raw) as TimerState) : null;
      return parsed && typeof parsed.endAt === 'number' ? parsed : null;
    } catch {
      return null;
    }
  }
}
