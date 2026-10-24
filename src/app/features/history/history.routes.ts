import { Routes } from '@angular/router';

export const HISTORY_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./history-page').then((m) => m.HistoryPage) },
  {
    path: 'plans/:planId',
    loadComponent: () => import('./plan-history-page').then((m) => m.PlanHistoryPage),
  },
  {
    path: ':sessionId',
    loadComponent: () => import('./history-detail-page').then((m) => m.HistoryDetailPage),
  },
];
