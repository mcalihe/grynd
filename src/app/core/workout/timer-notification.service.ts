import { inject, Injectable, InjectionToken } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { TranslocoService } from '@jsverse/transloco';

/** The one notification the app schedules; scheduling again replaces it. */
export const TIMER_NOTIFICATION_ID = 1;

/** Subset of the Local Notifications plugin we use; replaced by a fake in tests. */
export type NotificationsPlugin = Pick<
  typeof LocalNotifications,
  'checkPermissions' | 'requestPermissions' | 'schedule' | 'cancel'
>;

export const LOCAL_NOTIFICATIONS = new InjectionToken<NotificationsPlugin | null>(
  'LOCAL_NOTIFICATIONS',
  {
    providedIn: 'root',
    factory: () => (Capacitor.isNativePlatform() ? LocalNotifications : null),
  },
);

/**
 * Rest-timer end as a local notification (decision 0014), so it rings while the app is in the
 * background. Calls run one after another, so a quick start/stop can never leave a stale one.
 */
@Injectable({ providedIn: 'root' })
export class TimerNotificationService {
  private readonly plugin = inject(LOCAL_NOTIFICATIONS);
  private readonly transloco = inject(TranslocoService);
  private queue: Promise<unknown> = Promise.resolve();
  private permission?: Promise<boolean>;

  /** Schedules (or moves) the notification to `endAt` (epoch ms). */
  schedule(endAt: number): Promise<void> {
    return this.enqueue(async (plugin) => {
      if (!(await this.allowed(plugin))) {
        return;
      }
      await plugin.schedule({
        notifications: [
          {
            id: TIMER_NOTIFICATION_ID,
            title: this.transloco.translate('workout.timer.doneTitle'),
            body: this.transloco.translate('workout.timer.doneText'),
            schedule: { at: new Date(endAt), allowWhileIdle: true },
          },
        ],
      });
    });
  }

  cancel(): Promise<void> {
    return this.enqueue((plugin) =>
      plugin.cancel({ notifications: [{ id: TIMER_NOTIFICATION_ID }] }),
    );
  }

  /** Asks once per app start; a refusal only means no notification, the timer still runs. */
  private allowed(plugin: NotificationsPlugin): Promise<boolean> {
    this.permission ??= (async () => {
      let { display } = await plugin.checkPermissions();
      if (display === 'prompt' || display === 'prompt-with-rationale') {
        ({ display } = await plugin.requestPermissions());
      }
      return display === 'granted';
    })().catch(() => false);
    return this.permission;
  }

  private enqueue(work: (plugin: NotificationsPlugin) => Promise<unknown>): Promise<void> {
    const plugin = this.plugin;
    if (!plugin) {
      return Promise.resolve();
    }
    const next = this.queue.then(() => work(plugin)).catch(() => undefined);
    this.queue = next;
    return next.then(() => undefined);
  }
}
