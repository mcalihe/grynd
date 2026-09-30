import { Routes } from '@angular/router';
import { PlanEditorStore } from './plan-editor.store';
import { unsavedChangesGuard } from './unsaved-changes.guard';

/** Editor children share one PlanEditorStore (the draft survives «Übungen hinzufügen»). */
const editorChildren: Routes = [
  { path: '', loadComponent: () => import('./plan-editor-page').then((m) => m.PlanEditorPage) },
  {
    path: 'add-exercises',
    loadComponent: () => import('./exercise-picker-page').then((m) => m.ExercisePickerPage),
  },
];

/** Mounted under /plans (see app.routes.ts). */
export const PLANS_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./plans-page').then((m) => m.PlansPage) },
  {
    path: 'new',
    providers: [PlanEditorStore],
    canDeactivate: [unsavedChangesGuard],
    children: editorChildren,
  },
  { path: ':id', loadComponent: () => import('./plan-detail-page').then((m) => m.PlanDetailPage) },
  {
    path: ':id/edit',
    providers: [PlanEditorStore],
    canDeactivate: [unsavedChangesGuard],
    children: editorChildren,
  },
];
