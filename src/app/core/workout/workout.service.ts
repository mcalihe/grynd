import { computed, inject, Injectable, signal } from '@angular/core';
import { DatabaseService } from '../db/database.service';
import { SessionExercise, SetLog, WorkoutSession } from '../db/models';
import {
  ExerciseIntervalRepository,
  SessionExerciseRepository,
  SetLogRepository,
  WorkoutSessionRepository,
} from '../db/repositories/workout.repository';
import { PlansService } from '../plans/plans.service';
import { Clock } from '../utils/time';
import { closeStaleInterval, keepInterval } from './intervals';
import { prefillSets, SetValues } from './prefill';
import { recordSetIds } from './records';

export interface WorkoutExercise {
  entry: SessionExercise;
  sets: SetLog[];
}

export interface ActiveWorkout {
  session: WorkoutSession;
  planName: string;
  exercises: WorkoutExercise[];
}

/** An exercise is done when all planned (non-extra) sets are completed. */
export function isExerciseDone(sets: readonly SetLog[]): boolean {
  const planned = sets.filter((s) => !s.isExtra);
  return planned.length > 0 && planned.every((s) => s.completedAt !== null);
}

/** The change from `before` to `after` finished the exercise (celebrated once, decision 0015). */
export function exerciseJustDone(before: readonly SetLog[], after: readonly SetLog[]): boolean {
  return !isExerciseDone(before) && isExerciseDone(after);
}

/**
 * The running workout (plan.md §7): a copy of the plan made at start, logged set by set.
 * Changes here never touch the plan. At most one session is active.
 */
@Injectable({ providedIn: 'root' })
export class WorkoutService {
  private readonly database = inject(DatabaseService);
  private readonly plans = inject(PlansService);
  private readonly sessions = inject(WorkoutSessionRepository);
  private readonly sessionExercises = inject(SessionExerciseRepository);
  private readonly sets = inject(SetLogRepository);
  private readonly intervals = inject(ExerciseIntervalRepository);
  private readonly clock = inject(Clock);

  private readonly state = signal<ActiveWorkout | null>(null);
  private readonly historyBest = signal<ReadonlyMap<string, number | null>>(new Map());
  private openInterval?: { id: string; index: number };

  readonly workout = this.state.asReadonly();
  readonly current = signal(0);
  readonly isActive = computed(() => this.state() !== null);

  /** Completed sets that set a new estimated 1RM for their exercise. */
  readonly records = computed(() => {
    const result = new Set<string>();
    for (const { entry, sets } of this.state()?.exercises ?? []) {
      const completed = sets
        .filter((s) => s.completedAt !== null)
        .sort((a, b) => (a.completedAt ?? '').localeCompare(b.completedAt ?? ''));
      for (const id of recordSetIds(completed, this.historyBest().get(entry.exerciseId) ?? null)) {
        result.add(id);
      }
    }
    return result;
  });

  // ---------------------------------------------------------------- lifecycle

  /** Loads the active session after app start; returns whether one exists. */
  async restore(): Promise<boolean> {
    const session = await this.sessions.findActive();
    if (!session) {
      this.state.set(null);
      return false;
    }
    await this.load(session);
    await this.closeStaleIntervals();
    const firstOpen = this.state()!.exercises.findIndex((e) => !isExerciseDone(e.sets));
    this.current.set(firstOpen === -1 ? 0 : firstOpen);
    return true;
  }

  /** Copies the plan into a new active session with prefilled sets. */
  async start(planId: string): Promise<string> {
    if (await this.sessions.findActive()) {
      throw new Error('A workout is already active.');
    }
    const plan = await this.plans.getDraft(planId);
    if (!plan) {
      throw new Error(`Plan ${planId} not found`);
    }
    const now = this.clock.nowUtc();
    const session = await this.database.driver.transaction(async () => {
      const created = await this.sessions.insert({
        planId,
        startedAt: now,
        finishedAt: null,
        status: 'active',
      });
      for (const [position, pe] of plan.exercises.entries()) {
        const entry = await this.sessionExercises.insert({
          sessionId: created.id,
          exerciseId: pe.exerciseId,
          position,
          status: 'open',
          repMin: pe.repMin,
          repMax: pe.repMax,
          restSeconds: pe.restSeconds,
        });
        const previous = await this.previousSets(pe.exerciseId);
        for (const [index, values] of prefillSets(pe.targetSets, pe.repMin, previous).entries()) {
          await this.sets.insert({
            sessionExerciseId: entry.id,
            position: index,
            weightKg: values.weightKg,
            reps: values.reps,
            completedAt: null,
            isExtra: false,
          });
        }
      }
      return created;
    });
    await this.load(session);
    this.current.set(0);
    return session.id;
  }

  /** Saves the session: completed sets count in the history, open ones do not. */
  async finish(): Promise<string> {
    return this.end('finished');
  }

  /** Discards the session (status aborted, hidden from the history). */
  async abort(): Promise<string> {
    return this.end('aborted');
  }

  // ---------------------------------------------------------------- navigation

  /** Makes exercise `index` the visible one and tracks its time (plan.md §7 «Zeiterfassung»). */
  async setCurrent(index: number): Promise<void> {
    const workout = this.state();
    if (!workout || index < 0 || index >= workout.exercises.length) {
      return;
    }
    this.current.set(index);
    if (this.openInterval?.index === index) {
      return;
    }
    await this.closeInterval();
    const created = await this.intervals.insert({
      sessionExerciseId: workout.exercises[index].entry.id,
      enteredAt: this.clock.nowUtc(),
      leftAt: null,
    });
    this.openInterval = { id: created.id, index };
  }

  /** Reorders exercises (overview, «1 nach hinten», «Ans Ende»); the current one stays current. */
  async moveExercise(from: number, to: number): Promise<void> {
    const workout = this.state();
    if (!workout || from === to) {
      return;
    }
    const currentId = workout.exercises[this.current()]?.entry.id;
    const reordered = [...workout.exercises];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(Math.max(0, Math.min(to, reordered.length)), 0, moved);
    await this.database.driver.transaction(async () => {
      for (const [position, e] of reordered.entries()) {
        if (e.entry.position !== position) {
          await this.sessionExercises.update(e.entry.id, { position });
        }
      }
    });
    const exercises = reordered.map((e, position) => ({ ...e, entry: { ...e.entry, position } }));
    this.state.set({ ...workout, exercises });
    const newIndex = exercises.findIndex((e) => e.entry.id === currentId);
    this.current.set(newIndex);
    if (this.openInterval) {
      this.openInterval = { ...this.openInterval, index: newIndex };
    }
  }

  // ---------------------------------------------------------------- sets

  async updateSet(setId: string, patch: Partial<SetValues>): Promise<void> {
    const found = this.findSet(setId);
    if (!found) {
      return;
    }
    await this.sets.update(setId, patch);
    await this.reloadSets(found.index);
  }

  /** Checks or unchecks a set; returns true when it was just completed (starts the timer). */
  async toggleComplete(setId: string): Promise<boolean> {
    const found = this.findSet(setId);
    if (!found) {
      return false;
    }
    const completing = found.set.completedAt === null;
    await this.sets.update(setId, { completedAt: completing ? this.clock.nowUtc() : null });
    await this.reloadSets(found.index);
    return completing;
  }

  /** «+ Satz»: copies the last set's values (extra unless it replaces a deleted planned set). */
  async addSet(exerciseIndex: number): Promise<void> {
    const exercise = this.state()?.exercises[exerciseIndex];
    if (!exercise) {
      return;
    }
    const last = exercise.sets.at(-1);
    await this.database.driver.transaction(() =>
      this.insertSet(exercise.entry.id, exercise.sets.length, {
        weightKg: last?.weightKg ?? null,
        reps: last?.reps ?? exercise.entry.repMin,
      }),
    );
    await this.reloadSets(exerciseIndex);
  }

  /** Inserts an open copy right after the set (extra unless it replaces a deleted planned set). */
  async duplicateSet(setId: string): Promise<void> {
    const found = this.findSet(setId);
    if (!found) {
      return;
    }
    const { set, index } = found;
    const siblings = this.state()!.exercises[index].sets;
    await this.database.driver.transaction(async () => {
      for (const later of siblings.filter((s) => s.position > set.position)) {
        await this.sets.update(later.id, { position: later.position + 1 });
      }
      await this.insertSet(set.sessionExerciseId, set.position + 1, {
        weightKg: set.weightKg,
        reps: set.reps,
      });
    });
    await this.reloadSets(index);
  }

  /** Soft-deletes a set and closes the gap in the numbering. */
  async deleteSet(setId: string): Promise<void> {
    const found = this.findSet(setId);
    if (!found) {
      return;
    }
    const siblings = this.state()!.exercises[found.index].sets;
    await this.database.driver.transaction(async () => {
      await this.sets.softDelete(setId);
      const remaining = siblings.filter((s) => s.id !== setId);
      for (const [position, s] of remaining.entries()) {
        if (s.position !== position) {
          await this.sets.update(s.id, { position });
        }
      }
    });
    await this.reloadSets(found.index);
  }

  /** Rest duration for this exercise in this session only (the plan keeps its value). */
  async setRestSeconds(exerciseIndex: number, restSeconds: number): Promise<void> {
    const exercise = this.state()?.exercises[exerciseIndex];
    if (!exercise) {
      return;
    }
    const entry = await this.sessionExercises.update(exercise.entry.id, { restSeconds });
    this.patchExercise(exerciseIndex, { entry });
  }

  // ---------------------------------------------------------------- internals

  private async load(session: WorkoutSession): Promise<void> {
    const entries = await this.sessionExercises.findBySession(session.id);
    const exercises = await Promise.all(
      entries.map(async (entry) => ({
        entry,
        sets: await this.sets.findBySessionExercise(entry.id),
      })),
    );
    const planName = session.planId
      ? ((await this.plans.getDraft(session.planId))?.name ?? '')
      : '';
    const best = new Map<string, number | null>();
    for (const { entry } of exercises) {
      best.set(
        entry.exerciseId,
        await this.sets.bestOneRepMaxBefore(entry.exerciseId, session.startedAt),
      );
    }
    this.historyBest.set(best);
    this.state.set({ session, planName, exercises });
  }

  private async end(status: 'finished' | 'aborted'): Promise<string> {
    const workout = this.state();
    if (!workout) {
      throw new Error('No active workout.');
    }
    await this.closeInterval();
    await this.sessions.update(workout.session.id, { status, finishedAt: this.clock.nowUtc() });
    this.state.set(null);
    this.current.set(0);
    return workout.session.id;
  }

  private async closeInterval(): Promise<void> {
    const open = this.openInterval;
    this.openInterval = undefined;
    if (!open) {
      return;
    }
    const interval = await this.intervals.findById(open.id);
    if (!interval) {
      return;
    }
    const now = this.clock.nowUtc();
    if (keepInterval(interval.enteredAt, now)) {
      await this.intervals.update(open.id, { leftAt: now });
    } else {
      await this.intervals.softDelete(open.id);
    }
  }

  /** Intervals left open by a killed app end at the exercise's last completed set. */
  private async closeStaleIntervals(): Promise<void> {
    const workout = this.state();
    if (!workout) {
      return;
    }
    for (const { entry, sets } of workout.exercises) {
      for (const interval of await this.intervals.findBySessionExercise(entry.id)) {
        if (interval.leftAt !== null) {
          continue;
        }
        const lastCompleted =
          sets
            .map((s) => s.completedAt)
            .filter((c): c is string => c !== null && c > interval.enteredAt)
            .sort()
            .at(-1) ?? null;
        const leftAt = closeStaleInterval(interval.enteredAt, lastCompleted);
        if (leftAt) {
          await this.intervals.update(interval.id, { leftAt });
        } else {
          await this.intervals.softDelete(interval.id);
        }
      }
    }
  }

  /**
   * Adds an open set. A planned set deleted earlier in the session comes back instead of a new
   * extra one, so deleting and re-adding keeps the plan's set count.
   */
  private async insertSet(
    sessionExerciseId: string,
    position: number,
    values: SetValues,
  ): Promise<void> {
    const deleted = await this.sets.findDeletedPlanned(sessionExerciseId);
    if (deleted) {
      await this.sets.restore(deleted.id);
      await this.sets.update(deleted.id, { ...values, position, completedAt: null });
      return;
    }
    await this.sets.insert({
      sessionExerciseId,
      position,
      ...values,
      completedAt: null,
      isExtra: true,
    });
  }

  private findSet(setId: string): { set: SetLog; index: number } | undefined {
    const exercises = this.state()?.exercises ?? [];
    for (const [index, exercise] of exercises.entries()) {
      const set = exercise.sets.find((s) => s.id === setId);
      if (set) {
        return { set, index };
      }
    }
    return undefined;
  }

  private async reloadSets(index: number): Promise<void> {
    const exercise = this.state()?.exercises[index];
    if (!exercise) {
      return;
    }
    const sets = await this.sets.findBySessionExercise(exercise.entry.id);
    const status = isExerciseDone(sets) ? 'done' : 'open';
    const entry =
      status === exercise.entry.status
        ? exercise.entry
        : await this.sessionExercises.update(exercise.entry.id, { status });
    this.patchExercise(index, { entry, sets });
  }

  private patchExercise(index: number, patch: Partial<WorkoutExercise>): void {
    const workout = this.state();
    if (!workout) {
      return;
    }
    const exercises = workout.exercises.map((e, i) => (i === index ? { ...e, ...patch } : e));
    this.state.set({ ...workout, exercises });
  }

  /** Completed sets of the exercise in the most recent finished session that contains it. */
  private previousSets(exerciseId: string): Promise<SetValues[]> {
    return this.database.driver.query<SetValues>(
      `SELECT sl.weightKg, sl.reps
         FROM set_log sl
         JOIN session_exercise se ON se.id = sl.sessionExerciseId AND se.deletedAt IS NULL
        WHERE se.exerciseId = ?
          AND sl.completedAt IS NOT NULL AND sl.deletedAt IS NULL
          AND se.sessionId = (
            SELECT ws.id FROM workout_session ws
              JOIN session_exercise se2 ON se2.sessionId = ws.id AND se2.deletedAt IS NULL
             WHERE se2.exerciseId = ? AND ws.status = 'finished' AND ws.deletedAt IS NULL
             ORDER BY ws.startedAt DESC LIMIT 1)
        ORDER BY se.position, sl.position`,
      [exerciseId, exerciseId],
    );
  }
}
