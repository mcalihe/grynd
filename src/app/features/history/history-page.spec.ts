import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { FakeClock } from '../../../testing/test-database';
import { ExerciseCatalogService } from '../../core/exercises/exercise-catalog.service';
import { HistorySummary } from '../../core/history/history-stats';
import { HistoryService } from '../../core/history/history.service';
import { Clock } from '../../core/utils/time';
import { HistoryPage } from './history-page';

describe('HistoryPage', () => {
  const summary = (id: string, startedAt: string): HistorySummary => ({
    id,
    planId: 'p1',
    planName: id,
    startedAt,
    finishedAt: new Date(Date.parse(startedAt) + 54 * 60_000).toISOString(),
    exerciseCount: 6,
    setCount: 18,
    volumeKg: 8420,
  });

  function render(summaries: HistorySummary[], view?: string) {
    TestBed.configureTestingModule({
      imports: [
        HistoryPage,
        TranslocoTestingModule.forRoot({
          langs: {
            de: {
              history: {
                thisWeek: 'Diese Woche',
                lastWeek: 'Vorwoche',
                empty: { title: 'Noch keine Trainings' },
              },
            },
          },
          translocoConfig: { defaultLang: 'de', availableLangs: ['de'] },
        }),
      ],
      providers: [
        provideRouter([]),
        // Thursday, 1 Oct 2026
        { provide: Clock, useValue: new FakeClock(new Date(2026, 9, 1, 18)) },
        {
          provide: HistoryService,
          useValue: {
            summaries: signal(summaries),
            loaded: signal(true),
            load: () => Promise.resolve(),
            facts: signal([]),
            factsLoaded: signal(true),
            loadFacts: () => Promise.resolve(),
          },
        },
        {
          provide: ExerciseCatalogService,
          useValue: { byId: signal(new Map()), load: () => Promise.resolve(), nameById: () => '' },
        },
      ],
    });
    const fixture = TestBed.createComponent(HistoryPage);
    if (view) {
      fixture.componentRef.setInput('view', view);
    }
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('groups workouts under this week, last week and older weeks', () => {
    const el = render([
      summary('today', new Date(2026, 9, 1, 9).toISOString()),
      summary('monday', new Date(2026, 8, 28, 9).toISOString()),
      summary('last', new Date(2026, 8, 24, 9).toISOString()),
      summary('older', new Date(2026, 8, 10, 9).toISOString()),
    ]);
    const headings = [...el.querySelectorAll('section h2')].map((h) => h.textContent?.trim());
    expect(headings[0]).toBe('Diese Woche');
    expect(headings[1]).toBe('Vorwoche');
    expect(headings).toHaveLength(3);
    expect(el.querySelectorAll('app-history-row')).toHaveLength(4);
    expect(el.querySelectorAll('[data-filled]')).toHaveLength(2);
  });

  it('switches the view through the query parameter', () => {
    const el = render([summary('today', new Date(2026, 9, 1, 9).toISOString())]);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    el.querySelectorAll<HTMLButtonElement>('[role="radio"]')[1].click();
    expect(navigate).toHaveBeenCalledWith([], {
      queryParams: { view: 'calendar' },
      replaceUrl: true,
    });
  });

  it('shows the calendar and the statistics', () => {
    const sessions = [summary('today', new Date(2026, 9, 1, 9).toISOString())];
    const calendar = render(sessions, 'calendar');
    expect(calendar.querySelector('app-history-calendar-view')).not.toBeNull();
    expect(calendar.querySelectorAll('app-month-calendar [data-trained]')).toHaveLength(1);
    TestBed.resetTestingModule();

    const stats = render(sessions, 'stats');
    expect(stats.querySelector('app-history-stats-view')).not.toBeNull();
    // One workout this month, shown in the first tile.
    expect(stats.querySelector('app-key-figures button span')?.textContent?.trim()).toBe('1');
  });

  it('shows the empty state without workouts', () => {
    const el = render([]);
    expect(el.textContent).toContain('Noch keine Trainings');
    expect(el.querySelectorAll('app-history-row')).toHaveLength(0);
  });
});
