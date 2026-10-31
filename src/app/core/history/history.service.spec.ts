import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { catalogEntry, seedCatalog } from '../../../testing/catalog';
import { provideMemorySettings } from '../../../testing/settings';
import { SqlJsDriver } from '../../../testing/sqljs-driver';
import { createTestDatabase, FakeClock } from '../../../testing/test-database';
import { addExercises } from '../plans/plan-draft';
import { PlansService } from '../plans/plans.service';
import { SettingsService } from '../settings/settings.service';
import { WorkoutService } from '../workout/workout.service';
import { recordsBySession } from './history-insights';
import { sessionDurationMs } from './history-stats';
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
    TestBed.configureTestingModule({
      imports: [TranslocoTestingModule.forRoot({ langs: { de: {} } })],
      providers: [...db.providers, provideMemorySettings()],
    });
    await seedCatalog([
      ...['bench', 'row'].map((key, i) => catalogEntry(`e${i}`, key)),
      catalogEntry('run', 'Grynd_Running', { category: 'cardio', images: [] }),
      catalogEntry('tread', 'Running_Treadmill', { category: 'cardio', muscleGroup: 'legs' }),
    ]);
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

  it('leaves the pauses out of the duration, also one still open at the end', async () => {
    const id = await workout.start(planId);
    clock.advance(10 * 60_000);
    await workout.pause();
    clock.advance(5 * 60_000);
    await workout.resume();
    clock.advance(20 * 60_000);
    await workout.pause();
    clock.advance(60 * 60_000);
    await workout.finish();

    const { summary } = (await history.detail(id))!;
    expect(summary.pausedMs).toBe(65 * 60_000);
    expect(sessionDurationMs(summary)).toBe(30 * 60_000);
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

  it('loads every completed set of finished sessions for the statistics', async () => {
    const first = await train([
      [80, 8],
      [null, 10],
    ]);
    await train([[100, 5]], 'abort');
    const second = await train([[82.5, 8]]);

    await history.loadFacts();
    expect(history.facts().map((f) => [f.sessionId, f.exerciseId, f.weightKg, f.reps])).toEqual([
      [first, 'e0', 80, 8],
      [first, 'e0', null, 10],
      [second, 'e0', 82.5, 8],
    ]);
    await history.load();
    expect(history.summaries()[0].planId).toBe(planId);
  });

  it('counts the same records in the statistics as in the detail', async () => {
    const ids = [
      await train([
        [80, 8],
        [85, 8],
      ]),
      await train([
        [85, 8],
        [90, 6],
        [92.5, 6],
      ]),
      await train([[70, 10]]),
      await train([
        [95, 5],
        [100, 3],
      ]),
    ];
    await history.loadFacts();
    const records = recordsBySession(history.facts());
    for (const id of ids) {
      const detail = await history.detail(id);
      const fromDetail = detail!.exercises.flatMap((e) => e.sets).filter((s) => s.record).length;
      expect(records.get(id) ?? 0).toBe(fromDetail);
    }
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
  describe('cardio and calories (decision 0025)', () => {
    /** A run without a plan: 25 minutes, 5 km, optionally with device calories. */
    async function run(kcal: number | null = null): Promise<string> {
      await workout.startCardio('run');
      const entry = workout.workout()!.exercises[0].sets[0];
      await workout.updateSet(entry.id, { distanceM: 5000, kcal });
      clock.advance(25 * 60_000);
      const id = await workout.finish();
      clock.advance(24 * 60 * 60_000);
      return id;
    }

    it('names a workout without a plan after its activity, with distance and no sets', async () => {
      const id = await run(310);
      await history.load();
      expect(history.summaries()[0]).toMatchObject({
        id,
        planId: null,
        activityId: 'run',
        setCount: 0,
        volumeKg: 0,
        cardioCount: 1,
        distanceM: 5000,
        energy: { kcal: 310, estimated: false },
      });

      const detail = await history.detail(id);
      expect(detail!.exercises[0]).toMatchObject({ cardio: true, exerciseKey: 'Grynd_Running' });
      expect(detail!.exercises[0].sets[0]).toMatchObject({ durationSec: 1500, distanceM: 5000 });
    });

    it('estimates with the body weight of the workout, else the current setting', async () => {
      const settings = TestBed.inject(SettingsService);
      await run(); // no body weight yet
      await settings.update({ bodyWeightKg: 80 });
      await run(); // keeps 80
      await settings.update({ bodyWeightKg: 60 });
      await history.load();

      // ACSM running at 12 km/h ≈ 12.43 MET × kg × 25/60 h
      const [withSnapshot, withoutSnapshot] = history.summaries();
      expect(withSnapshot.bodyWeightKg).toBe(80);
      expect(withSnapshot.energy?.kcal).toBe(414);
      expect(withoutSnapshot.bodyWeightKg).toBe(60);
      expect(withoutSnapshot.energy?.kcal).toBe(311);

      await settings.update({ bodyWeightKg: null });
      expect(history.summaries()[0].energy?.kcal).toBe(414);
      expect(history.summaries()[1].energy).toBeNull();
    });

    it('keeps cardio out of sets, volume and the statistics facts', async () => {
      const draft = addExercises(
        { name: 'Beine', weekdays: [], exercises: [] },
        ['e0', 'tread'],
        (id) => id === 'tread',
      );
      const legs = await TestBed.inject(PlansService).save(draft);
      await workout.start(legs);
      for (const exercise of workout.workout()!.exercises) {
        const set = exercise.sets[0];
        await workout.updateSet(set.id, { weightKg: 100, reps: 5 });
        await workout.toggleComplete(set.id);
      }
      clock.advance(30 * 60_000);
      const id = await workout.finish();

      await history.load();
      await history.loadFacts();
      expect(history.summaries().find((s) => s.id === id)).toMatchObject({
        setCount: 1,
        volumeKg: 500,
        cardioCount: 1,
      });
      expect(history.facts().map((f) => f.exerciseId)).toEqual(['e0']);
      const detail = await history.detail(id);
      expect(detail!.exercises.flatMap((e) => e.sets).some((s) => s.record)).toBe(false);
    });
  });
});
