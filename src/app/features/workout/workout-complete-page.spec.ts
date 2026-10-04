import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { provideIcons } from '@ng-icons/core';
import { lucideTrophy } from '@ng-icons/lucide';
import { HistoryDetail, HistoryService } from '../../core/history/history.service';
import { BackButtonService } from '../../core/services/back-button.service';
import { CelebrationService } from '../../shared/motion/celebration.service';
import { provideMemorySettings } from '../../../testing/settings';
import { completeStats, WorkoutCompletePage } from './workout-complete-page';

describe('WorkoutCompletePage', () => {
  const detail = (records: boolean): HistoryDetail => ({
    summary: {
      id: 's1',
      planId: 'p1',
      planName: 'Oberkörper',
      startedAt: '2026-10-01T12:00:00.000Z',
      finishedAt: '2026-10-01T12:54:00.000Z',
      exerciseCount: 1,
      setCount: 2,
      volumeKg: 1300,
    },
    exercises: [
      {
        exerciseId: 'e1',
        timeMs: 12 * 60_000,
        sets: [
          { id: 'a', weightKg: 80, reps: 8, isExtra: false, record: false },
          { id: 'b', weightKg: 82.5, reps: 8, isExtra: false, record: records },
        ],
      },
    ],
  });

  const celebration = { finale: vi.fn(() => stop), record: vi.fn() };
  const stop = vi.fn();
  const backButton = { setHandler: vi.fn() };

  async function setup(found: HistoryDetail | undefined) {
    TestBed.configureTestingModule({
      imports: [
        WorkoutCompletePage,
        TranslocoTestingModule.forRoot({
          langs: {
            de: {
              workout: { complete: { title: 'Training geschafft!', records: 'Rekorde' } },
              history: {
                minutes: '{{minutes}} Min.',
                volume: '{{volume}} {{unit}}',
                stats: { duration: 'Dauer', volume: 'Volumen', sets: 'Sätze' },
              },
            },
          },
          translocoConfig: { defaultLang: 'de', availableLangs: ['de'] },
          preloadLangs: true,
        }),
      ],
      providers: [
        provideRouter([]),
        provideIcons({ lucideTrophy }),
        provideMemorySettings(),
        { provide: HistoryService, useValue: { detail: async () => found } },
        { provide: CelebrationService, useValue: celebration },
        { provide: BackButtonService, useValue: backButton },
      ],
    });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(WorkoutCompletePage);
    fixture.componentRef.setInput('sessionId', 's1');
    fixture.detectChanges();
    // ngOnInit is async and not tracked by whenStable: let its promises settle.
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();
    return { fixture, navigate, el: fixture.nativeElement as HTMLElement };
  }

  afterEach(() => vi.clearAllMocks());

  it('counts records from the sets', () => {
    expect(completeStats(detail(true))).toEqual({
      durationMs: 54 * 60_000,
      volumeKg: 1300,
      sets: 2,
      records: 1,
    });
  });

  it('shows the final figures, fires the finale and celebrates the records', async () => {
    const { el } = await setup(detail(true));
    expect(el.querySelector('h1')?.getAttribute('aria-label')).toBe('Training geschafft!');
    expect(el.textContent).toContain('Oberkörper');
    const stats = [...el.querySelectorAll('[data-stat] dd')].map((s) => s.textContent?.trim());
    expect(stats).toEqual(['54 Min.', '1.300 kg', '2', '1']);
    // Duration and records take the full width, volume and sets share a row.
    const wide = [...el.querySelectorAll('[data-stat].col-span-2')].map((s) =>
      s.getAttribute('data-stat'),
    );
    expect(wide).toEqual(['duration', 'records']);
    expect(celebration.finale).toHaveBeenCalledOnce();
    expect(celebration.record).toHaveBeenCalledOnce();
  });

  it('hides the records card without records and stops the finale on leave', async () => {
    const { el, fixture } = await setup(detail(false));
    expect(el.querySelector('[data-stat="records"]')).toBeNull();
    expect(el.querySelector('[data-stat="duration"]')?.classList).toContain('col-span-2');
    fixture.destroy();
    expect(stop).toHaveBeenCalled();
    expect(backButton.setHandler).toHaveBeenLastCalledWith(null);
  });

  it('continues to the history detail, also with the back button', async () => {
    const { navigate, el } = await setup(detail(false));
    el.querySelector<HTMLButtonElement>('app-sticky-action button')!.click();
    expect(navigate).toHaveBeenCalledWith(['/history', 's1'], { replaceUrl: true });

    navigate.mockClear();
    backButton.setHandler.mock.calls[0][0]();
    expect(navigate).toHaveBeenCalledWith(['/history', 's1'], { replaceUrl: true });
  });

  it('sends unknown workouts to the history', async () => {
    const { navigate } = await setup(undefined);
    expect(navigate).toHaveBeenCalledWith(['/history'], { replaceUrl: true });
    expect(celebration.finale).not.toHaveBeenCalled();
  });
});
