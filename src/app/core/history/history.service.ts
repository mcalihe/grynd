import { computed, inject, Injectable, signal } from '@angular/core';
import { DatabaseService } from '../db/database.service';
import { ExerciseRepository } from '../db/repositories/exercise.repository';
import {
  ExerciseIntervalRepository,
  SessionExerciseRepository,
  SetLogRepository,
  WorkoutSessionRepository,
} from '../db/repositories/workout.repository';
import { CARDIO_CATEGORY, isCardio } from '../energy/activities';
import { CardioEnergyEntry, sessionEnergy } from '../energy/energy';
import { SettingsService } from '../settings/settings.service';
import { durationMs } from '../utils/time';
import { recordSetIds } from '../workout/records';
import { HistorySetFact } from './history-insights';
import { HistorySummary, sessionDurationMs } from './history-stats';

export interface HistorySet {
  id: string;
  weightKg: number | null;
  reps: number | null;
  /** Cardio values (decision 0024); null for strength sets. */
  durationSec: number | null;
  distanceM: number | null;
  level: number | null;
  kcal: number | null;
  heartRate: number | null;
  isExtra: boolean;
  record: boolean;
}

export interface HistoryExercise {
  exerciseId: string;
  /** Catalog key, for the activity profile of cardio exercises. */
  exerciseKey: string;
  /** Logged by duration instead of kg × reps (decision 0024). */
  cardio: boolean;
  /** Sum of the exercise's time intervals. */
  timeMs: number;
  /** Completed sets only, in position order. */
  sets: HistorySet[];
}

/** A summary as stored, before the calories are worked out. */
type StoredSummary = Omit<HistorySummary, 'energy'>;

/** A completed cardio entry of a finished workout, for the calories. */
interface CardioFact extends CardioEnergyEntry {
  sessionId: string;
}

export interface HistoryDetail {
  summary: HistorySummary;
  exercises: HistoryExercise[];
}

/**
 * Finished workouts (plan.md §8 «Verlauf»). Aborted and deleted sessions never show up; only
 * completed sets count. Records are measured against sessions started earlier.
 * Calories (decision 0024) follow the body weight setting for workouts without their own.
 */
@Injectable({ providedIn: 'root' })
export class HistoryService {
  private readonly database = inject(DatabaseService);
  private readonly sessions = inject(WorkoutSessionRepository);
  private readonly sessionExercises = inject(SessionExerciseRepository);
  private readonly sets = inject(SetLogRepository);
  private readonly intervals = inject(ExerciseIntervalRepository);
  private readonly exercises = inject(ExerciseRepository);
  private readonly settings = inject(SettingsService);

  private readonly state = signal<StoredSummary[]>([]);
  private readonly cardioState = signal<CardioFact[]>([]);
  /** Finished workouts, newest first, with their calories. */
  readonly summaries = computed(() => {
    const cardio = groupBySession(this.cardioState());
    return this.state().map((s) => this.withEnergy(s, cardio.get(s.id) ?? []));
  });
  readonly loaded = signal(false);

  private readonly factState = signal<HistorySetFact[]>([]);
  /** Every completed strength set of the history; loaded on demand by the statistics. */
  readonly facts = this.factState.asReadonly();
  readonly factsLoaded = signal(false);

  async load(): Promise<void> {
    const [summaries, cardio] = await Promise.all([this.querySummaries(), this.queryCardio()]);
    this.cardioState.set(cardio);
    this.state.set(summaries);
    this.loaded.set(true);
  }

  /** Strength sets only: cardio counts for no muscle group, strength or volume (decision 0024). */
  async loadFacts(): Promise<void> {
    this.factState.set(
      await this.database.driver.query<HistorySetFact>(
        `SELECT sl.id, se.sessionId, se.exerciseId, ws.startedAt, sl.completedAt,
                sl.weightKg, sl.reps
           FROM set_log sl
           JOIN session_exercise se ON se.id = sl.sessionExerciseId AND se.deletedAt IS NULL
           JOIN workout_session ws ON ws.id = se.sessionId AND ws.deletedAt IS NULL
           JOIN exercise e ON e.id = se.exerciseId
          WHERE ws.status = 'finished' AND ws.finishedAt IS NOT NULL
            AND sl.completedAt IS NOT NULL AND sl.deletedAt IS NULL
            AND coalesce(e.category, '') <> ?
          ORDER BY ws.startedAt, sl.completedAt`,
        [CARDIO_CATEGORY],
      ),
    );
    this.factsLoaded.set(true);
  }

  async detail(id: string): Promise<HistoryDetail | undefined> {
    const [[stored], cardio] = await Promise.all([this.querySummaries(id), this.queryCardio(id)]);
    if (!stored) {
      return undefined;
    }
    const summary = this.withEnergy(stored, cardio);
    const exercises: HistoryExercise[] = [];
    for (const entry of await this.sessionExercises.findBySession(id)) {
      const completed = (await this.sets.findBySessionExercise(entry.id)).filter(
        (s) => s.completedAt !== null,
      );
      if (completed.length === 0) {
        continue;
      }
      const exercise = await this.exercises.findById(entry.exerciseId, { includeDeleted: true });
      const cardioExercise = isCardio(exercise);
      const inOrder = [...completed].sort((a, b) =>
        (a.completedAt ?? '').localeCompare(b.completedAt ?? ''),
      );
      const records = cardioExercise
        ? new Set<string>()
        : recordSetIds(
            inOrder,
            await this.sets.bestOneRepMaxBefore(entry.exerciseId, summary.startedAt),
          );
      const intervals = await this.intervals.findBySessionExercise(entry.id);
      exercises.push({
        exerciseId: entry.exerciseId,
        exerciseKey: exercise?.key ?? '',
        cardio: cardioExercise,
        timeMs: intervals.reduce(
          (sum, i) => sum + (i.leftAt ? Math.max(0, durationMs(i.enteredAt, i.leftAt)) : 0),
          0,
        ),
        sets: completed.map((s) => ({
          id: s.id,
          weightKg: s.weightKg,
          reps: s.reps,
          durationSec: s.durationSec,
          distanceM: s.distanceM,
          level: s.level,
          kcal: s.kcal,
          heartRate: s.heartRate,
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
    this.cardioState.update((list) => list.filter((f) => f.sessionId !== id));
    this.factState.update((list) => list.filter((f) => f.sessionId !== id));
  }

  /** Calories with the workout's body weight, else today's setting (decision 0024). */
  private withEnergy(summary: StoredSummary, cardio: readonly CardioFact[]): HistorySummary {
    const bodyWeightKg = summary.bodyWeightKg ?? this.settings.settings().bodyWeightKg;
    return {
      ...summary,
      bodyWeightKg,
      energy: sessionEnergy({
        activeMs: sessionDurationMs(summary),
        strengthSets: summary.setCount,
        cardio,
        bodyWeightKg,
      }),
    };
  }

  /**
   * Sets and volume count strength only; cardio entries add their count and distance. A workout
   * without a plan is named after its first (only) exercise, the activity.
   */
  private querySummaries(id?: string): Promise<StoredSummary[]> {
    return this.database.driver.query<StoredSummary>(
      `SELECT ws.id, ws.planId, ws.startedAt, ws.finishedAt, coalesce(p.name, '') AS planName,
              ws.bodyWeightKg,
              CASE WHEN ws.planId IS NULL THEN (
                SELECT se1.exerciseId FROM session_exercise se1
                 WHERE se1.sessionId = ws.id AND se1.deletedAt IS NULL
                 ORDER BY se1.position LIMIT 1) END AS activityId,
              coalesce((
                SELECT round(sum(max(0, julianday(coalesce(wp.resumedAt, ws.finishedAt))
                                      - julianday(wp.pausedAt))) * 86400000)
                  FROM workout_pause wp
                 WHERE wp.sessionId = ws.id AND wp.deletedAt IS NULL), 0) AS pausedMs,
              count(DISTINCT CASE WHEN sl.id IS NOT NULL THEN se.id END) AS exerciseCount,
              count(CASE WHEN e.category IS NOT ? THEN sl.id END) AS setCount,
              coalesce(sum(CASE WHEN e.category IS NOT ?
                                THEN coalesce(sl.weightKg, 0) * coalesce(sl.reps, 0) END), 0)
                AS volumeKg,
              count(CASE WHEN e.category IS ? THEN sl.id END) AS cardioCount,
              coalesce(sum(CASE WHEN e.category IS ? THEN sl.distanceM END), 0) AS distanceM
         FROM workout_session ws
         LEFT JOIN plan p ON p.id = ws.planId
         LEFT JOIN session_exercise se ON se.sessionId = ws.id AND se.deletedAt IS NULL
         LEFT JOIN exercise e ON e.id = se.exerciseId
         LEFT JOIN set_log sl ON sl.sessionExerciseId = se.id AND sl.deletedAt IS NULL
                             AND sl.completedAt IS NOT NULL
        WHERE ws.status = 'finished' AND ws.deletedAt IS NULL AND ws.finishedAt IS NOT NULL
          ${id ? 'AND ws.id = ?' : ''}
        GROUP BY ws.id
        ORDER BY ws.startedAt DESC`,
      [CARDIO_CATEGORY, CARDIO_CATEGORY, CARDIO_CATEGORY, CARDIO_CATEGORY, ...(id ? [id] : [])],
    );
  }

  /** Completed cardio entries of finished workouts (or of one), for the calories. */
  private queryCardio(id?: string): Promise<CardioFact[]> {
    return this.database.driver.query<CardioFact>(
      `SELECT se.sessionId, e.key AS exerciseKey, sl.durationSec, sl.distanceM, sl.kcal
         FROM set_log sl
         JOIN session_exercise se ON se.id = sl.sessionExerciseId AND se.deletedAt IS NULL
         JOIN workout_session ws ON ws.id = se.sessionId AND ws.deletedAt IS NULL
         JOIN exercise e ON e.id = se.exerciseId
        WHERE ws.status = 'finished' AND ws.finishedAt IS NOT NULL
          AND sl.completedAt IS NOT NULL AND sl.deletedAt IS NULL AND e.category = ?
          ${id ? 'AND ws.id = ?' : ''}`,
      [CARDIO_CATEGORY, ...(id ? [id] : [])],
    );
  }
}

function groupBySession(facts: readonly CardioFact[]): Map<string, CardioFact[]> {
  const groups = new Map<string, CardioFact[]>();
  for (const fact of facts) {
    groups.set(fact.sessionId, [...(groups.get(fact.sessionId) ?? []), fact]);
  }
  return groups;
}
