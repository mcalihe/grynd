import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { catalogEntry, seedCatalog } from '../../../testing/catalog';
import { provideMemorySettings } from '../../../testing/settings';
import { SqlJsDriver } from '../../../testing/sqljs-driver';
import { MemoryNoteImageStore } from '../../../testing/note-image-store';
import { createTestDatabase } from '../../../testing/test-database';
import { ExerciseNotesService } from '../exercises/exercise-notes.service';
import { NoteImageStore } from '../exercises/note-image-store';
import { ExerciseSettingsService } from '../exercises/exercise-settings.service';
import { addExercises } from '../plans/plan-draft';
import { PlansService } from '../plans/plans.service';
import { WorkoutService } from '../workout/workout.service';
import { Backup } from './backup';
import { BackupService } from './backup.service';

describe('BackupService', () => {
  let driver: SqlJsDriver;
  let backups: BackupService;
  let plans: PlansService;

  beforeEach(async () => {
    const db = await createTestDatabase();
    driver = db.driver;
    TestBed.configureTestingModule({
      imports: [TranslocoTestingModule.forRoot({ langs: { de: {} } })],
      providers: [...db.providers, provideMemorySettings()],
    });
    await seedCatalog(['bench', 'row'].map((key, i) => catalogEntry(`e${i}`, key)));
    plans = TestBed.inject(PlansService);
    backups = TestBed.inject(BackupService);

    // One plan and one finished workout with a completed set.
    const planId = await plans.save(
      addExercises({ name: 'Oberkörper', weekdays: [1], exercises: [] }, ['e0', 'e1']),
    );
    const workout = TestBed.inject(WorkoutService);
    await workout.start(planId);
    const [set] = workout.workout()!.exercises[0].sets;
    await workout.updateSet(set.id, { weightKg: 80, reps: 8 });
    await workout.toggleComplete(set.id);
    await workout.finish();
  });

  afterEach(() => driver.close());

  const count = async (table: string) =>
    (await driver.query<{ n: number }>(`SELECT count(*) AS n FROM ${table}`))[0].n;

  it('restores exactly what was exported', async () => {
    const backup = await backups.create();
    const parsed = await backups.parse(JSON.stringify(backup));
    expect(parsed.ok).toBe(true);

    await plans.save(addExercises({ name: 'Beine', weekdays: [], exercises: [] }, ['e1']));
    expect(await count('plan')).toBe(2);

    await backups.restore((parsed as { backup: Backup }).backup);
    expect(await backups.create()).toEqual({ ...backup, exportedAt: expect.any(String) });
    expect(await count('plan')).toBe(1);
    expect(await count('set_log')).toBe(6);
  });

  it('brings back exercise notes and shows them right away', async () => {
    const notes = TestBed.inject(ExerciseNotesService);
    await notes.save('e0', 'Bank flach');
    const backup = await backups.create();
    expect(backup.data.exercise_note).toHaveLength(1);

    await notes.save('e0', 'Sitz Stufe 4');
    await notes.save('e1', 'Griff eng');
    await backups.restore(backup);

    expect(notes.noteFor('e0')).toBe('Bank flach');
    expect(notes.noteFor('e1')).toBe('');
  });

  it('carries the files of note photos and replaces the ones on the device', async () => {
    const notes = TestBed.inject(ExerciseNotesService);
    const files = TestBed.inject(NoteImageStore) as MemoryNoteImageStore;
    const photo = (name: string) => new Blob([name], { type: 'image/jpeg' });
    await notes.addImages('e0', [photo('sitz'), photo('griff')]);
    const [kept, deleted] = notes.imagesFor('e0');
    await notes.removeImage('e0', deleted.id);

    const backup = await backups.create();
    expect(backup.data.exercise_note_image.map((row) => row['id'])).toEqual([kept.id, deleted.id]);
    expect(backup.images).toEqual({ [kept.id]: btoa('sitz') });
    const parsed = await backups.parse(JSON.stringify(backup));
    expect(parsed.ok).toBe(true);

    await notes.addImages('e1', [photo('neu')]);
    await backups.restore((parsed as { backup: Backup }).backup);

    expect([...files.files.entries()]).toEqual([[kept.id, btoa('sitz')]]);
    expect(notes.imagesFor('e0')).toEqual([kept]);
    expect(notes.imagesFor('e1')).toEqual([]);
  });

  it('leaves photos without a file out of the backup', async () => {
    const notes = TestBed.inject(ExerciseNotesService);
    const files = TestBed.inject(NoteImageStore) as MemoryNoteImageStore;
    await notes.addImages('e0', [new Blob(['sitz'])]);
    files.files.clear();

    const backup = await backups.create();

    expect(backup.data.exercise_note_image).toEqual([]);
    expect(backup.images).toEqual({});
    expect((await backups.parse(JSON.stringify(backup))).ok).toBe(true);
  });

  it('brings back weight steps and uses them right away', async () => {
    const settings = TestBed.inject(ExerciseSettingsService);
    await settings.setWeightStep('e0', 'kg', 2);
    const backup = await backups.create();
    expect(backup.data.exercise_setting).toHaveLength(1);

    await settings.setWeightStep('e0', 'kg', 5);
    await settings.setWeightStep('e1', 'lb', 5);
    await backups.restore(backup);

    expect(settings.weightStepFor('e0', 'kg')).toBe(2);
    expect(settings.weightStepFor('e1', 'lb')).toBe(2.5);
  });

  it('rejects broken files without touching the data', async () => {
    expect(await backups.parse('{ nope')).toEqual({ ok: false, error: 'format' });

    const backup = await backups.create();
    backup.data.plan_exercise[0]['exerciseId'] = 'not-in-catalog';
    expect(await backups.parse(JSON.stringify(backup))).toEqual({
      ok: false,
      error: 'missingReference',
    });
    expect(await count('plan')).toBe(1);
  });

  it('rolls back when the database refuses the data', async () => {
    const backup = await backups.create();
    // Two active workouts violate the «one active session» index.
    const session = backup.data.workout_session[0];
    backup.data.workout_session = [
      { ...session, status: 'active' },
      { ...session, id: 'second', status: 'active' },
    ];
    await expect(backups.restore(backup)).rejects.toThrow();
    expect(await count('plan')).toBe(1);
    expect(await count('workout_session')).toBe(1);
  });
});
