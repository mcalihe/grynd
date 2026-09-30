import { Injectable } from '@angular/core';
import { ExerciseInterval, SessionExercise, SetLog, WorkoutSession } from '../models';
import { BaseRepository } from './base.repository';

@Injectable({ providedIn: 'root' })
export class WorkoutSessionRepository extends BaseRepository<WorkoutSession> {
  constructor() {
    super('workout_session', { columns: ['planId', 'startedAt', 'finishedAt', 'status'] });
  }

  async findActive(): Promise<WorkoutSession | undefined> {
    const [row] = await this.findWhere("status = 'active' AND deletedAt IS NULL");
    return row;
  }

  /** Finished sessions, newest first. */
  findFinished(): Promise<WorkoutSession[]> {
    return this.findWhere("status = 'finished' AND deletedAt IS NULL", [], 'startedAt DESC');
  }
}

@Injectable({ providedIn: 'root' })
export class SessionExerciseRepository extends BaseRepository<SessionExercise> {
  constructor() {
    super('session_exercise', {
      columns: ['sessionId', 'exerciseId', 'position', 'status', 'repMin', 'repMax', 'restSeconds'],
    });
  }

  findBySession(sessionId: string): Promise<SessionExercise[]> {
    return this.findWhere('sessionId = ? AND deletedAt IS NULL', [sessionId], 'position');
  }

  /** Exercise ids used most recently across all sessions (for "Recently used"). */
  async findRecentExerciseIds(limit: number): Promise<string[]> {
    const rows = await this.db.query<{ exerciseId: string }>(
      `SELECT exerciseId FROM session_exercise WHERE deletedAt IS NULL
       GROUP BY exerciseId ORDER BY max(createdAt) DESC LIMIT ?`,
      [limit],
    );
    return rows.map((row) => row.exerciseId);
  }
}

@Injectable({ providedIn: 'root' })
export class ExerciseIntervalRepository extends BaseRepository<ExerciseInterval> {
  constructor() {
    super('exercise_interval', { columns: ['sessionExerciseId', 'enteredAt', 'leftAt'] });
  }

  findBySessionExercise(sessionExerciseId: string): Promise<ExerciseInterval[]> {
    return this.findWhere(
      'sessionExerciseId = ? AND deletedAt IS NULL',
      [sessionExerciseId],
      'enteredAt',
    );
  }

  /** Intervals left open, e.g. because the app was killed. */
  findOpen(): Promise<ExerciseInterval[]> {
    return this.findWhere('leftAt IS NULL AND deletedAt IS NULL', [], 'enteredAt');
  }
}

@Injectable({ providedIn: 'root' })
export class SetLogRepository extends BaseRepository<SetLog> {
  constructor() {
    super('set_log', {
      columns: ['sessionExerciseId', 'position', 'weightKg', 'reps', 'completedAt', 'isExtra'],
      boolean: ['isExtra'],
    });
  }

  findBySessionExercise(sessionExerciseId: string): Promise<SetLog[]> {
    return this.findWhere(
      'sessionExerciseId = ? AND deletedAt IS NULL',
      [sessionExerciseId],
      'position',
    );
  }
}
