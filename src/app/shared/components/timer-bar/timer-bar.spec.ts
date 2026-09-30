import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { formatClock, TimerBar, timerState } from './timer-bar';

describe('timer bar logic', () => {
  it('formats m:ss and rounds up partial seconds', () => {
    expect(formatClock(90_000)).toBe('1:30');
    expect(formatClock(72_001)).toBe('1:13');
    expect(formatClock(8_000)).toBe('0:08');
    expect(formatClock(1)).toBe('0:01');
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(-500)).toBe('0:00');
    expect(formatClock(180_000)).toBe('3:00');
  });

  it('switches to warning in the last 10 seconds', () => {
    expect(timerState(false, 5_000)).toBe('ready');
    expect(timerState(true, 10_001)).toBe('running');
    expect(timerState(true, 10_000)).toBe('warning');
  });
});

describe('TimerBar', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TimerBar, TranslocoTestingModule.forRoot({ langs: { de: {} } })],
    });
  });

  it('shows the default duration and emits start when ready', () => {
    const fixture = TestBed.createComponent(TimerBar);
    const start = vi.fn();
    fixture.componentInstance.start.subscribe(start);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('1:30');
    const buttons: HTMLButtonElement[] = [...fixture.nativeElement.querySelectorAll('button')];
    buttons.at(-1)?.click();
    expect(start).toHaveBeenCalledOnce();
  });

  it('shows remaining time and emits adjust/stop while running', () => {
    const fixture = TestBed.createComponent(TimerBar);
    const adjust = vi.fn();
    const stop = vi.fn();
    fixture.componentInstance.adjust.subscribe(adjust);
    fixture.componentInstance.stop.subscribe(stop);
    fixture.componentRef.setInput('running', true);
    fixture.componentRef.setInput('remainingMs', 72_000);
    fixture.componentRef.setInput('totalMs', 90_000);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role=timer]').textContent.trim()).toBe('1:12');
    const [minus, plus, stopButton] = fixture.nativeElement.querySelectorAll('button');
    minus.click();
    plus.click();
    stopButton.click();
    expect(adjust.mock.calls).toEqual([[-15], [15]]);
    expect(stop).toHaveBeenCalledOnce();
  });

  it('marks the warning state', () => {
    const fixture = TestBed.createComponent(TimerBar);
    fixture.componentRef.setInput('running', true);
    fixture.componentRef.setInput('remainingMs', 8_000);
    fixture.componentRef.setInput('totalMs', 90_000);
    fixture.detectChanges();

    expect(fixture.nativeElement.getAttribute('data-state')).toBe('warning');
  });
});
