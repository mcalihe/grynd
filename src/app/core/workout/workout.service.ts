import { computed, inject, Injectable, signal } from '@angular/core';
import { DatabaseService } from '../db/database.service';
import { Exercise, SessionExercise, SetLog, WorkoutPause, WorkoutSession } from '../db/models';
import { ExerciseRepository } from '../db/repositories/exercise.repository';
import {
  ExerciseIntervalRepository,
  SessionExerciseRepository,
  SetLogRepository,
  WorkoutPauseRepository,
  WorkoutSessionRepository,
} from '../db/repositories/workout.repository';
import { isCardio } from '../energy/activities';
import { PlansService } from '../plans/plans.service';
import { SettingsService } from '../settings/settings.service';
import { Clock, UtcTimestamp } from '../utils/time';
import { closeStaleInterval, keepInterval } from './intervals';
import { activeDurationMs } from './pauses';
import { planExerciseFor } from './plan-link';
import { CardioValues, prefillCardio, prefillSets, SetValues } from './prefill';
import { recordSetIds } from './records';

/** Cardio columns of a strength set (decision 0025). */
const NO_CARDIO = {
  durationSec: null,
  distanceM: null,
  level: null,
  kcal: null,
  heartRate: null,
} as const;

/** Every value a set or cardio entry carries (decision 0025). */
export type EntryValues = SetValues &
  CardioValues & {
    kcal: number | null;
    heartRate: number | null;
  };

export interface WorkoutExercise {
  entry: SessionExercise;
  sets: SetLog[];
  /** Logged by duration instead of kg × reps (decision 0025). */
  cardio: boolean;
}

export interface ActiveWorkout {
  session: WorkoutSession;
  planName: string;
  /** The activity of a cardio workout without a plan (decision 0025); null otherwise. */
  activity: Exercise | null;
  exercises: WorkoutExercise[];
  /** Oldest first; the last one is open while the workout is paused. */
  pauses: WorkoutPause[];
}

/** An exercise is done when all planned (non-extra) sets are completed. */
export function isExerciseDone(sets: readonly SetLog[]): boolean {
  const planned = sets.filter((s) => !s.isExtra);
  return planned.length > 0 && planned.every((s) => s.completedAt !== null);
}

/**
 * Completed share of all sets in the workout (extra sets included, like the progress segments)
 * as a whole percent. Rounded down, so 100 only shows once every set is checked.
 */
export function workoutPercent(exercises: readonly { sets: readonly SetLog[] }[]): number {
  const sets = exercises.flatMap((e) => e.sets);
  const done = sets.filter((s) => s.completedAt !== null).length;
  return sets.length === 0 ? 0 : Math.floor((done / sets.length) * 100);
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
  private readonly settings = inject(SettingsService);
  private readonly exercises = inject(ExerciseRepository);
  private readonly sessions = inject(WorkoutSessionRepository);
  private readonly sessionExercises = inject(SessionExerciseRepository);
  private readonly sets = inject(SetLogRepository);
  private readonly intervals = inject(ExerciseIntervalRepository);
  private readonly pauses = inject(WorkoutPauseRepository);
  private readonly clock = inject(Clock);

  private readonly state = signal<ActiveWorkout | null>(null);
  private readonly historyBest = signal<ReadonlyMap<string, number | null>>(new Map());
  private openInterval?: { id: string; index: number };

  readonly workout = this.state.asReadonly();
  readonly current = signal(0);
  readonly isActive = computed(() => this.state() !== null);
  /** A cardio workout started without a plan: one activity, timed by the clock (decision 0025). */
  readonly standalone = computed(() => this.state()?.activity != null);
  /** The clock stands still and no exercise time is tracked (decision 0023). */
  readonly paused = computed(
    () => this.state()?.pauses.some((pause) => pause.resumedAt === null) ?? false,
  );

  /** Completed sets that set a new estimated 1RM for their exercise. */
  readonly records = computed(() => {
    const result = new Set<string>();
    for (const { entry, sets, cardio } of this.state()?.exercises ?? []) {
      if (cardio) {
        continue; // no cardio records yet (decision 0025)
      }
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

  /**
   * Copies the plan into a new active session with prefilled sets; cardio exercises get entries
   * with their target duration instead (decision 0025). The session keeps today's body weight.
   */
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
        bodyWeightKg: this.settings.settings().bodyWeightKg,
      });
      for (const [position, pe] of plan.exercises.entries()) {
        const cardio = isCardio(
          await this.exercises.findById(pe.exerciseId, { includeDeleted: true }),
        );
        const entry = await this.sessionExercises.insert({
          sessionId: created.id,
          exerciseId: pe.exerciseId,
          position,
          status: 'open',
          repMin: cardio ? null : pe.repMin,
          repMax: cardio ? null : pe.repMax,
          restSeconds: pe.restSeconds,
          targetDurationSec: cardio ? pe.targetDurationSec : null,
        });
        const previous = await this.previousSets(pe.exerciseId);
        const values: EntryValues[] = cardio
          ? prefillCardio(pe.targetSets, pe.targetDurationSec, previous).map((v) => ({
              weightKg: null,
              reps: null,
              ...v,
              kcal: null,
              heartRate: null,
            }))
          : prefillSets(pe.targetSets, pe.repMin, previous).map((v) => ({ ...NO_CARDIO, ...v }));
        for (const [index, value] of values.entries()) {
          await this.sets.insert({
            sessionExerciseId: entry.id,
            position: index,
            ...value,
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

  /**
   * Starts a cardio workout without a plan (decision 0025): one activity with one open entry
   * (distance and level from last time). Finishing logs the active time as its duration.
   */
  async startCardio(exerciseId: string): Promise<string> {
    if (await this.sessions.findActive()) {
      throw new Error('A workout is already active.');
    }
    const exercise = await this.exercises.findById(exerciseId);
    if (!exercise || !isCardio(exercise)) {
      throw new Error(`${exerciseId} is no cardio activity`);
    }
    const [values] = prefillCardio(1, null, await this.previousSets(exerciseId));
    const session = await this.database.driver.transaction(async () => {
      const created = await this.sessions.insert({
        planId: null,
        startedAt: this.clock.nowUtc(),
        finishedAt: null,
        status: 'active',
        bodyWeightKg: this.settings.settings().bodyWeightKg,
      });
      const entry = await this.sessionExercises.insert({
        sessionId: created.id,
        exerciseId,
        position: 0,
        status: 'open',
        repMin: null,
        repMax: null,
        restSeconds: null,
        targetDurationSec: null,
      });
      await this.sets.insert({
        sessionExerciseId: entry.id,
        position: 0,
        weightKg: null,
        reps: null,
        ...values,
        durationSec: null,
        kcal: null,
        heartRate: null,
        completedAt: null,
        isExtra: false,
      });
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

  /** Training time so far without the pauses, so it stands still while paused. */
  elapsedMs(now: UtcTimestamp): number {
    const workout = this.state();
    return workout ? activeDurationMs(workout.session.startedAt, now, workout.pauses) : 0;
  }

  /** Stops the clock until `resume()`: the current exercise's interval ends (decision 0023). */
  async pause(): Promise<void> {
    const workout = this.state();
    if (!workout || this.paused()) {
      return;
    }
    await this.closeInterval();
    const pause = await this.pauses.insert({
      sessionId: workout.session.id,
      pausedAt: this.clock.nowUtc(),
      resumedAt: null,
    });
    this.setPauses((pauses) => [...pauses, pause]);
  }

  /** Ends the pause; the visible exercise starts a new interval. */
  async resume(): Promise<void> {
    const open = this.state()?.pauses.find((pause) => pause.resumedAt === null);
    if (!open) {
      return;
    }
    const resumed = await this.pauses.update(open.id, { resumedAt: this.clock.nowUtc() });
    this.setPauses((pauses) => pauses.map((pause) => (pause.id === open.id ? resumed : pause)));
    await this.setCurrent(this.current());
  }

  // ---------------------------------------------------------------- navigation

  /** Makes exercise `index` the visible one and tracks its time (plan.md §7 «Zeiterfassung»). */
  async setCurrent(index: number): Promise<void> {
    const workout = this.state();
    if (!workout || index < 0 || index >= workout.exercises.length) {
      return;
    }
    this.current.set(index);
    if (this.paused() || this.openInterval?.index === index) {
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

  async updateSet(setId: string, patch: Partial<EntryValues>): Promise<void> {
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

  /**
   * «+ Satz» / «+ Eintrag»: copies the last set's values (extra unless it replaces a deleted
   * planned set). Cardio entries copy duration, distance and level, not calories or heart rate.
   */
  async addSet(exerciseIndex: number): Promise<void> {
    const exercise = this.state()?.exercises[exerciseIndex];
    if (!exercise) {
      return;
    }
    const last = exercise.sets.at(-1);
    const values: EntryValues = exercise.cardio
      ? {
          ...NO_CARDIO,
          weightKg: null,
          reps: null,
          durationSec: last?.durationSec ?? exercise.entry.targetDurationSec,
          distanceM: last?.distanceM ?? null,
          level: last?.level ?? null,
        }
      : {
          ...NO_CARDIO,
          weightKg: last?.weightKg ?? null,
          reps: last?.reps ?? exercise.entry.repMin,
        };
    await this.database.driver.transaction(() =>
      this.insertSet(exercise.entry.id, exercise.sets.length, values),
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
        durationSec: set.durationSec,
        distanceM: set.distanceM,
        level: set.level,
        // Calories and heart rate are measured per entry, never copied.
        kcal: null,
        heartRate: null,
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

  /**
   * Rest duration for this exercise, in this session and in the plan it came from: the one
   * exception to «a session never changes its plan» (decision 0026). Without a plan, or when the
   * exercise is no longer in it, only the session changes.
   */
  async setRestSeconds(exerciseIndex: number, restSeconds: number): Promise<void> {
    const state = this.state();
    const exercise = state?.exercises[exerciseIndex];
    if (!state || !exercise) {
      return;
    }
    const planId = state.session.planId;
    const plan = planId ? await this.plans.getDraft(planId) : undefined;
    const planExercise = plan
      ? planExerciseFor(
          state.exercises.map((e) => e.entry),
          exercise.entry.id,
          plan.exercises,
        )
      : null;
    const entry = await this.database.driver.transaction(async () => {
      if (planExercise?.planExerciseId) {
        await this.plans.setRestSeconds(planExercise.planExerciseId, restSeconds);
      }
      return this.sessionExercises.update(exercise.entry.id, { restSeconds });
    });
    this.patchExercise(exerciseIndex, { entry });
  }

  // ---------------------------------------------------------------- internals

  private async load(session: WorkoutSession): Promise<void> {
    const entries = await this.sessionExercises.findBySession(session.id);
    const catalog = new Map<string, Exercise | undefined>();
    for (const { exerciseId } of entries) {
      catalog.set(exerciseId, await this.exercises.findById(exerciseId, { includeDeleted: true }));
    }
    const exercises = await Promise.all(
      entries.map(async (entry) => ({
        entry,
        sets: await this.sets.findBySessionExercise(entry.id),
        cardio: isCardio(catalog.get(entry.exerciseId)),
      })),
    );
    const planName = session.planId
      ? ((await this.plans.getDraft(session.planId))?.name ?? '')
      : '';
    // A cardio workout without a plan is named after its activity (decision 0025).
    const first = catalog.get(entries[0]?.exerciseId ?? '');
    const activity = !session.planId && isCardio(first) ? (first ?? null) : null;
    const pauses = await this.pauses.findBySession(session.id);
    const best = new Map<string, number | null>();
    for (const { entry, cardio } of exercises) {
      if (!cardio) {
        best.set(
          entry.exerciseId,
          await this.sets.bestOneRepMaxBefore(entry.exerciseId, session.startedAt),
        );
      }
    }
    this.historyBest.set(best);
    this.state.set({ session, planName, activity, exercises, pauses });
  }

  private async end(status: 'finished' | 'aborted'): Promise<string> {
    const workout = this.state();
    if (!workout) {
      throw new Error('No active workout.');
    }
    await this.closeInterval();
    // Ending while paused: the pause ends with the workout, so it never counts.
    const now = this.clock.nowUtc();
    const open = workout.pauses.find((pause) => pause.resumedAt === null);
    // Without a plan the clock is the stopwatch: its active time becomes the entry (decision 0025).
    const timed = this.standalone() ? workout.exercises[0]?.sets[0] : undefined;
    const activeSec = Math.round(this.elapsedMs(now) / 1000);
    await this.database.driver.transaction(async () => {
      if (open) {
        await this.pauses.update(open.id, { resumedAt: now });
      }
      if (timed && status === 'finished') {
        await this.sets.update(timed.id, { durationSec: activeSec, completedAt: now });
        await this.sessionExercises.update(timed.sessionExerciseId, { status: 'done' });
      }
      await this.sessions.update(workout.session.id, { status, finishedAt: now });
    });
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
    values: EntryValues,
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
      ...NO_CARDIO,
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

  private setPauses(change: (pauses: WorkoutPause[]) => WorkoutPause[]): void {
    const workout = this.state();
    if (workout) {
      this.state.set({ ...workout, pauses: change(workout.pauses) });
    }
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
  private previousSets(exerciseId: string): Promise<(SetValues & CardioValues)[]> {
    return this.database.driver.query<SetValues & CardioValues>(
      `SELECT sl.weightKg, sl.reps, sl.durationSec, sl.distanceM, sl.level
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
