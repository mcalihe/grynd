import { isDevMode } from '@angular/core';
import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'plans' },
  {
    path: 'plans',
    loadChildren: () => import('./features/plans/plans.routes').then((m) => m.PLANS_ROUTES),
  },
  {
    path: 'workout',
    loadChildren: () => import('./features/workout/workout.routes').then((m) => m.WORKOUT_ROUTES),
  },
  {
    path: 'history',
    loadChildren: () => import('./features/history/history.routes').then((m) => m.HISTORY_ROUTES),
  },
  {
    path: 'settings',
    loadComponent: () => import('./features/settings/settings-page').then((m) => m.SettingsPage),
  },
  ...(isDevMode()
    ? [
        {
          path: 'dev/components',
          loadComponent: () =>
            import('./features/dev/components-showcase').then((m) => m.ComponentsShowcase),
        },
        {
          path: 'dev/celebration',
          loadChildren: () =>
            import('./features/dev/celebration-demo.routes').then((m) => m.CELEBRATION_DEMO_ROUTES),
        },
      ]
    : []),
  { path: '**', redirectTo: 'plans' },
];
