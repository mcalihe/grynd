import { inject, Injectable, signal } from '@angular/core';
import { DatabaseService } from '../db/database.service';
import {
  ExerciseIntervalRepository,
  SessionExerciseRepository,
  SetLogRepository,
  WorkoutSessionRepository,
} from '../db/repositories/workout.repository';
import { durationMs } from '../utils/time';
import { recordSetIds } from '../workout/records';
import { HistorySetFact } from './history-insights';
import { HistorySummary } from './history-stats';

export interface HistorySet {
  id: string;
  weightKg: number | null;
  reps: number | null;
  isExtra: boolean;
  record: boolean;
}

export interface HistoryExercise {
  exerciseId: string;
  /** Sum of the exercise's time intervals. */
  timeMs: number;
  /** Completed sets only, in position order. */
  sets: HistorySet[];
}

export interface HistoryDetail {
  summary: HistorySummary;
  exercises: HistoryExercise[];
}

/**
 * Finished workouts (plan.md §8 «Verlauf»). Aborted and deleted sessions never show up; only
 * completed sets count. Records are measured against sessions started earlier.
 */
@Injectable({ providedIn: 'root' })
export class HistoryService {
  private readonly database = inject(DatabaseService);
  private readonly sessions = inject(WorkoutSessionRepository);
  private readonly sessionExercises = inject(SessionExerciseRepository);
  private readonly sets = inject(SetLogRepository);
  private readonly intervals = inject(ExerciseIntervalRepository);

  private readonly state = signal<HistorySummary[]>([]);
  readonly summaries = this.state.asReadonly();
  readonly loaded = signal(false);

  private readonly factState = signal<HistorySetFact[]>([]);
  /** Every completed set of the history; loaded on demand by the statistics. */
  readonly facts = this.factState.asReadonly();
  readonly factsLoaded = signal(false);

  async load(): Promise<void> {
    this.state.set(await this.querySummaries());
    this.loaded.set(true);
  }

  async loadFacts(): Promise<void> {
    this.factState.set(
      await this.database.driver.query<HistorySetFact>(
        `SELECT sl.id, se.sessionId, se.exerciseId, ws.startedAt, sl.completedAt,
                sl.weightKg, sl.reps
           FROM set_log sl
           JOIN session_exercise se ON se.id = sl.sessionExerciseId AND se.deletedAt IS NULL
           JOIN workout_session ws ON ws.id = se.sessionId AND ws.deletedAt IS NULL
          WHERE ws.status = 'finished' AND ws.finishedAt IS NOT NULL
            AND sl.completedAt IS NOT NULL AND sl.deletedAt IS NULL
          ORDER BY ws.startedAt, sl.completedAt`,
      ),
    );
    this.factsLoaded.set(true);
  }

  async detail(id: string): Promise<HistoryDetail | undefined> {
    const [summary] = await this.querySummaries(id);
    if (!summary) {
      return undefined;
    }
    const exercises: HistoryExercise[] = [];
    for (const entry of await this.sessionExercises.findBySession(id)) {
      const completed = (await this.sets.findBySessionExercise(entry.id)).filter(
        (s) => s.completedAt !== null,
      );
      if (completed.length === 0) {
        continue;
      }
      const inOrder = [...completed].sort((a, b) =>
        (a.completedAt ?? '').localeCompare(b.completedAt ?? ''),
      );
      const baseline = await this.sets.bestOneRepMaxBefore(entry.exerciseId, summary.startedAt);
      const records = recordSetIds(inOrder, baseline);
      const intervals = await this.intervals.findBySessionExercise(entry.id);
      exercises.push({
        exerciseId: entry.exerciseId,
        timeMs: intervals.reduce(
          (sum, i) => sum + (i.leftAt ? Math.max(0, durationMs(i.enteredAt, i.leftAt)) : 0),
          0,
        ),
        sets: completed.map((s) => ({
          id: s.id,
          weightKg: s.weightKg,
          reps: s.reps,
          isExtra: s.isExtra,
          record: records.has(s.id),
        })),
      });
    }
    return { summary, exercises };
  }

  /** Soft delete: the workout disappears from the history, prefill and records. */
  async delete(id: string): Promise<void> {
    await this.sessions.softDelete(id);
    this.state.update((list) => list.filter((s) => s.id !== id));
    this.factState.update((list) => list.filter((f) => f.sessionId !== id));
  }

  private querySummaries(id?: string): Promise<HistorySummary[]> {
    return this.database.driver.query<HistorySummary>(
      `SELECT ws.id, ws.planId, ws.startedAt, ws.finishedAt, coalesce(p.name, '') AS planName,
              count(DISTINCT CASE WHEN sl.id IS NOT NULL THEN se.id END) AS exerciseCount,
              count(sl.id) AS setCount,
              coalesce(sum(coalesce(sl.weightKg, 0) * coalesce(sl.reps, 0)), 0) AS volumeKg
         FROM workout_session ws
         LEFT JOIN plan p ON p.id = ws.planId
         LEFT JOIN session_exercise se ON se.sessionId = ws.id AND se.deletedAt IS NULL
         LEFT JOIN set_log sl ON sl.sessionExerciseId = se.id AND sl.deletedAt IS NULL
                             AND sl.completedAt IS NOT NULL
        WHERE ws.status = 'finished' AND ws.deletedAt IS NULL AND ws.finishedAt IS NOT NULL
          ${id ? 'AND ws.id = ?' : ''}
        GROUP BY ws.id
        ORDER BY ws.startedAt DESC`,
      id ? [id] : [],
    );
  }
}
