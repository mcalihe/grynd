import { TestBed } from '@angular/core/testing';
import { catalogEntry, seedCatalog } from '../../../testing/catalog';
import { SqlJsDriver } from '../../../testing/sqljs-driver';
import { createTestDatabase, FakeClock } from '../../../testing/test-database';
import { PlanExerciseRepository, PlanRepository } from '../db/repositories/plan.repository';
import {
  addExercises,
  DEFAULT_TARGETS,
  emptyDraft,
  isDirty,
  isValid,
  moveItem,
  PlanDraft,
  removeExercise,
  updateExercise,
} from './plan-draft';
import { PlansService } from './plans.service';

describe('plan draft', () => {
  const base: PlanDraft = { name: 'Beine', weekdays: [2], exercises: [] };

  it('is valid with a name and at least one exercise', () => {
    expect(isValid(emptyDraft())).toBe(false);
    expect(isValid({ ...base, name: '   ' })).toBe(false);
    expect(isValid(base)).toBe(false);
    expect(isValid(addExercises(base, ['a']))).toBe(true);
  });

  it('adds exercises with defaults at the end and skips duplicates', () => {
    const draft = addExercises(addExercises(base, ['a']), ['b', 'a', 'b']);
    expect(draft.exercises.map((e) => e.exerciseId)).toEqual(['a', 'b']);
    expect(draft.exercises[1]).toEqual({ exerciseId: 'b', ...DEFAULT_TARGETS });
  });

  it('moves and removes items', () => {
    expect(moveItem(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
    expect(moveItem(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b']);
    const draft = removeExercise(addExercises(base, ['a', 'b']), 0);
    expect(draft.exercises.map((e) => e.exerciseId)).toEqual(['b']);
  });

  it('keeps the rep range consistent', () => {
    const draft = addExercises(base, ['a']);
    expect(updateExercise(draft, 0, { repMin: 15 }).exercises[0]).toMatchObject({
      repMin: 15,
      repMax: 15,
    });
    expect(updateExercise(draft, 0, { repMax: 5 }).exercises[0]).toMatchObject({
      repMin: 5,
      repMax: 5,
    });
  });

  it('detects changes, ignoring undone ones and whitespace', () => {
    const snapshot = addExercises(base, ['a', 'b']);
    expect(isDirty(snapshot, snapshot)).toBe(false);
    expect(isDirty({ ...snapshot, name: 'Beine ' }, snapshot)).toBe(false);
    expect(isDirty({ ...snapshot, weekdays: [2, 4] }, snapshot)).toBe(true);

    const reordered = { ...snapshot, exercises: moveItem(snapshot.exercises, 0, 1) };
    expect(isDirty(reordered, snapshot)).toBe(true);
    const back = { ...reordered, exercises: moveItem(reordered.exercises, 1, 0) };
    expect(isDirty(back, snapshot)).toBe(false);
  });
});

describe('PlansService', () => {
  let driver: SqlJsDriver;
  let clock: FakeClock;
  let service: PlansService;

  beforeEach(async () => {
    const db = await createTestDatabase();
    driver = db.driver;
    clock = db.clock; // 2026-09-30 is a Wednesday (getDay() === 3)
    TestBed.configureTestingModule({ providers: db.providers });
    await seedCatalog(['bench', 'row', 'squat'].map((key, i) => catalogEntry(`e${i}`, key)));
    service = TestBed.inject(PlansService);
  });

  afterEach(() => driver.close());

  function draft(overrides: Partial<PlanDraft> = {}): PlanDraft {
    return {
      ...addExercises({ name: 'Oberkörper', weekdays: [3], exercises: [] }, ['e0', 'e1']),
      ...overrides,
    };
  }

  it('creates a plan with exercises in order and lists it with its count', async () => {
    const id = await service.save(draft());

    expect(service.plans()?.map((p) => [p.plan.name, p.exerciseCount])).toEqual([
      ['Oberkörper', 2],
    ]);
    const saved = await service.getDraft(id);
    expect(saved?.exercises.map((e) => e.exerciseId)).toEqual(['e0', 'e1']);
    expect(saved?.exercises.every((e) => e.planExerciseId)).toBe(true);
  });

  it('updates, reorders, adds and removes exercises', async () => {
    const id = await service.save(draft());
    let edit = (await service.getDraft(id))!;
    edit = { ...edit, name: 'Upper', exercises: moveItem(edit.exercises, 0, 1) };
    edit = removeExercise(edit, 0); // removes e1
    edit = addExercises(edit, ['e2']);
    edit = updateExercise(edit, 0, { targetSets: 5 });

    await service.save(edit);

    const saved = (await service.getDraft(id))!;
    expect(saved.name).toBe('Upper');
    expect(saved.exercises.map((e) => [e.exerciseId, e.targetSets])).toEqual([
      ['e0', 5],
      ['e2', 3],
    ]);
    const rows = await TestBed.inject(PlanExerciseRepository).findByPlan(id);
    expect(rows.map((r) => r.position)).toEqual([0, 1]);
  });

  it('lists today plans by weekday', async () => {
    await service.save(draft({ name: 'Mittwoch', weekdays: [3] }));
    await service.save(draft({ name: 'Montag', weekdays: [1] }));
    expect(service.todayPlans().map((p) => p.plan.name)).toEqual(['Mittwoch']);

    clock.advance(5 * 24 * 60 * 60 * 1000); // Monday
    await service.load();
    expect(service.todayPlans().map((p) => p.plan.name)).toEqual(['Montag']);
  });

  it('soft-deletes a plan and its exercises', async () => {
    const id = await service.save(draft());
    await service.delete(id);

    expect(service.plans()).toEqual([]);
    expect(
      await TestBed.inject(PlanRepository).findById(id, { includeDeleted: true }),
    ).toBeDefined();
    expect(await TestBed.inject(PlanExerciseRepository).findByPlan(id)).toEqual([]);
  });
});
