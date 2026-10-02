import { inject } from '@angular/core';
import { Router, Routes } from '@angular/router';
import { WorkoutService } from '../../core/workout/workout.service';

/** /workout only exists while a session is active; otherwise back to the plans. */
export const activeWorkoutGuard = () =>
  inject(WorkoutService).isActive() || inject(Router).createUrlTree(['/plans']);

export const WORKOUT_ROUTES: Routes = [
  {
    path: '',
    canActivate: [activeWorkoutGuard],
    loadComponent: () => import('./workout-page').then((m) => m.WorkoutPage),
  },
  {
    // Celebration after finishing; the session is no longer active here (decision 0015).
    path: 'done/:sessionId',
    loadComponent: () => import('./workout-complete-page').then((m) => m.WorkoutCompletePage),
  },
];
