import { Injectable } from '@angular/core';
import { ExerciseNoteImage } from '../models';
import { BaseRepository } from './base.repository';

/** Photos of exercise notes; the files themselves are in NoteImageStore. */
@Injectable({ providedIn: 'root' })
export class ExerciseNoteImageRepository extends BaseRepository<ExerciseNoteImage> {
  constructor() {
    super('exercise_note_image', { columns: ['exerciseId'] });
  }
}
