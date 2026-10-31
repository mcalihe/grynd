import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { ConfirmService } from '../services/confirm.service';
import { WorkoutService } from './workout.service';

/**
 * Starts a workout from the plan detail or «Ausdauer starten» (decision 0025). Only one workout
 * runs at a time: while one is active, it offers to continue that one instead (plan.md §8).
 */
@Injectable({ providedIn: 'root' })
export class WorkoutLauncher {
  private readonly workout = inject(WorkoutService);
  private readonly confirm = inject(ConfirmService);
  private readonly router = inject(Router);

  async launch(start: () => Promise<unknown>): Promise<void> {
    if (this.workout.isActive()) {
      const resume = await this.confirm.confirm({
        title: 'workout.resume.title',
        message: 'workout.resume.text',
        confirm: 'workout.resume.confirm',
        cancel: 'common.cancel',
      });
      if (resume) {
        await this.router.navigate(['/workout']);
      }
      return;
    }
    await start();
    await this.router.navigate(['/workout']);
  }
}
