import { TestBed } from '@angular/core/testing';
import { catalogEntry, seedCatalog } from '../../../testing/catalog';
import { SqlJsDriver } from '../../../testing/sqljs-driver';
import { createTestDatabase, FakeClock } from '../../../testing/test-database';
import {
  ExerciseIntervalRepository,
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
    TestBed.configureTestingModule({ providers: db.providers });
    await seedCatalog(['bench', 'row'].map((key, i) => catalogEntry(`e${i}`, key)));
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
});
