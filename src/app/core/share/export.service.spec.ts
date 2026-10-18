import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { catalogEntry, seedCatalog } from '../../../testing/catalog';
import { provideMemorySettings } from '../../../testing/settings';
import { SqlJsDriver } from '../../../testing/sqljs-driver';
import { createTestDatabase } from '../../../testing/test-database';
import { ExportSelection } from '../backup/backup';
import { ExerciseNotesService } from '../exercises/exercise-notes.service';
import { addExercises } from '../plans/plan-draft';
import { PlansService } from '../plans/plans.service';
import { WorkoutService } from '../workout/workout.service';
import { ExportService } from './export.service';
import { ImportReader } from './import-reader';

describe('ExportService', () => {
  let driver: SqlJsDriver;
  let exports: ExportService;
  let reader: ImportReader;
  let push: string;

  beforeEach(async () => {
    const db = await createTestDatabase();
    driver = db.driver;
    TestBed.configureTestingModule({
      imports: [TranslocoTestingModule.forRoot({ langs: { de: {} } })],
      providers: [...db.providers, provideMemorySettings()],
    });
    await seedCatalog(['bench', 'squat'].map((key, i) => catalogEntry(`e${i}`, key)));
    const plans = TestBed.inject(PlansService);
    push = await plans.save(addExercises({ name: 'Push', weekdays: [1], exercises: [] }, ['e0']));
    await plans.save(addExercises({ name: 'Beine', weekdays: [], exercises: [] }, ['e1']));
    await TestBed.inject(ExerciseNotesService).save('e0', 'Bank flach');
    const workout = TestBed.inject(WorkoutService);
    await workout.start(push);
    await workout.finish();
    exports = TestBed.inject(ExportService);
    reader = TestBed.inject(ImportReader);
  });

  afterEach(() => driver.close());

  const select = (patch: Partial<ExportSelection>): ExportSelection => ({
    plans: 'all',
    history: true,
    notes: true,
    photos: false,
    weightSteps: true,
    ...patch,
  });

  it('exports one plan without history as a template, as code and file', async () => {
    const result = await exports.build(select({ plans: [push], history: false }));

    expect(result.fileName).toBe('grynd-plan-push.json');
    expect(result.code).toMatch(/^GRYND1:[A-Za-z0-9_-]+$/);
    const fromCode = await reader.read(result.code!);
    expect(fromCode.kind).toBe('plan');
    expect(fromCode.kind === 'plan' && fromCode.share.plans.map((p) => p.name)).toEqual(['Push']);
    expect(fromCode.kind === 'plan' && fromCode.share.notes[0].text).toBe('Bank flach');
    expect(await reader.read(result.json)).toEqual(fromCode);
  });

  it('exports all plans without history as one template', async () => {
    const result = await exports.build(select({ history: false }));
    const content = await reader.read(result.code!);
    expect(result.fileName).toMatch(/^grynd-plans-\d{4}-\d\d-\d\d-\d{4}\.json$/);
    expect(content.kind === 'plan' && content.share.plans.map((p) => p.name)).toEqual([
      'Push',
      'Beine',
    ]);
  });

  it('exports history as a backup: partial for some plans, complete for everything', async () => {
    const part = await exports.build(select({ plans: [push] }));
    const read = await reader.read(part.code!);
    expect(part.fileName).toMatch(/^grynd-export-/);
    expect(read.kind === 'backup' && read.backup.complete).toBe(false);
    expect(read.kind === 'backup' && read.backup.data.workout_session).toHaveLength(1);
    expect(read.kind === 'backup' && read.backup.data.plan).toHaveLength(1);

    const full = await exports.build(select({ photos: true }));
    expect(full.code).toBeNull();
    expect(full.fileName).toMatch(/^grynd-backup-/);
    const fullRead = await reader.read(full.json);
    expect(fullRead.kind === 'backup' && fullRead.backup.complete).toBe(true);
  });
});
