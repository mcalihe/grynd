import { Routes } from '@angular/router';

const placeholder = () =>
  import('../../shared/components/placeholder-page/placeholder-page').then(
    (m) => m.PlaceholderPage,
  );

/** Mounted under /plans (see app.routes.ts). */
export const PLANS_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./plans-page').then((m) => m.PlansPage) },
  { path: 'new', loadComponent: placeholder, data: { titleKey: 'plans.new' } },
  { path: ':id', loadComponent: () => import('./plan-detail-page').then((m) => m.PlanDetailPage) },
  { path: ':id/edit', loadComponent: placeholder, data: { titleKey: 'plans.edit' } },
];
