import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { provideMemorySettings } from '../../../testing/settings';
import { SettingsService } from '../settings/settings.service';
import { FakeClock } from '../../../testing/test-database';
import { Clock } from '../utils/time';
import { RestTimerService } from './rest-timer.service';

describe('RestTimerService', () => {
  let clock: FakeClock;

  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    clock = new FakeClock();
    TestBed.configureTestingModule({
      imports: [TranslocoTestingModule.forRoot({ langs: { de: {} } })],
      providers: [{ provide: Clock, useValue: clock }, provideMemorySettings()],
    });
  });

  afterEach(() => vi.useRealTimers());

  it('derives the remaining time from the stored end time', () => {
    const timer = TestBed.inject(RestTimerService);
    timer.start(90);
    expect(timer.running()).toBe(true);
    expect(timer.remainingMs()).toBe(90_000);

    clock.advance(18_000);
    timer.update();
    expect(timer.remainingMs()).toBe(72_000);
    expect(timer.totalMs()).toBe(90_000);
  });

  it('starts automatically only when autostart is on', async () => {
    const timer = TestBed.inject(RestTimerService);
    timer.autoStart(90);
    expect(timer.running()).toBe(true);
    timer.stop();

    await TestBed.inject(SettingsService).update({ timerAutostart: false });
    timer.autoStart(90);
    expect(timer.running()).toBe(false);
  });

  it('adjusts by ±15 seconds', () => {
    const timer = TestBed.inject(RestTimerService);
    timer.start(60);
    timer.adjust(15);
    expect(timer.remainingMs()).toBe(75_000);
    timer.adjust(-15);
    timer.adjust(-15);
    expect(timer.remainingMs()).toBe(45_000);
  });

  it('stops by itself when the rest is over', () => {
    const timer = TestBed.inject(RestTimerService);
    timer.start(30);
    clock.advance(31_000);
    vi.advanceTimersByTime(250);
    expect(timer.running()).toBe(false);
    expect(timer.remainingMs()).toBe(0);
  });

  it('survives a reload via the stored end time', () => {
    TestBed.inject(RestTimerService).start(120);
    clock.advance(20_000);

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [TranslocoTestingModule.forRoot({ langs: { de: {} } })],
      providers: [{ provide: Clock, useValue: clock }, provideMemorySettings()],
    });
    const restored = TestBed.inject(RestTimerService);
    expect(restored.running()).toBe(true);
    expect(restored.remainingMs()).toBe(100_000);
  });

  it('stop clears the stored state', () => {
    const timer = TestBed.inject(RestTimerService);
    timer.start(60);
    timer.stop();
    expect(timer.running()).toBe(false);
    expect(localStorage.getItem('grynd.restTimer')).toBeNull();
  });
});
