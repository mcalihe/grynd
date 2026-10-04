import { TestBed } from '@angular/core/testing';
import { createTestDatabase, FakeClock } from '../../../../testing/test-database';
import { SqlJsDriver } from '../../../../testing/sqljs-driver';
import { Exercise, NewEntity } from '../models';
import { ExerciseRepository } from './exercise.repository';
import { PlanExerciseRepository, PlanRepository } from './plan.repository';
import {
  ExerciseIntervalRepository,
  SessionExerciseRepository,
  SetLogRepository,
  WorkoutSessionRepository,
} from './workout.repository';

const UUID7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function catalogEntry(id: string, key: string, nameDe = key): NewEntity<Exercise> & { id: string } {
  return {
    id,
    key,
    nameDe,
    nameEn: key,
    primaryMuscles: ['chest'],
    secondaryMuscles: ['triceps', 'shoulders'],
    muscleGroup: 'chest',
    force: 'push',
    equipment: 'barbell',
    level: 'beginner',
    category: 'strength',
    images: [`exercises/${key}.webp`],
  };
}

describe('repositories', () => {
  let driver: SqlJsDriver;
  let clock: FakeClock;

  beforeEach(async () => {
    const db = await createTestDatabase();
    driver = db.driver;
    clock = db.clock;
    TestBed.configureTestingModule({ providers: db.providers });
  });

  afterEach(() => driver.close());

  describe('BaseRepository (via PlanRepository)', () => {
    it('insert sets a UUIDv7 id and UTC timestamps', async () => {
      const plan = await TestBed.inject(PlanRepository).insert({ name: 'Beine', weekdays: [2, 5] });

      expect(plan.id).toMatch(UUID7);
      expect(plan.createdAt).toBe('2026-09-30T10:00:00.000Z');
      expect(plan.updatedAt).toBe(plan.createdAt);
      expect(plan.deletedAt).toBeNull();
    });

    it('round-trips JSON columns', async () => {
      const repo = TestBed.inject(PlanRepository);
      const { id } = await repo.insert({ name: 'Oberkörper', weekdays: [1, 4] });

      expect((await repo.findById(id))?.weekdays).toEqual([1, 4]);
    });

    it('update changes fields and updatedAt only', async () => {
      const repo = TestBed.inject(PlanRepository);
      const plan = await repo.insert({ name: 'Old', weekdays: [] });
      clock.advance(60_000);

      const updated = await repo.update(plan.id, { name: 'New' });

      expect(updated.name).toBe('New');
      expect(updated.createdAt).toBe(plan.createdAt);
      expect(updated.updatedAt).toBe('2026-09-30T10:01:00.000Z');
    });

    it('soft delete hides the row but keeps it', async () => {
      const repo = TestBed.inject(PlanRepository);
      const plan = await repo.insert({ name: 'Gone', weekdays: [] });

      await repo.softDelete(plan.id);

      expect(await repo.findById(plan.id)).toBeUndefined();
      expect(await repo.findAll()).toEqual([]);
      expect((await repo.findById(plan.id, { includeDeleted: true }))?.deletedAt).not.toBeNull();
      await expect(repo.update(plan.id, { name: 'x' })).rejects.toThrow();
    });

    it('restore undoes a soft delete', async () => {
      const repo = TestBed.inject(PlanRepository);
      const plan = await repo.insert({ name: 'Back', weekdays: [] });
      await repo.softDelete(plan.id);
      clock.advance(60_000);

      await repo.restore(plan.id);

      expect(await repo.findById(plan.id)).toMatchObject({
        deletedAt: null,
        updatedAt: '2026-09-30T10:01:00.000Z',
      });
    });
  });

  describe('ExerciseRepository', () => {
    it('upserts the catalog by stable id and soft-deletes removed entries', async () => {
      const repo = TestBed.inject(ExerciseRepository);
      await repo.upsertCatalog([catalogEntry('e1', 'bench'), catalogEntry('e2', 'row')]);
      await repo.upsertCatalog([catalogEntry('e1', 'bench', 'Bankdrücken')]);

      expect(await repo.count()).toBe(1);
      const bench = await repo.findByKey('bench');
      expect(bench?.nameDe).toBe('Bankdrücken');
      expect(bench?.secondaryMuscles).toEqual(['triceps', 'shoulders']);
      expect(await repo.findById('e2', { includeDeleted: true })).toBeDefined();
    });
  });

  describe('plan exercises and sessions', () => {
    async function seed() {
      await TestBed.inject(ExerciseRepository).upsertCatalog([
        catalogEntry('e1', 'bench'),
        catalogEntry('e2', 'row'),
      ]);
      const plan = await TestBed.inject(PlanRepository).insert({ name: 'OK', weekdays: [] });
      return plan;
    }

    it('lists plan exercises by position with defaults applied by the caller', async () => {
      const plan = await seed();
      const repo = TestBed.inject(PlanExerciseRepository);
      const base = { planId: plan.id, targetSets: 3, repMin: 8, repMax: 12, restSeconds: 90 };
      await repo.insert({ ...base, exerciseId: 'e2', position: 1 });
      await repo.insert({ ...base, exerciseId: 'e1', position: 0 });

      expect((await repo.findByPlan(plan.id)).map((pe) => pe.exerciseId)).toEqual(['e1', 'e2']);
    });

    it('rejects references to unknown rows', async () => {
      await seed();
      await expect(
        TestBed.inject(PlanExerciseRepository).insert({
          planId: 'missing',
          exerciseId: 'e1',
          position: 0,
          targetSets: 3,
          repMin: 8,
          repMax: 12,
          restSeconds: 90,
        }),
      ).rejects.toThrow();
    });

    it('stores sets with booleans and finds the active session', async () => {
      const plan = await seed();
      const sessions = TestBed.inject(WorkoutSessionRepository);
      const session = await sessions.insert({
        planId: plan.id,
        startedAt: clock.nowUtc(),
        finishedAt: null,
        status: 'active',
      });
      const sessionExercise = await TestBed.inject(SessionExerciseRepository).insert({
        sessionId: session.id,
        exerciseId: 'e1',
        position: 0,
        status: 'open',
        repMin: 8,
        repMax: 12,
        restSeconds: 90,
      });
      const sets = TestBed.inject(SetLogRepository);
      await sets.insert({
        sessionExerciseId: sessionExercise.id,
        position: 1,
        weightKg: 82.5,
        reps: 8,
        completedAt: null,
        isExtra: true,
      });
      await sets.insert({
        sessionExerciseId: sessionExercise.id,
        position: 0,
        weightKg: 80,
        reps: 8,
        completedAt: clock.nowUtc(),
        isExtra: false,
      });

      expect((await sessions.findActive())?.id).toBe(session.id);
      const logged = await sets.findBySessionExercise(sessionExercise.id);
      expect(logged.map((s) => [s.position, s.weightKg, s.isExtra])).toEqual([
        [0, 80, false],
        [1, 82.5, true],
      ]);
    });

    it('returns recently used exercises, newest first', async () => {
      const plan = await seed();
      const session = await TestBed.inject(WorkoutSessionRepository).insert({
        planId: plan.id,
        startedAt: clock.nowUtc(),
        finishedAt: null,
        status: 'finished',
      });
      const repo = TestBed.inject(SessionExerciseRepository);
      const base = {
        sessionId: session.id,
        status: 'done' as const,
        repMin: 8,
        repMax: 12,
        restSeconds: 90,
      };
      await repo.insert({ ...base, exerciseId: 'e1', position: 0 });
      clock.advance(1000);
      await repo.insert({ ...base, exerciseId: 'e2', position: 1 });

      expect(await repo.findRecentExerciseIds(3)).toEqual(['e2', 'e1']);
    });

    it('finds open exercise intervals', async () => {
      const plan = await seed();
      const session = await TestBed.inject(WorkoutSessionRepository).insert({
        planId: plan.id,
        startedAt: clock.nowUtc(),
        finishedAt: null,
        status: 'active',
      });
      const se = await TestBed.inject(SessionExerciseRepository).insert({
        sessionId: session.id,
        exerciseId: 'e1',
        position: 0,
        status: 'open',
        repMin: null,
        repMax: null,
        restSeconds: null,
      });
      const intervals = TestBed.inject(ExerciseIntervalRepository);
      await intervals.insert({
        sessionExerciseId: se.id,
        enteredAt: clock.nowUtc(),
        leftAt: clock.nowUtc(),
      });
      const open = await intervals.insert({
        sessionExerciseId: se.id,
        enteredAt: clock.nowUtc(),
        leftAt: null,
      });

      expect((await intervals.findOpen()).map((i) => i.id)).toEqual([open.id]);
      expect(await intervals.findBySessionExercise(se.id)).toHaveLength(2);
    });
  });
});
