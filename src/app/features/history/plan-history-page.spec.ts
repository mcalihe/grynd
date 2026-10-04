import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { FakeClock } from '../../../testing/test-database';
import { ExerciseCatalogService } from '../../core/exercises/exercise-catalog.service';
import { HistorySetFact } from '../../core/history/history-insights';
import { HistorySummary } from '../../core/history/history-stats';
import { HistoryService } from '../../core/history/history.service';
import { Clock } from '../../core/utils/time';
import { PlanHistoryPage } from './plan-history-page';

describe('PlanHistoryPage', () => {
  const workout = (id: string, day: number, volumeKg: number, planId = 'p1'): HistorySummary => ({
    id,
    planId,
    planName: 'Beine',
    startedAt: new Date(2026, 8, day, 18).toISOString(),
    finishedAt: new Date(2026, 8, day, 18, 40).toISOString(),
    exerciseCount: 1,
    setCount: 3,
    volumeKg,
  });
  const fact = (sessionId: string, day: number, weightKg: number): HistorySetFact => ({
    id: `${sessionId}-${weightKg}`,
    sessionId,
    exerciseId: 'squat',
    startedAt: new Date(2026, 8, day, 18).toISOString(),
    completedAt: new Date(2026, 8, day, 18, 5).toISOString(),
    weightKg,
    reps: 5,
  });

  async function setup(summaries: HistorySummary[], facts: HistorySetFact[]) {
    TestBed.configureTestingModule({
      imports: [
        PlanHistoryPage,
        TranslocoTestingModule.forRoot({
          langs: { de: { history: { plan: { trend: '{{delta}} seit {{since}}' } } } },
          translocoConfig: { defaultLang: 'de', availableLangs: ['de'] },
        }),
      ],
      providers: [
        provideRouter([]),
        { provide: Clock, useValue: new FakeClock(new Date(2026, 9, 1, 12)) },
        {
          provide: HistoryService,
          useValue: {
            summaries: signal(summaries),
            facts: signal(facts),
            load: async () => undefined,
            loadFacts: async () => undefined,
          },
        },
        {
          provide: ExerciseCatalogService,
          useValue: { load: async () => undefined, nameById: () => 'Kniebeuge' },
        },
      ],
    });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(PlanHistoryPage);
    fixture.componentRef.setInput('planId', 'p1');
    fixture.detectChanges();
    // ngOnInit is async and not tracked by whenStable: let its promises settle.
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();
    return { navigate, el: fixture.nativeElement as HTMLElement };
  }

  it('shows the workouts of one plan with a bar each and the strength trend', async () => {
    const { el, navigate } = await setup(
      [
        workout('c', 24, 3000),
        workout('other', 23, 9000, 'p2'),
        workout('b', 17, 2500),
        workout('a', 10, 2000),
      ],
      [fact('a', 10, 100), fact('b', 17, 105), fact('c', 24, 110)],
    );
    expect(el.querySelector('h1')?.textContent).toContain('Beine');
    expect(el.querySelectorAll('app-bar-chart [data-filled]')).toHaveLength(3);
    expect(el.querySelectorAll('app-sparkline polyline')).toHaveLength(1);
    // Volume rose by half from the first to the latest workout.
    expect(el.textContent).toMatch(/\+50\s?% seit/);

    const rows = el.querySelectorAll<HTMLButtonElement>('app-history-row button');
    expect(rows).toHaveLength(3);
    rows[0].click();
    expect(navigate).toHaveBeenCalledWith(['/history', 'c']);
  });

  it('returns to the history for a plan without workouts', async () => {
    const { navigate } = await setup([workout('other', 23, 9000, 'p2')], []);
    expect(navigate).toHaveBeenCalledWith(['/history'], { replaceUrl: true });
  });
});
