import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { PausedWorkoutBar } from './paused-workout-bar';

describe('PausedWorkoutBar', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        PausedWorkoutBar,
        TranslocoTestingModule.forRoot({
          langs: {
            de: {
              'workout.title': 'Training',
              'workout.pausedBar.status': 'Pausiert · {{time}}',
              'workout.pausedBar.label': 'Pausiertes Training öffnen: {{name}}, {{time}}',
            },
          },
          translocoConfig: { availableLangs: ['de'], defaultLang: 'de' },
        }),
      ],
    });
  });

  const render = (planName: string) => {
    const fixture = TestBed.createComponent(PausedWorkoutBar);
    fixture.componentRef.setInput('planName', planName);
    fixture.componentRef.setInput('elapsedMs', 1_453_900);
    fixture.detectChanges();
    return fixture;
  };

  it('shows the plan and the frozen time and emits open on tap', () => {
    const fixture = render('Oberkörper');
    const open = vi.fn();
    fixture.componentInstance.open.subscribe(open);

    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    expect(button.textContent?.replace(/\s+/g, ' ').trim()).toBe('Oberkörper Pausiert · 24:13');
    expect(button.getAttribute('aria-label')).toBe('Pausiertes Training öffnen: Oberkörper, 24:13');
    button.click();
    expect(open).toHaveBeenCalledOnce();
  });

  it('falls back to «Training» without a plan name', () => {
    const button: HTMLButtonElement = render('').nativeElement.querySelector('button');
    expect(button.getAttribute('aria-label')).toBe('Pausiertes Training öffnen: Training, 24:13');
  });
});
