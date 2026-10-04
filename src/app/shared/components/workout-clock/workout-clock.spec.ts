import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { formatElapsed, WorkoutClock } from './workout-clock';

describe('formatElapsed', () => {
  it('formats m:ss below an hour and drops partial seconds', () => {
    expect(formatElapsed(0)).toBe('0:00');
    expect(formatElapsed(999)).toBe('0:00');
    expect(formatElapsed(8_000)).toBe('0:08');
    expect(formatElapsed(1_453_900)).toBe('24:13');
    expect(formatElapsed(3_599_999)).toBe('59:59');
  });

  it('adds hours from one hour on', () => {
    expect(formatElapsed(3_600_000)).toBe('1:00:00');
    expect(formatElapsed(3_729_000)).toBe('1:02:09');
    expect(formatElapsed(26 * 3_600_000 + 5_000)).toBe('26:00:05');
  });

  it('never goes below zero', () => {
    expect(formatElapsed(-5_000)).toBe('0:00');
  });
});

describe('WorkoutClock', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        WorkoutClock,
        TranslocoTestingModule.forRoot({
          langs: { de: { workout: { end: 'Training beenden ({{time}})' } } },
          translocoConfig: { availableLangs: ['de'], defaultLang: 'de' },
        }),
      ],
    });
  });

  it('shows the elapsed time and emits stop on tap', () => {
    const fixture = TestBed.createComponent(WorkoutClock);
    const stop = vi.fn();
    fixture.componentInstance.stop.subscribe(stop);
    fixture.componentRef.setInput('elapsedMs', 1_453_900);
    fixture.detectChanges();

    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    expect(button.textContent?.trim()).toBe('24:13');
    expect(button.getAttribute('aria-label')).toBe('Training beenden (24:13)');
    button.click();
    expect(stop).toHaveBeenCalledOnce();
  });
});
