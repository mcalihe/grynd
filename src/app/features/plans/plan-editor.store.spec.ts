import { TestBed } from '@angular/core/testing';
import { catalogEntry, seedCatalog } from '../../../testing/catalog';
import { SqlJsDriver } from '../../../testing/sqljs-driver';
import { createTestDatabase } from '../../../testing/test-database';
import { PlansService } from '../../core/plans/plans.service';
import { PlanEditorStore } from './plan-editor.store';

describe('PlanEditorStore', () => {
  let driver: SqlJsDriver;
  let store: PlanEditorStore;

  beforeEach(async () => {
    const db = await createTestDatabase();
    driver = db.driver;
    TestBed.configureTestingModule({ providers: [...db.providers, PlanEditorStore] });
    await seedCatalog(['bench', 'row', 'squat'].map((key, i) => catalogEntry(`e${i}`, key)));
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
