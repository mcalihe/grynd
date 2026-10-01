import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { FakeClock } from '../../../testing/test-database';
import { HistorySummary } from '../../core/history/history-stats';
import { HistoryService } from '../../core/history/history.service';
import { Clock } from '../../core/utils/time';
import { HistoryPage } from './history-page';

describe('HistoryPage', () => {
  const summary = (id: string, startedAt: string): HistorySummary => ({
    id,
    planName: id,
    startedAt,
    finishedAt: new Date(Date.parse(startedAt) + 54 * 60_000).toISOString(),
    exerciseCount: 6,
    setCount: 18,
    volumeKg: 8420,
  });

  function render(summaries: HistorySummary[]) {
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
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(HistoryPage);
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
    expect(el.querySelectorAll('[data-trained]')).toHaveLength(2);
  });

  it('shows the empty state without workouts', () => {
    const el = render([]);
    expect(el.textContent).toContain('Noch keine Trainings');
    expect(el.querySelectorAll('app-history-row')).toHaveLength(0);
  });
});
