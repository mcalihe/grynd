import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { HistoryService } from '../../core/history/history.service';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { SegmentedControl } from '../../shared/components/segmented-control/segmented-control';
import { HistoryCalendarView } from './history-calendar-view';
import { HistoryFormat } from './history-format';
import { HistoryListView } from './history-list-view';
import { HistoryStatsView } from './history-stats-view';

export type HistoryView = 'list' | 'calendar' | 'stats';
const VIEWS: readonly HistoryView[] = ['list', 'calendar', 'stats'];

/**
 * Verlauf with three views (Figma Verlauf · Liste/Kalender/Statistik, decision 0016). The list is
 * the default; the chosen view lives in the query parameter `view`, so going back returns to it.
 */
@Component({
  selector: 'app-history-page',
  imports: [
    PageHeader,
    SegmentedControl,
    HistoryListView,
    HistoryCalendarView,
    HistoryStatsView,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-1 flex-col' },
  template: `
    <app-page-header [title]="'history.title' | transloco" />

    <app-segmented-control
      class="mx-4 mb-4"
      [attr.aria-label]="'history.views.label' | transloco"
      [options]="options()"
      [value]="current()"
      (valueChange)="select($event)"
    />

    @if (history.loaded()) {
      <div class="flex flex-1 flex-col px-4 pb-4">
        @switch (current()) {
          @case ('calendar') {
            <app-history-calendar-view />
          }
          @case ('stats') {
            <app-history-stats-view />
          }
          @default {
            <app-history-list-view />
          }
        }
      </div>
    }
  `,
})
export class HistoryPage implements OnInit {
  /** Query parameter `view`. */
  readonly view = input<string>();

  protected readonly history = inject(HistoryService);
  private readonly format = inject(HistoryFormat);
  private readonly router = inject(Router);

  protected readonly current = computed<HistoryView>(() =>
    VIEWS.includes(this.view() as HistoryView) ? (this.view() as HistoryView) : 'list',
  );
  protected readonly options = computed(() =>
    VIEWS.map((value) => ({ value, label: this.format.t(`history.views.${value}`) })),
  );

  ngOnInit(): void {
    void this.history.load();
  }

  protected select(view: HistoryView): void {
    void this.router.navigate([], {
      queryParams: { view: view === 'list' ? null : view },
      replaceUrl: true,
    });
  }
}
