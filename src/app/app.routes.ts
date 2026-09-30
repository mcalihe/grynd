import { isDevMode } from '@angular/core';
import { Routes } from '@angular/router';

const placeholder = () =>
  import('./shared/components/placeholder-page/placeholder-page').then((m) => m.PlaceholderPage);

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'plans' },
  { path: 'plans', loadComponent: placeholder, data: { titleKey: 'plans.title' } },
  { path: 'plans/new', loadComponent: placeholder, data: { titleKey: 'plans.new' } },
  { path: 'plans/:id', loadComponent: placeholder, data: { titleKey: 'plans.detail' } },
  { path: 'plans/:id/edit', loadComponent: placeholder, data: { titleKey: 'plans.edit' } },
  {
    path: 'plans/:id/add-exercises',
    loadComponent: placeholder,
    data: { titleKey: 'plans.addExercises' },
  },
  { path: 'workout', loadComponent: placeholder, data: { titleKey: 'workout.title' } },
  { path: 'history', loadComponent: placeholder, data: { titleKey: 'history.title' } },
  { path: 'history/:sessionId', loadComponent: placeholder, data: { titleKey: 'history.detail' } },
  {
    path: 'settings',
    loadComponent: placeholder,
    data: { titleKey: 'settings.title' },
  },
  ...(isDevMode()
    ? [
        {
          path: 'dev/components',
          loadComponent: () =>
            import('./features/dev/components-showcase').then((m) => m.ComponentsShowcase),
        },
      ]
    : []),
  { path: '**', redirectTo: 'plans' },
];
