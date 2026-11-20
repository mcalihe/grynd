import { Location } from '@angular/common';
import { provideLocationMocks } from '@angular/common/testing';
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
import { ExerciseHistoryPage } from './exercise-history-page';

describe('ExerciseHistoryPage (decision 0028)', () => {
  const PLANS: Record<string, string> = { p1: 'Oberkörper', p2: 'Ganzkörper' };
  const workout = (id: string, day: number, planId: string): HistorySummary => ({
    id,
    planId,
    planName: PLANS[planId],
    startedAt: new Date(2026, 8, day, 18).toISOString(),
    finishedAt: new Date(2026, 8, day, 18, 40).toISOString(),
    pausedMs: 0,
    exerciseCount: 1,
    setCount: 1,
    volumeKg: 0,
    activityId: null,
    cardioCount: 0,
    distanceM: 0,
    bodyWeightKg: null,
    energy: null,
  });
  const fact = (sessionId: string, day: number, planId: string, weightKg: number) =>
    ({
      id: `${sessionId}-${weightKg}`,
      sessionId,
      planId,
      exerciseId: 'bench',
      startedAt: new Date(2026, 8, day, 18).toISOString(),
      completedAt: new Date(2026, 8, day, 18, 5).toISOString(),
      weightKg,
      reps: 5,
    }) satisfies HistorySetFact;

  const summaries = [workout('c', 24, 'p1'), workout('b', 17, 'p2'), workout('a', 10, 'p1')];
  const facts = [fact('a', 10, 'p1', 80), fact('b', 17, 'p2', 60), fact('c', 24, 'p1', 85)];

  async function setup(plan?: string, exerciseFacts: HistorySetFact[] = facts) {
    TestBed.configureTestingModule({
      imports: [
        ExerciseHistoryPage,
        TranslocoTestingModule.forRoot({
          langs: { de: { 'history.setValue': '{{weight}} {{unit}} × {{reps}}' } },
          translocoConfig: { defaultLang: 'de', availableLangs: ['de'] },
        }),
      ],
      providers: [
        provideRouter([]),
        provideLocationMocks(),
        { provide: Clock, useValue: new FakeClock(new Date(2026, 9, 1, 12)) },
        {
          provide: HistoryService,
          useValue: {
            summaries: signal(summaries),
            facts: signal(exerciseFacts),
            load: async () => undefined,
            loadFacts: async () => undefined,
          },
        },
        {
          provide: ExerciseCatalogService,
          useValue: { load: async () => undefined, nameById: () => 'Bankdrücken' },
        },
      ],
    });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(ExerciseHistoryPage);
    fixture.componentRef.setInput('exerciseId', 'bench');
    fixture.componentRef.setInput('plan', plan);
    fixture.detectChanges();
    // ngOnInit is async and not tracked by whenStable: let its promises settle.
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const chips = () => [
      ...el.querySelectorAll<HTMLButtonElement>('[data-filter="plans"] [role="radio"]'),
    ];
    const replaceState = vi.spyOn(TestBed.inject(Location), 'replaceState');
    const rows = () => [...el.querySelectorAll<HTMLButtonElement>('app-history-row button')];
    const click = (button: HTMLButtonElement) => {
      button.click();
      fixture.detectChanges();
    };
    return { el, navigate, chips, rows, click, replaceState };
  }

  it('shows every plan, the latest workout per plan and every workout with its sets', async () => {
    const { el, navigate, chips, rows } = await setup();
    expect(el.querySelector('h1')?.textContent).toContain('Bankdrücken');
    expect(chips().map((c) => [c.textContent?.trim(), c.getAttribute('aria-checked')])).toEqual([
      ['history.exercise.allPlans', 'true'],
      ['Oberkörper', 'false'],
      ['Ganzkörper', 'false'],
    ]);
    expect(el.querySelectorAll('[data-card="by-plan"] li')).toHaveLength(2);
    // Workouts of different plans are no trend; «Nach Plan» has one per plan.
    expect(el.textContent).not.toContain('history.plan.trend');
    expect(el.querySelectorAll('app-bar-chart [data-filled]')).toHaveLength(3);

    expect(rows()).toHaveLength(3);
    expect(rows()[0].textContent).toContain('Oberkörper');
    expect(rows()[0].textContent).toContain('85 kg × 5');
    rows()[0].click();
    expect(navigate).toHaveBeenCalledWith(['/history', 'c']);
  });

  it('shows one plan from the query parameter and switches with the chips', async () => {
    const { el, chips, rows, click, replaceState } = await setup('p1');
    expect(chips()[1].getAttribute('aria-checked')).toBe('true');
    expect(rows()).toHaveLength(2);
    expect(el.textContent).toContain('history.plan.trend');
    expect(el.querySelector('[data-card="by-plan"]')).toBeNull();

    click(chips()[2]);
    expect(rows()).toHaveLength(1);
    expect(rows()[0].textContent).toContain('60 kg × 5');
    expect(replaceState).toHaveBeenLastCalledWith(expect.any(String), 'plan=p2');

    click(chips()[0]);
    expect(rows()).toHaveLength(3);
    expect(replaceState).toHaveBeenLastCalledWith(expect.any(String), '');
  });

  it('picks the plan from its row in «Nach Plan»', async () => {
    const { el, rows, click } = await setup();
    click(el.querySelectorAll<HTMLButtonElement>('[data-card="by-plan"] button')[1]);
    expect(rows()).toHaveLength(1);
  });

  it('shows all plans for a plan the exercise was not trained in', async () => {
    const { rows } = await setup('p9');
    expect(rows()).toHaveLength(3);
  });

  it('leaves out the plan filter when the exercise was trained in one plan only', async () => {
    const { chips, rows, el } = await setup('p1', [facts[0], facts[2]]);
    expect(chips()).toHaveLength(0);
    expect(el.querySelector('[data-card="by-plan"]')).toBeNull();
    expect(rows()[0].textContent).not.toContain('Oberkörper');
  });

  it('says so for an exercise without workouts', async () => {
    const { el, rows } = await setup(undefined, []);
    expect(rows()).toHaveLength(0);
    expect(el.textContent).toContain('history.exercise.empty');
  });
});
