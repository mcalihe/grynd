import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { provideMemorySettings } from '../../../testing/settings';
import { FakeClock } from '../../../testing/test-database';
import { Clock } from '../utils/time';
import { RestTimerService } from './rest-timer.service';
import {
  LOCAL_NOTIFICATIONS,
  NotificationsPlugin,
  TIMER_NOTIFICATION_ID,
  TimerNotificationService,
} from './timer-notification.service';

function fakePlugin(display: 'granted' | 'denied' | 'prompt' = 'granted') {
  return {
    checkPermissions: vi.fn().mockResolvedValue({ display }),
    requestPermissions: vi.fn().mockResolvedValue({ display: 'granted' }),
    schedule: vi.fn().mockResolvedValue({ notifications: [] }),
    cancel: vi.fn().mockResolvedValue(undefined),
  };
}

function setup(plugin: ReturnType<typeof fakePlugin> | null) {
  localStorage.clear();
  TestBed.configureTestingModule({
    imports: [TranslocoTestingModule.forRoot({ langs: { de: {} } })],
    providers: [
      { provide: LOCAL_NOTIFICATIONS, useValue: plugin as NotificationsPlugin | null },
      { provide: Clock, useValue: new FakeClock(new Date('2026-10-01T10:00:00.000Z')) },
      provideMemorySettings(),
    ],
  });
  return TestBed.inject(TimerNotificationService);
}

describe('TimerNotificationService', () => {
  it('schedules at the end time and cancels by id', async () => {
    const plugin = fakePlugin();
    const service = setup(plugin);
    await service.schedule(Date.parse('2026-10-01T10:01:30.000Z'));
    await service.cancel();

    const [{ notifications }] = plugin.schedule.mock.calls[0];
    expect(notifications[0].id).toBe(TIMER_NOTIFICATION_ID);
    expect(notifications[0].schedule.at.toISOString()).toBe('2026-10-01T10:01:30.000Z');
    expect(plugin.cancel).toHaveBeenCalledWith({ notifications: [{ id: TIMER_NOTIFICATION_ID }] });
  });

  it('asks for permission once and stays quiet when it is refused', async () => {
    const plugin = fakePlugin('prompt');
    plugin.requestPermissions.mockResolvedValue({ display: 'denied' });
    const service = setup(plugin);
    await service.schedule(1);
    await service.schedule(2);
    expect(plugin.requestPermissions).toHaveBeenCalledOnce();
    expect(plugin.schedule).not.toHaveBeenCalled();
  });

  it('does nothing in the browser', async () => {
    const service = setup(null);
    await expect(service.schedule(1)).resolves.toBeUndefined();
    await expect(service.cancel()).resolves.toBeUndefined();
  });

  it('follows the rest timer: start and ±15 s schedule, stop cancels', async () => {
    const plugin = fakePlugin();
    setup(plugin);
    const timer = TestBed.inject(RestTimerService);
    const service = TestBed.inject(TimerNotificationService);

    timer.start(90);
    timer.adjust(15);
    timer.stop();
    await service.cancel(); // waits for the queue

    const times = plugin.schedule.mock.calls.map(([{ notifications }]) =>
      notifications[0].schedule.at.toISOString(),
    );
    expect(times).toEqual(['2026-10-01T10:01:30.000Z', '2026-10-01T10:01:45.000Z']);
    expect(plugin.cancel).toHaveBeenCalled();
  });
});
