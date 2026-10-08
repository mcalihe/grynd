import { Injectable } from '@angular/core';
import { ExerciseNote } from '../models';
import { BaseRepository } from './base.repository';

/** At most one live note per exercise (unique index on exerciseId for non-deleted rows). */
@Injectable({ providedIn: 'root' })
export class ExerciseNoteRepository extends BaseRepository<ExerciseNote> {
  constructor() {
    super('exercise_note', { columns: ['exerciseId', 'text'] });
  }

  async findByExercise(exerciseId: string): Promise<ExerciseNote | undefined> {
    const [row] = await this.findWhere('exerciseId = ? AND deletedAt IS NULL', [exerciseId]);
    return row;
  }
}
