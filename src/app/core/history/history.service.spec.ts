import { TestBed } from '@angular/core/testing';
import { catalogEntry, seedCatalog } from '../../../testing/catalog';
import { SqlJsDriver } from '../../../testing/sqljs-driver';
import { createTestDatabase, FakeClock } from '../../../testing/test-database';
import { addExercises } from '../plans/plan-draft';
import { PlansService } from '../plans/plans.service';
import { WorkoutService } from '../workout/workout.service';
import { HistoryService } from './history.service';

describe('HistoryService', () => {
  let driver: SqlJsDriver;
  let clock: FakeClock;
  let workout: WorkoutService;
  let history: HistoryService;
  let planId: string;

  beforeEach(async () => {
    const db = await createTestDatabase();
    driver = db.driver;
    clock = db.clock;
    TestBed.configureTestingModule({ providers: db.providers });
    await seedCatalog(['bench', 'row'].map((key, i) => catalogEntry(`e${i}`, key)));
    const draft = addExercises({ name: 'Oberkörper', weekdays: [], exercises: [] }, ['e0', 'e1']);
    planId = await TestBed.inject(PlansService).save(draft);
    workout = TestBed.inject(WorkoutService);
    history = TestBed.inject(HistoryService);
  });

  afterEach(() => driver.close());

  /** Runs a workout: completes the first `count` sets of exercise 0 with the given values. */
  async function train(values: [number | null, number][], status: 'finish' | 'abort' = 'finish') {
    await workout.start(planId);
    await workout.setCurrent(0);
    const sets = workout.workout()!.exercises[0].sets;
    for (const [i, [weightKg, reps]] of values.entries()) {
      await workout.updateSet(sets[i].id, { weightKg, reps });
      clock.advance(60_000);
      await workout.toggleComplete(sets[i].id);
    }
    clock.advance(60_000);
    const id = await (status === 'finish' ? workout.finish() : workout.abort());
    clock.advance(24 * 60 * 60_000);
    return id;
  }

  it('lists finished sessions only, newest first, with counts and volume', async () => {
    const first = await train([
      [80, 8],
      [null, 10],
    ]);
    await train([[100, 5]], 'abort');
    const second = await train([[82.5, 8]]);

    await history.load();
    expect(history.summaries().map((s) => s.id)).toEqual([second, first]);
    expect(history.summaries()[1]).toMatchObject({
      planName: 'Oberkörper',
      exerciseCount: 1,
      setCount: 2,
      volumeKg: 640,
    });
    expect(Date.parse(history.summaries()[1].finishedAt)).toBe(
      Date.parse(history.summaries()[1].startedAt) + 3 * 60_000,
    );
  });

  it('shows completed sets with records measured against earlier sessions only', async () => {
    const first = await train([
      [80, 8],
      [85, 8],
    ]);
    const second = await train([
      [80, 8],
      [90, 8],
    ]);

    const earlier = await history.detail(first);
    expect(earlier!.exercises).toHaveLength(1);
    // The very first set has no baseline; later sets of the same session count as one.
    expect(earlier!.exercises[0].sets.map((s) => s.record)).toEqual([false, true]);
    expect(earlier!.exercises[0].timeMs).toBeGreaterThanOrEqual(3 * 60_000);

    const later = await history.detail(second);
    // 80 kg is below the 85 kg of the first session; 90 kg beats it. Later sessions never count.
    expect(later!.exercises[0].sets.map((s) => [s.weightKg, s.record])).toEqual([
      [80, false],
      [90, true],
    ]);
    const third = await train([[87.5, 8]]);
    expect((await history.detail(third))!.exercises[0].sets[0].record).toBe(false);
    expect((await history.detail(second))!.exercises[0].sets[1].record).toBe(true);
  });

  it('deletes a session from the history, prefill and records', async () => {
    await train([[80, 8]]);
    const heavy = await train([[100, 8]]);
    await history.load();

    await history.delete(heavy);
    expect(history.summaries()).toHaveLength(1);
    expect(await history.detail(heavy)).toBeUndefined();

    await workout.start(planId);
    expect(workout.workout()!.exercises[0].sets[0].weightKg).toBe(80);
  });
});
