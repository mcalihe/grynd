import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { catalogEntry, seedCatalog } from '../../../testing/catalog';
import { SqlJsDriver } from '../../../testing/sqljs-driver';
import { provideMemorySettings } from '../../../testing/settings';
import { createTestDatabase, FakeClock } from '../../../testing/test-database';
import { SettingsService } from '../settings/settings.service';
import {
  ExerciseIntervalRepository,
  WorkoutPauseRepository,
  SessionExerciseRepository,
  SetLogRepository,
  WorkoutSessionRepository,
} from '../db/repositories/workout.repository';
import { addExercises, updateExercise } from '../plans/plan-draft';
import { PlansService } from '../plans/plans.service';
import { WorkoutService } from './workout.service';

describe('WorkoutService', () => {
  let driver: SqlJsDriver;
  let clock: FakeClock;
  let service: WorkoutService;
  let planId: string;

  beforeEach(async () => {
    const db = await createTestDatabase();
    driver = db.driver;
    clock = db.clock;
    TestBed.configureTestingModule({
      imports: [TranslocoTestingModule.forRoot({ langs: { de: {} } })],
      providers: [...db.providers, provideMemorySettings()],
    });
    await seedCatalog([
      ...['bench', 'row'].map((key, i) => catalogEntry(`e${i}`, key)),
      catalogEntry('run', 'Grynd_Running', { category: 'cardio', images: [] }),
      catalogEntry('tread', 'Running_Treadmill', { category: 'cardio' }),
    ]);
    let draft = addExercises({ name: 'Oberkörper', weekdays: [], exercises: [] }, ['e0', 'e1']);
    draft = updateExercise(draft, 1, { targetSets: 2, repMin: 10, repMax: 12, restSeconds: 60 });
    planId = await TestBed.inject(PlansService).save(draft);
    service = TestBed.inject(WorkoutService);
  });

  afterEach(() => driver.close());

  const workout = () => service.workout()!;
  const setsOf = (i: number) => workout().exercises[i].sets;

  async function completeAll(i: number, weightKg: number, reps: number) {
    for (const set of setsOf(i)) {
      await service.updateSet(set.id, { weightKg, reps });
      clock.advance(60_000);
      await service.toggleComplete(set.id);
    }
  }

  it('copies the plan into an active session with targets and prefilled sets', async () => {
    await service.start(planId);

    expect(workout().session.status).toBe('active');
    expect(workout().planName).toBe('Oberkörper');
    expect(workout().exercises.map((e) => [e.entry.exerciseId, e.sets.length])).toEqual([
      ['e0', 3],
      ['e1', 2],
    ]);
    expect(workout().exercises[1].entry).toMatchObject({ repMin: 10, repMax: 12, restSeconds: 60 });
    expect(setsOf(1).map((s) => [s.weightKg, s.reps])).toEqual([
      [null, 10],
      [null, 10],
    ]);
  });

  it('allows only one active workout and restores it after a restart', async () => {
    const id = await service.start(planId);
    await expect(service.start(planId)).rejects.toThrow();

    const fresh = TestBed.runInInjectionContext(() => new WorkoutService());
    expect(await fresh.restore()).toBe(true);
    expect(fresh.workout()?.session.id).toBe(id);
  });

  it('never changes the plan', async () => {
    await service.start(planId);
    await service.addSet(0);
    await service.deleteSet(setsOf(1)[0].id);
    await service.moveExercise(0, 1);
    await service.setRestSeconds(0, 120);

    const plan = await TestBed.inject(PlansService).getDraft(planId);
    expect(plan?.exercises.map((e) => [e.exerciseId, e.targetSets, e.restSeconds])).toEqual([
      ['e0', 3, 90],
      ['e1', 2, 60],
    ]);
  });

  it('completes sets, marks the exercise done and ignores extra sets for that', async () => {
    await service.start(planId);
    await service.addSet(1);
    expect(setsOf(1).at(-1)).toMatchObject({ isExtra: true, position: 2 });

    expect(await service.toggleComplete(setsOf(1)[0].id)).toBe(true);
    await service.toggleComplete(setsOf(1)[1].id);
    expect(workout().exercises[1].entry.status).toBe('done');

    expect(await service.toggleComplete(setsOf(1)[0].id)).toBe(false);
    expect(workout().exercises[1].entry.status).toBe('open');
  });

  it('duplicates after the set and renumbers on delete', async () => {
    await service.start(planId);
    const [first] = setsOf(0);
    await service.updateSet(first.id, { weightKg: 80 });
    await service.duplicateSet(first.id);

    expect(setsOf(0).map((s) => [s.position, s.weightKg, s.isExtra])).toEqual([
      [0, 80, false],
      [1, 80, true],
      [2, null, false],
      [3, null, false],
    ]);

    await service.deleteSet(setsOf(0)[1].id);
    expect(setsOf(0).map((s) => s.position)).toEqual([0, 1, 2]);
  });

  it('brings a deleted planned set back before adding extra sets', async () => {
    await service.start(planId);
    const [first, second] = setsOf(1);
    await service.updateSet(first.id, { weightKg: 50 });
    await service.toggleComplete(first.id);
    await service.toggleComplete(second.id);
    await service.deleteSet(second.id);
    expect(workout().exercises[1].entry.status).toBe('done');

    await service.addSet(1);
    expect(setsOf(1).map((s) => [s.id, s.position, s.weightKg, s.isExtra, s.completedAt])).toEqual([
      [first.id, 0, 50, false, expect.any(String)],
      [second.id, 1, 50, false, null],
    ]);
    expect(workout().exercises[1].entry.status).toBe('open');

    await service.addSet(1);
    expect(setsOf(1).map((s) => s.isExtra)).toEqual([false, false, true]);
  });

  it('duplicating also brings a deleted planned set back', async () => {
    await service.start(planId);
    const [first, second] = setsOf(1);
    await service.deleteSet(second.id);

    await service.duplicateSet(first.id);
    expect(setsOf(1).map((s) => [s.id, s.isExtra])).toEqual([
      [first.id, false],
      [second.id, false],
    ]);
  });

  it('prefills the next session from the last finished one and detects records', async () => {
    await service.start(planId);
    await completeAll(0, 80, 8);
    await service.finish();

    await service.start(planId);
    expect(setsOf(0).map((s) => [s.weightKg, s.reps])).toEqual([
      [80, 8],
      [80, 8],
      [80, 8],
    ]);

    const [a, b] = setsOf(0);
    await service.toggleComplete(a.id); // equal → no record
    await service.updateSet(b.id, { weightKg: 85 });
    clock.advance(1000);
    await service.toggleComplete(b.id);
    expect([...service.records()]).toEqual([b.id]);
  });

  it('keeps the current exercise when reordering', async () => {
    await service.start(planId);
    await service.setCurrent(1);
    const currentId = workout().exercises[1].entry.id;

    await service.moveExercise(1, 0);

    expect(service.current()).toBe(0);
    expect(workout().exercises[0].entry.id).toBe(currentId);
  });

  it('stores exercise intervals of at least 3 seconds', async () => {
    await service.start(planId);
    const intervals = TestBed.inject(ExerciseIntervalRepository);
    await service.setCurrent(0);
    clock.advance(2_000);
    await service.setCurrent(1); // 2 s on exercise 0 → dropped
    clock.advance(90_000);
    await service.setCurrent(0); // 90 s on exercise 1 → kept

    expect(await intervals.findBySessionExercise(workout().exercises[0].entry.id)).toHaveLength(1); // the open one
    const kept = await intervals.findBySessionExercise(workout().exercises[1].entry.id);
    expect(kept.map((i) => i.leftAt !== null)).toEqual([true]);
  });

  it('closes stale intervals on restore at the last completed set', async () => {
    await service.start(planId);
    await service.setCurrent(0);
    clock.advance(30_000);
    await service.toggleComplete(setsOf(0)[0].id);
    const completedAt = setsOf(0)[0].completedAt;
    clock.advance(600_000); // app killed

    const fresh = TestBed.runInInjectionContext(() => new WorkoutService());
    await fresh.restore();

    const [interval] = await TestBed.inject(ExerciseIntervalRepository).findBySessionExercise(
      fresh.workout()!.exercises[0].entry.id,
    );
    expect(interval.leftAt).toBe(completedAt);
  });

  describe('pause', () => {
    const intervalsOf = (i: number) =>
      TestBed.inject(ExerciseIntervalRepository).findBySessionExercise(
        workout().exercises[i].entry.id,
      );
    const pauses = () => TestBed.inject(WorkoutPauseRepository).findBySession(workout().session.id);

    it('stops the clock and the exercise time until resumed', async () => {
      await service.start(planId);
      await service.setCurrent(0);
      clock.advance(60_000);

      await service.pause();
      const pausedAt = clock.nowUtc();
      expect(service.paused()).toBe(true);
      expect((await intervalsOf(0)).map((i) => i.leftAt)).toEqual([pausedAt]);
      expect(await pauses()).toEqual([expect.objectContaining({ pausedAt, resumedAt: null })]);

      clock.advance(600_000);
      expect(service.elapsedMs(clock.nowUtc())).toBe(60_000);

      await service.resume();
      expect(service.paused()).toBe(false);
      expect((await pauses())[0].resumedAt).toBe(clock.nowUtc());
      expect((await intervalsOf(0)).map((i) => i.leftAt)).toEqual([pausedAt, null]);

      clock.advance(30_000);
      expect(service.elapsedMs(clock.nowUtc())).toBe(90_000);
    });

    it('tracks no exercise time while paused', async () => {
      await service.start(planId);
      await service.setCurrent(0);
      await service.pause();
      clock.advance(60_000);

      await service.setCurrent(1);

      expect(service.current()).toBe(1);
      expect(await intervalsOf(1)).toEqual([]);
      await service.resume();
      expect((await intervalsOf(1)).map((i) => i.leftAt)).toEqual([null]);
    });

    it('pauses and resumes only once', async () => {
      await service.start(planId);
      await service.resume();
      await service.pause();
      await service.pause();
      expect(await pauses()).toHaveLength(1);

      await service.resume();
      await service.resume();
      expect((await pauses()).map((p) => p.resumedAt !== null)).toEqual([true]);
    });

    it('ends an open pause with the workout', async () => {
      const id = await service.start(planId);
      clock.advance(60_000);
      await service.pause();
      const pauseRows = await pauses();
      clock.advance(600_000);

      await service.finish();

      const finishedAt = (await TestBed.inject(WorkoutSessionRepository).findById(id))?.finishedAt;
      const [pause] = await TestBed.inject(WorkoutPauseRepository).findBySession(id);
      expect(pause.id).toBe(pauseRows[0].id);
      expect(pause.resumedAt).toBe(finishedAt);
    });

    it('stays paused after a restart', async () => {
      await service.start(planId);
      clock.advance(60_000);
      await service.pause();
      clock.advance(600_000);

      const fresh = TestBed.runInInjectionContext(() => new WorkoutService());
      await fresh.restore();

      expect(fresh.paused()).toBe(true);
      expect(fresh.elapsedMs(clock.nowUtc())).toBe(60_000);
    });
  });

  it('finishes or aborts the session', async () => {
    const first = await service.start(planId);
    await service.finish();
    expect(service.workout()).toBeNull();

    const second = await service.start(planId);
    await service.abort();

    const repo = TestBed.inject(WorkoutSessionRepository);
    expect((await repo.findById(first))?.status).toBe('finished');
    expect((await repo.findById(second))?.status).toBe('aborted');
    expect((await repo.findFinished()).map((s) => s.id)).toEqual([first]);
  });
  describe('cardio (decision 0024)', () => {
    async function cardioPlan(): Promise<string> {
      let draft = addExercises(
        { name: 'Beine', weekdays: [], exercises: [] },
        ['e0', 'tread'],
        (id) => id === 'tread',
      );
      draft = updateExercise(draft, 1, { targetDurationSec: 900 });
      return TestBed.inject(PlansService).save(draft);
    }

    it('copies the target duration, keeps the body weight and leaves reps out', async () => {
      await TestBed.inject(SettingsService).update({ bodyWeightKg: 72 });
      await service.start(await cardioPlan());

      expect(workout().session.bodyWeightKg).toBe(72);
      expect(workout().exercises.map((e) => e.cardio)).toEqual([false, true]);
      expect(workout().exercises[1].entry).toMatchObject({
        repMin: null,
        repMax: null,
        targetDurationSec: 900,
      });
      expect(setsOf(1)).toHaveLength(1);
      expect(setsOf(1)[0]).toMatchObject({ weightKg: null, reps: null, durationSec: 900 });
    });

    it('prefills distance and level from last time, never calories or heart rate', async () => {
      const id = await cardioPlan();
      await service.start(id);
      const entry = setsOf(1)[0];
      await service.updateSet(entry.id, { distanceM: 3000, level: 6, kcal: 200, heartRate: 150 });
      await service.toggleComplete(entry.id);
      await service.finish();

      await service.start(id);
      expect(setsOf(1)[0]).toMatchObject({
        durationSec: 900,
        distanceM: 3000,
        level: 6,
        kcal: null,
        heartRate: null,
      });
    });

    it('adds and duplicates entries with their values but without calories', async () => {
      await service.start(await cardioPlan());
      await service.updateSet(setsOf(1)[0].id, { distanceM: 2500, kcal: 180, heartRate: 140 });
      await service.addSet(1);
      await service.duplicateSet(setsOf(1)[0].id);

      expect(setsOf(1).map((s) => [s.durationSec, s.distanceM, s.kcal, s.reps])).toEqual([
        [900, 2500, 180, null],
        [900, 2500, null, null],
        [900, 2500, null, null],
      ]);
    });

    it('counts no records for cardio, even for old weight × reps entries', async () => {
      const id = await cardioPlan();
      await service.start(id);
      await service.updateSet(setsOf(1)[0].id, { weightKg: 10, reps: 10 });
      await service.toggleComplete(setsOf(1)[0].id);
      await service.finish();
      await service.start(id);
      await service.updateSet(setsOf(1)[0].id, { weightKg: 50, reps: 10 });
      await service.toggleComplete(setsOf(1)[0].id);
      expect(service.records().size).toBe(0);
    });

    it('starts a cardio workout without a plan and logs the active time on finish', async () => {
      await TestBed.inject(SettingsService).update({ bodyWeightKg: 80 });
      await service.startCardio('run');

      expect(workout().session).toMatchObject({ planId: null, bodyWeightKg: 80 });
      expect(workout().activity?.key).toBe('Grynd_Running');
      expect(service.standalone()).toBe(true);
      expect(workout().exercises).toHaveLength(1);
      await service.updateSet(setsOf(0)[0].id, { distanceM: 5000 });

      clock.advance(10 * 60_000);
      await service.pause();
      clock.advance(5 * 60_000);
      await service.resume();
      clock.advance(15 * 60_000);
      const sessionId = await service.finish();

      const se = await TestBed.inject(SessionExerciseRepository).findBySession(sessionId);
      const [entry] = await TestBed.inject(SetLogRepository).findBySessionExercise(se[0].id);
      expect(entry).toMatchObject({ durationSec: 25 * 60, distanceM: 5000 });
      expect(entry.completedAt).not.toBeNull();
    });

    it('starts no cardio workout while another one runs or for strength exercises', async () => {
      await expect(service.startCardio('e0')).rejects.toThrow();
      await service.startCardio('run');
      await expect(service.startCardio('run')).rejects.toThrow();
    });

    it('lists recently used cardio activities', async () => {
      await service.startCardio('run');
      await service.finish();
      await service.start(planId);
      await service.finish();
      const recent = TestBed.inject(SessionExerciseRepository);
      expect(await recent.findRecentExerciseIds(3, 'cardio')).toEqual(['run']);
      expect(await recent.findRecentExerciseIds(3)).toContain('e0');
    });
  });
});
