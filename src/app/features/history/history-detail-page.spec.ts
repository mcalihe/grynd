import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { ExerciseCatalogService } from '../../core/exercises/exercise-catalog.service';
import { HistoryDetail, HistoryService } from '../../core/history/history.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { HistoryDetailPage } from './history-detail-page';

describe('HistoryDetailPage', () => {
  const detail: HistoryDetail = {
    summary: {
      id: 's1',
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

  async function setup(found: boolean, confirmed = true) {
    const remove = vi.fn().mockResolvedValue(undefined);
    TestBed.configureTestingModule({
      imports: [HistoryDetailPage, TranslocoTestingModule.forRoot({ langs: { de: {} } })],
      providers: [
        provideRouter([]),
        {
          provide: HistoryService,
          useValue: { detail: async () => (found ? detail : undefined), delete: remove },
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

  it('deletes after confirmation and returns to the list', async () => {
    const { fixture, navigate, remove } = await setup(true);
    await (fixture.componentInstance as unknown as { delete(): Promise<void> }).delete();
    expect(remove).toHaveBeenCalledWith('s1');
    expect(navigate).toHaveBeenCalledWith(['/history'], { replaceUrl: true });
  });
});
