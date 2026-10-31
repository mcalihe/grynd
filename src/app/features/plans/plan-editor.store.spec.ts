import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { catalogEntry, seedCatalog } from '../../../testing/catalog';
import { SqlJsDriver } from '../../../testing/sqljs-driver';
import { createTestDatabase } from '../../../testing/test-database';
import { ExerciseCatalogService } from '../../core/exercises/exercise-catalog.service';
import { PlansService } from '../../core/plans/plans.service';
import { PlanEditorStore } from './plan-editor.store';

describe('PlanEditorStore', () => {
  let driver: SqlJsDriver;
  let store: PlanEditorStore;

  beforeEach(async () => {
    const db = await createTestDatabase();
    driver = db.driver;
    TestBed.configureTestingModule({
      imports: [TranslocoTestingModule.forRoot({ langs: { de: {} } })],
      providers: [...db.providers, PlanEditorStore],
    });
    await seedCatalog([
      ...['bench', 'row', 'squat'].map((key, i) => catalogEntry(`e${i}`, key)),
      catalogEntry('run', 'Grynd_Running', { category: 'cardio', images: [] }),
    ]);
    store = TestBed.inject(PlanEditorStore);
  });

  afterEach(() => driver.close());

  it('starts a new plan clean and invalid', async () => {
    expect(await store.init(null)).toBe(true);
    expect(store.isNew()).toBe(true);
    expect(store.dirty()).toBe(false);
    expect(store.valid()).toBe(false);
  });

  it('becomes valid with a name and an exercise, and clean again after saving', async () => {
    await store.init(null);
    store.setName('Beine');
    store.add(['e2']);
    expect(store.valid()).toBe(true);
    expect(store.dirty()).toBe(true);

    const id = await store.save();

    expect(store.dirty()).toBe(false);
    expect(store.isNew()).toBe(false);
    expect(TestBed.inject(PlansService).plans()?.[0].plan.id).toBe(id);
  });

  it('adds cardio exercises with a target duration (decision 0024)', async () => {
    await TestBed.inject(ExerciseCatalogService).load();
    await store.init(null);
    store.add(['e0', 'run']);
    expect(store.draft().exercises.map((e) => e.targetDurationSec)).toEqual([null, 600]);
  });

  it('keeps the draft when init runs again (returning from the picker)', async () => {
    await store.init(null);
    store.setName('Draft');
    await store.init(null);
    expect(store.draft().name).toBe('Draft');
  });

  it('loads an existing plan and treats undone edits as clean', async () => {
    await store.init(null);
    store.setName('Oberkörper');
    store.add(['e0', 'e1']);
    const id = await store.save();

    const editor = TestBed.runInInjectionContext(() => new PlanEditorStore());
    expect(await editor.init(id)).toBe(true);
    editor.move(0, 1);
    expect(editor.dirty()).toBe(true);
    editor.move(1, 0);
    expect(editor.dirty()).toBe(false);
  });

  it('reports unknown plans', async () => {
    expect(await store.init('missing')).toBe(false);
    expect(await store.init(null, { planId: 'missing', name: (n) => n })).toBe(false);
  });

  describe('duplicating', () => {
    const copyName = (name: string) => `${name} (Kopie)`;
    let sourceId: string;

    beforeEach(async () => {
      await store.init(null);
      store.setName('Push');
      store.setWeekdays([1, 4]);
      store.add(['e0', 'e1']);
      store.update(0, { targetSets: 5, restSeconds: 120 });
      sourceId = await store.save();
    });

    function copyEditor(): PlanEditorStore {
      return TestBed.runInInjectionContext(() => new PlanEditorStore());
    }

    it('starts a new, unsaved plan with the source name, weekdays and targets', async () => {
      const editor = copyEditor();
      expect(await editor.init(null, { planId: sourceId, name: copyName })).toBe(true);

      expect(editor.isNew()).toBe(true);
      expect(editor.dirty()).toBe(true);
      expect(editor.valid()).toBe(true);
      expect(editor.draft().name).toBe('Push (Kopie)');
      expect(editor.draft().weekdays).toEqual([1, 4]);
      expect(
        editor.draft().exercises.map((e) => [e.exerciseId, e.targetSets, e.restSeconds]),
      ).toEqual([
        ['e0', 5, 120],
        ['e1', 3, 90],
      ]);
      expect(editor.draft().exercises.every((e) => !e.planExerciseId)).toBe(true);
    });

    it('keeps the copy when the picker initializes the new plan', async () => {
      const editor = copyEditor();
      await editor.init(null, { planId: sourceId, name: copyName });
      editor.setName('Push B');

      await editor.init(null);

      expect(editor.draft().name).toBe('Push B');
      expect(editor.draft().exercises).toHaveLength(2);
    });

    it('saves a second plan and leaves the source untouched', async () => {
      const plans = TestBed.inject(PlansService);
      const before = await plans.getDraft(sourceId);
      const editor = copyEditor();
      await editor.init(null, { planId: sourceId, name: copyName });
      editor.remove(1);

      const copyId = await editor.save();

      expect(copyId).not.toBe(sourceId);
      expect(plans.plans()?.map((p) => [p.plan.name, p.exerciseCount])).toEqual([
        ['Push', 2],
        ['Push (Kopie)', 1],
      ]);
      expect(await plans.getDraft(sourceId)).toEqual(before);
      expect(editor.dirty()).toBe(false);
    });
  });

  it('deletes the plan and leaves the store clean', async () => {
    await store.init(null);
    store.setName('Weg');
    store.add(['e0']);
    await store.save();
    store.setName('changed');

    await store.delete();

    expect(store.dirty()).toBe(false);
    expect(TestBed.inject(PlansService).plans()).toEqual([]);
  });
});
