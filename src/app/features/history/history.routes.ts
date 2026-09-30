import { Routes } from '@angular/router';

export const HISTORY_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./history-page').then((m) => m.HistoryPage) },
  {
    path: ':sessionId',
    loadComponent: () =>
      import('../../shared/components/placeholder-page/placeholder-page').then(
        (m) => m.PlaceholderPage,
      ),
    data: { titleKey: 'history.detail' },
  },
];
