import { Injectable } from '@angular/core';
import { Plan, PlanExercise } from '../models';
import { BaseRepository } from './base.repository';

@Injectable({ providedIn: 'root' })
export class PlanRepository extends BaseRepository<Plan> {
  constructor() {
    super('plan', { columns: ['name', 'weekdays'], json: ['weekdays'] });
  }
}

@Injectable({ providedIn: 'root' })
export class PlanExerciseRepository extends BaseRepository<PlanExercise> {
  constructor() {
    super('plan_exercise', {
      columns: [
        'planId',
        'exerciseId',
        'position',
        'targetSets',
        'repMin',
        'repMax',
        'restSeconds',
      ],
    });
  }

  findByPlan(planId: string): Promise<PlanExercise[]> {
    return this.findWhere('planId = ? AND deletedAt IS NULL', [planId], 'position');
  }
}
