import { TestBed } from '@angular/core/testing';
import { catalogEntry, seedCatalog } from '../../../testing/catalog';
import { SqlJsDriver } from '../../../testing/sqljs-driver';
import { createTestDatabase } from '../../../testing/test-database';
import { WEIGHT_STEP } from '../units/weight';
import { ExerciseSettingsService } from './exercise-settings.service';

describe('ExerciseSettingsService', () => {
  let driver: SqlJsDriver;
  let settings: ExerciseSettingsService;

  beforeEach(async () => {
    const db = await createTestDatabase();
    driver = db.driver;
    TestBed.configureTestingModule({ providers: db.providers });
    await seedCatalog(['bench', 'row'].map((key, i) => catalogEntry(`e${i}`, key)));
    settings = TestBed.inject(ExerciseSettingsService);
  });

  afterEach(() => driver.close());

  const rows = () =>
    driver.query<{
      exerciseId: string;
      weightStepKg: number | null;
      weightStepLb: number | null;
      deletedAt: string | null;
    }>(
      `SELECT exerciseId, weightStepKg, weightStepLb, deletedAt FROM exercise_setting
        ORDER BY createdAt, id`,
    );

  it('uses the default step without a setting', async () => {
    await settings.load();
    expect(settings.weightStepFor('e0', 'kg')).toBe(WEIGHT_STEP);
    expect(settings.weightStepFor('e0', 'lb')).toBe(WEIGHT_STEP);
  });

  it('keeps the step per exercise and per unit', async () => {
    await settings.setWeightStep('e0', 'kg', 2);
    await settings.setWeightStep('e0', 'lb', 5);
    await settings.setWeightStep('e1', 'kg', 1.25);

    expect(settings.weightStepFor('e0', 'kg')).toBe(2);
    expect(settings.weightStepFor('e0', 'lb')).toBe(5);
    expect(settings.weightStepFor('e1', 'kg')).toBe(1.25);
    expect(settings.weightStepFor('e1', 'lb')).toBe(WEIGHT_STEP);
    expect(await rows()).toEqual([
      { exerciseId: 'e0', weightStepKg: 2, weightStepLb: 5, deletedAt: null },
      { exerciseId: 'e1', weightStepKg: 1.25, weightStepLb: null, deletedAt: null },
    ]);
  });

  it('stores the default as null and deletes the row once nothing is left', async () => {
    await settings.setWeightStep('e0', 'kg', 5);
    await settings.setWeightStep('e0', 'lb', 10);
    await settings.setWeightStep('e0', 'kg', WEIGHT_STEP);
    expect((await rows())[0]).toMatchObject({ weightStepKg: null, weightStepLb: 10 });

    await settings.setWeightStep('e0', 'lb', WEIGHT_STEP);
    expect(settings.weightStepFor('e0', 'lb')).toBe(WEIGHT_STEP);
    expect((await rows())[0].deletedAt).not.toBeNull();

    await settings.setWeightStep('e0', 'kg', 1);
    const stored = await rows();
    expect(stored).toHaveLength(2);
    expect(stored[1]).toMatchObject({ weightStepKg: 1, weightStepLb: null, deletedAt: null });
  });

  it('writes nothing for the default or an unchanged step', async () => {
    await settings.setWeightStep('e0', 'kg', WEIGHT_STEP);
    expect(await rows()).toEqual([]);

    await settings.setWeightStep('e1', 'kg', 2);
    const [before] = await driver.query<{ updatedAt: string }>(
      'SELECT updatedAt FROM exercise_setting',
    );
    await settings.setWeightStep('e1', 'kg', 2);
    expect(await driver.query('SELECT updatedAt FROM exercise_setting')).toEqual([before]);
  });

  it('ignores steps that are not positive', async () => {
    await settings.setWeightStep('e0', 'kg', 0);
    await settings.setWeightStep('e0', 'kg', Number.NaN);
    expect(settings.weightStepFor('e0', 'kg')).toBe(WEIGHT_STEP);
    expect(await rows()).toEqual([]);
  });

  it('loads stored settings and reloads them after the database changed', async () => {
    await settings.setWeightStep('e0', 'kg', 2);
    await driver.run('UPDATE exercise_setting SET weightStepKg = 0.5');

    await settings.reload();

    expect(settings.weightStepFor('e0', 'kg')).toBe(0.5);
  });
});
