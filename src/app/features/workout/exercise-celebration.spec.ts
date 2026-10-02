import { TestBed } from '@angular/core/testing';
import { CelebrationService } from '../../shared/motion/celebration.service';
import { ExerciseCelebration, STATIC_HOLD_MS } from './exercise-celebration';

describe('ExerciseCelebration', () => {
  const celebration = { exercise: vi.fn() };

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      providers: [{ provide: CelebrationService, useValue: celebration }],
    });
  });

  afterEach(() => vi.useRealTimers());

  function create() {
    const fixture = TestBed.createComponent(ExerciseCelebration);
    fixture.componentRef.setInput('praise', 'Stark!');
    fixture.componentRef.setInput('subline', 'Übung 2 von 5 geschafft');
    const landed = vi.fn();
    const done = vi.fn();
    fixture.componentInstance.landed.subscribe(landed);
    fixture.componentInstance.done.subscribe(done);
    fixture.detectChanges();
    return { fixture, landed, done };
  }

  it('shows the praise, bursts and finishes after a moment (no animations in jsdom)', async () => {
    const { fixture, landed, done } = create();
    expect(fixture.nativeElement.textContent).toContain('Stark!');
    expect(fixture.nativeElement.textContent).toContain('Übung 2 von 5 geschafft');
    expect(celebration.exercise).toHaveBeenCalledOnce();
    expect(done).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(STATIC_HOLD_MS);
    expect(landed).toHaveBeenCalledOnce();
    expect(done).toHaveBeenCalledOnce();
  });

  it('stays silent when removed early', async () => {
    const { fixture, done } = create();
    fixture.destroy();
    await vi.advanceTimersByTimeAsync(STATIC_HOLD_MS);
    expect(done).not.toHaveBeenCalled();
  });
});
