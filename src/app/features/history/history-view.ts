import { computed, Injectable, signal } from '@angular/core';

export type HistoryView = 'list' | 'calendar' | 'stats';
export const HISTORY_VIEWS: readonly HistoryView[] = ['list', 'calendar', 'stats'];

/** The history tab last shown, so «back» from a workout returns to it (decision 0016). */
@Injectable({ providedIn: 'root' })
export class HistoryViewState {
  readonly view = signal<HistoryView>('list');
  /** Query parameters of `/history` for the remembered tab; the list needs none. */
  readonly queryParams = computed(() => ({ view: this.view() === 'list' ? null : this.view() }));
}
