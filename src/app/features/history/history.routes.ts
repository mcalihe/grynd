import { Routes } from '@angular/router';

export const HISTORY_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./history-page').then((m) => m.HistoryPage) },
  {
    path: ':sessionId',
    loadComponent: () => import('./history-detail-page').then((m) => m.HistoryDetailPage),
  },
];
