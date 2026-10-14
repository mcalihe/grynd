import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { catalogEntry, seedCatalog } from '../../../testing/catalog';
import { MemoryNoteImageStore } from '../../../testing/note-image-store';
import { provideMemorySettings } from '../../../testing/settings';
import { SqlJsDriver } from '../../../testing/sqljs-driver';
import { createTestDatabase } from '../../../testing/test-database';
import { BackupService } from '../backup/backup.service';
import { ExerciseSettingRepository } from '../db/repositories/exercise-setting.repository';
import { ExerciseNotesService } from '../exercises/exercise-notes.service';
import { ExerciseSettingsService } from '../exercises/exercise-settings.service';
import { NoteImageStore } from '../exercises/note-image-store';
import { addExercises } from '../plans/plan-draft';
import { PlansService } from '../plans/plans.service';
import { ImportReader } from './import-reader';
import { PlanShare } from './plan-share';
import { PlanShareService } from './plan-share.service';
import { encodeShareCode } from './share-code';

describe('PlanShareService', () => {
  let driver: SqlJsDriver;
  let plans: PlansService;
  let notes: ExerciseNotesService;
  let steps: ExerciseSettingsService;
  let files: MemoryNoteImageStore;
  let service: PlanShareService;
  let planId: string;

  beforeEach(async () => {
    const db = await createTestDatabase();
    driver = db.driver;
    TestBed.configureTestingModule({
      imports: [TranslocoTestingModule.forRoot({ langs: { de: {} } })],
      providers: [...db.providers, provideMemorySettings()],
    });
    await seedCatalog(['bench', 'row', 'squat'].map((key, i) => catalogEntry(`e${i}`, key)));
    plans = TestBed.inject(PlansService);
    notes = TestBed.inject(ExerciseNotesService);
    steps = TestBed.inject(ExerciseSettingsService);
    files = TestBed.inject(NoteImageStore) as MemoryNoteImageStore;
    service = TestBed.inject(PlanShareService);

    planId = await plans.save(
      addExercises({ name: 'Oberkörper', weekdays: [1, 4], exercises: [] }, ['e0', 'e1']),
    );
    await notes.save('e0', 'Bank flach');
    await notes.addImages('e0', [new Blob(['sitz'])]);
    await notes.save('e2', 'Nicht im Plan');
    await steps.setWeightStep('e1', 'kg', 5);
  });

  afterEach(() => driver.close());

  const all = { notes: true, photos: true, weightSteps: true };

  it('shares the plan with the chosen extras of its exercises only', async () => {
    const share = (await service.create(planId, all))!;

    expect(share.plans).toEqual([
      {
        name: 'Oberkörper',
        weekdays: [1, 4],
        exercises: [
          { exerciseId: 'e0', targetSets: 3, repMin: 8, repMax: 12, restSeconds: 90 },
          { exerciseId: 'e1', targetSets: 3, repMin: 8, repMax: 12, restSeconds: 90 },
        ],
      },
    ]);
    expect(share.notes).toEqual([{ exerciseId: 'e0', text: 'Bank flach', images: [btoa('sitz')] }]);
    expect(share.weightSteps).toEqual([{ exerciseId: 'e1', kg: 5, lb: null }]);

    const bare = (await service.create(planId, {
      notes: false,
      photos: false,
      weightSteps: false,
    }))!;
    expect(bare.notes).toEqual([]);
    expect(bare.weightSteps).toEqual([]);

    const textOnly = (await service.create(planId, { ...all, photos: false }))!;
    expect(textOnly.notes[0].images).toEqual([]);
  });

  it('adds a shared plan next to the existing one, keeping own notes and steps', async () => {
    const share = (await service.create(planId, all))!;
    // The receiver has an own note on e0 and an own lb step on e1.
    await notes.save('e0', 'Meine Notiz');
    await steps.setWeightStep('e1', 'lb', 10);
    const share2: PlanShare = {
      ...share,
      notes: [...share.notes, { exerciseId: 'e1', text: 'Rudern eng', images: [] }],
      weightSteps: [{ exerciseId: 'e1', kg: 2, lb: 5 }],
    };

    const result = await service.import(share2);

    expect(result).toEqual({
      names: ['Oberkörper (2)'],
      notesAdded: 1,
      notesKept: 1,
      weightStepsAdded: 0,
    });
    expect(plans.plans()!.map((p) => [p.plan.name, p.exerciseCount])).toEqual([
      ['Oberkörper', 2],
      ['Oberkörper (2)', 2],
    ]);
    expect(notes.noteFor('e0')).toBe('Meine Notiz');
    expect(notes.noteFor('e1')).toBe('Rudern eng');
    // kg and lb were both set here already.
    expect(steps.weightStepFor('e1', 'kg')).toBe(5);
    expect(steps.weightStepFor('e1', 'lb')).toBe(10);
  });

  it('brings photos and steps to exercises without own ones', async () => {
    const share = (await service.create(planId, all))!;
    await notes.removeImage('e0', notes.imagesFor('e0')[0].id);
    await notes.save('e0', '');
    await steps.setWeightStep('e1', 'kg', 2.5);

    await service.import(share);

    expect(notes.noteFor('e0')).toBe('Bank flach');
    const [photo] = notes.imagesFor('e0');
    expect(files.files.get(photo.id)).toBe(btoa('sitz'));
    expect(steps.weightStepFor('e1', 'kg')).toBe(5);
  });

  it('removes written photos when the import fails', async () => {
    const share = (await service.create(planId, all))!;
    await notes.removeImage('e0', notes.imagesFor('e0')[0].id);
    await notes.save('e0', '');
    files.files.clear();
    const broken: PlanShare = { ...share, weightSteps: [{ exerciseId: 'e0', kg: 5, lb: null }] };
    vi.spyOn(TestBed.inject(ExerciseSettingRepository), 'insert').mockRejectedValue(
      new Error('disk full'),
    );

    await expect(service.import(broken)).rejects.toThrow();

    expect(files.files.size).toBe(0);
    expect(plans.plans()!.length).toBe(1);
    expect(notes.noteFor('e0')).toBe('');
  });

  it('reads a shared plan from a code in a chat message and from a file', async () => {
    const share = (await service.create(planId, { ...all, photos: false }))!;
    const reader = TestBed.inject(ImportReader);
    const code = await encodeShareCode(JSON.stringify(share));

    const fromCode = await reader.read(`Hier mein Plan:\n\n${code}\n`);
    expect(fromCode).toEqual({ kind: 'plan', share });

    const fromFile = await reader.readFile(new Blob([JSON.stringify(share)]));
    expect(fromFile.kind).toBe('plan');
  });

  it('tells what is wrong with a paste or file', async () => {
    const reader = TestBed.inject(ImportReader);
    const share = (await service.create(planId, { ...all, photos: false }))!;
    const code = await encodeShareCode(JSON.stringify(share));

    expect(await reader.read('  ')).toEqual({ kind: 'error', error: 'empty' });
    expect(await reader.read('hallo')).toEqual({ kind: 'error', error: 'format' });
    expect(await reader.read(code.slice(0, -10))).toEqual({ kind: 'error', error: 'damagedCode' });
    expect(await reader.read(JSON.stringify({ ...share, version: 9 }))).toEqual({
      kind: 'error',
      error: 'newerVersion',
    });
    const unknown = structuredClone(share);
    unknown.plans[0].exercises[0].exerciseId = 'newer';
    expect(await reader.read(JSON.stringify(unknown))).toEqual({
      kind: 'error',
      error: 'unknownExercise',
    });
    const huge = { size: 300 * 1024 * 1024 } as Blob;
    expect(await reader.readFile(huge)).toEqual({ kind: 'error', error: 'tooLarge' });
  });

  it('recognizes a backup', async () => {
    const backup = await TestBed.inject(BackupService).create();
    const content = await TestBed.inject(ImportReader).read(JSON.stringify(backup));
    expect(content.kind).toBe('backup');
  });
});
