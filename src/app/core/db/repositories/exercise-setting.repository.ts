import { Injectable } from '@angular/core';
import { ExerciseSetting } from '../models';
import { BaseRepository } from './base.repository';

/** At most one live settings row per exercise (unique index on exerciseId for non-deleted rows). */
@Injectable({ providedIn: 'root' })
export class ExerciseSettingRepository extends BaseRepository<ExerciseSetting> {
  constructor() {
    super('exercise_setting', { columns: ['exerciseId', 'weightStepKg', 'weightStepLb'] });
  }

  async findByExercise(exerciseId: string): Promise<ExerciseSetting | undefined> {
    const [row] = await this.findWhere('exerciseId = ? AND deletedAt IS NULL', [exerciseId]);
    return row;
  }
}
