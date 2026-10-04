import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { ExerciseCatalogService } from '../../core/exercises/exercise-catalog.service';
import { HistorySetFact } from '../../core/history/history-insights';
import { HistorySummary } from '../../core/history/history-stats';
import { HistoryDetail, HistoryService } from '../../core/history/history.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { HistoryDetailPage } from './history-detail-page';

describe('HistoryDetailPage', () => {
  const detail: HistoryDetail = {
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
          { id: 'b', weightKg: 82.5, reps: 8, isExtra: true, record: true },
        ],
      },
    ],
  };

  /** The same plan two days earlier: 50 minutes, 1200 kg, 3 sets. */
  const earlier: HistorySummary = {
    ...detail.summary,
    id: 's0',
    startedAt: '2026-09-29T12:00:00.000Z',
    finishedAt: '2026-09-29T12:50:00.000Z',
    setCount: 3,
    volumeKg: 1200,
  };
  const fact = (id: string, sessionId: string, startedAt: string, weightKg: number) =>
    ({
      id,
      sessionId,
      exerciseId: 'e1',
      startedAt,
      completedAt: startedAt,
      weightKg,
      reps: 8,
    }) satisfies HistorySetFact;

  async function setup(found: boolean, confirmed = true) {
    const remove = vi.fn().mockResolvedValue(undefined);
    TestBed.configureTestingModule({
      imports: [
        HistoryDetailPage,
        TranslocoTestingModule.forRoot({
          langs: {
            de: {
              history: {
                volume: '{{volume}} {{unit}}',
                minutes: '{{minutes}} Min.',
                compare: 'Verglichen mit {{day}}',
                exerciseVolume: 'Volumen {{volume}}',
              },
            },
          },
          translocoConfig: { defaultLang: 'de', availableLangs: ['de'] },
        }),
      ],
      providers: [
        provideRouter([]),
        {
          provide: HistoryService,
          useValue: {
            detail: async () => (found ? detail : undefined),
            delete: remove,
            summaries: signal([detail.summary, earlier]),
            facts: signal([
              fact('x', 's0', earlier.startedAt, 75),
              fact('a', 's1', detail.summary.startedAt, 80),
              fact('b', 's1', detail.summary.startedAt, 82.5),
            ]),
            load: async () => undefined,
            loadFacts: async () => undefined,
          },
        },
        { provide: ConfirmService, useValue: { confirm: async () => confirmed } },
        {
          provide: ExerciseCatalogService,
          useValue: { load: async () => undefined, nameById: () => 'Bankdrücken' },
        },
      ],
    });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(HistoryDetailPage);
    fixture.componentRef.setInput('sessionId', 's1');
    fixture.detectChanges();
    // ngOnInit is async and not tracked by whenStable: let its promises settle.
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();
    return { fixture, navigate, remove, el: fixture.nativeElement as HTMLElement };
  }

  it('sends unknown or deleted workouts back to the history', async () => {
    const { navigate } = await setup(false);
    expect(navigate).toHaveBeenCalledWith(['/history'], { replaceUrl: true });
  });

  it('lists the completed sets with one badge each, record first', async () => {
    const { el } = await setup(true);
    expect(el.querySelector('h1')?.textContent).toContain('Oberkörper');
    const rows = el.querySelectorAll('li');
    expect(rows).toHaveLength(2);
    expect(rows[0].querySelector('[hlmBadge]')).toBeNull();
    expect(rows[1].querySelectorAll('[hlmBadge]')).toHaveLength(1);
    expect(rows[1].querySelector('[hlmBadge]')?.getAttribute('data-variant')).toBe('success');
  });

  it('compares with the last workout of the plan and links to the plan history', async () => {
    const { el, navigate } = await setup(true);
    const figures = el.querySelector('app-key-figures')!;
    const deltas = [...figures.querySelectorAll('dd.order-3')].map((dd) => [
      dd.textContent?.trim(),
      dd.classList.contains('text-success'),
    ]);
    // Duration is never good or bad; more volume is, fewer sets are not.
    expect(deltas).toEqual([
      ['+4 Min.', false],
      ['+100 kg', true],
      ['−1', false],
    ]);
    expect(figures.textContent).toContain('Verglichen mit');
    // The exercise moved 1300 kg against 600 kg last time.
    expect(el.querySelector('section header p')?.textContent).toMatch(
      /Volumen 1.?300 kg\s*\+700 kg/,
    );

    el.querySelector<HTMLButtonElement>('app-key-figures + button')!.click();
    expect(navigate).toHaveBeenCalledWith(['/history/plans', 'p1']);
  });

  it('deletes after confirmation and returns to the history', async () => {
    const { fixture, navigate, remove } = await setup(true);
    await (fixture.componentInstance as unknown as { delete(): Promise<void> }).delete();
    expect(remove).toHaveBeenCalledWith('s1');
    expect(navigate).toHaveBeenCalledWith(['/history'], {
      queryParams: { view: null },
      replaceUrl: true,
    });
  });
});
