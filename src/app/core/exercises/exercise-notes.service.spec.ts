import { TestBed } from '@angular/core/testing';
import { catalogEntry, seedCatalog } from '../../../testing/catalog';
import { SqlJsDriver } from '../../../testing/sqljs-driver';
import { createTestDatabase } from '../../../testing/test-database';
import { ExerciseNotesService, normalizeNote, NOTE_MAX_LENGTH } from './exercise-notes.service';

describe('normalizeNote', () => {
  it('trims and keeps line breaks inside', () => {
    expect(normalizeNote('  Sitz Stufe 4\nFüsse hoch \n')).toBe('Sitz Stufe 4\nFüsse hoch');
  });

  it('cuts long notes', () => {
    expect(normalizeNote('x'.repeat(NOTE_MAX_LENGTH + 20))).toHaveLength(NOTE_MAX_LENGTH);
  });

  it('turns whitespace into no note', () => {
    expect(normalizeNote(' \n\t ')).toBe('');
  });
});

describe('ExerciseNotesService', () => {
  let driver: SqlJsDriver;
  let notes: ExerciseNotesService;

  beforeEach(async () => {
    const db = await createTestDatabase();
    driver = db.driver;
    TestBed.configureTestingModule({ providers: db.providers });
    await seedCatalog(['bench', 'row'].map((key, i) => catalogEntry(`e${i}`, key)));
    notes = TestBed.inject(ExerciseNotesService);
  });

  afterEach(() => driver.close());

  const rows = () =>
    driver.query<{ exerciseId: string; text: string; deletedAt: string | null }>(
      'SELECT exerciseId, text, deletedAt FROM exercise_note ORDER BY createdAt, id',
    );

  it('has no note for an exercise by default', async () => {
    await notes.load();
    expect(notes.noteFor('e0')).toBe('');
    expect(notes.notes().size).toBe(0);
  });

  it('adds a note, then changes it in the same row', async () => {
    await notes.save('e0', ' Sitz Stufe 4 ');
    expect(notes.noteFor('e0')).toBe('Sitz Stufe 4');

    await notes.save('e0', 'Sitz Stufe 5');
    expect(notes.noteFor('e0')).toBe('Sitz Stufe 5');
    expect(await rows()).toEqual([{ exerciseId: 'e0', text: 'Sitz Stufe 5', deletedAt: null }]);
  });

  it('keeps notes per exercise', async () => {
    await notes.save('e0', 'Bank flach');
    await notes.save('e1', 'Brust ans Polster');

    expect(notes.noteFor('e0')).toBe('Bank flach');
    expect(notes.noteFor('e1')).toBe('Brust ans Polster');
  });

  it('deletes the note (soft) when it is emptied, and can add it again', async () => {
    await notes.save('e0', 'Sitz Stufe 4');
    await notes.save('e0', '   ');
    expect(notes.noteFor('e0')).toBe('');
    expect(notes.notes().has('e0')).toBe(false);

    await notes.save('e0', 'Sitz Stufe 3');
    expect(notes.noteFor('e0')).toBe('Sitz Stufe 3');
    const stored = await rows();
    expect(stored).toHaveLength(2);
    expect(stored[0].deletedAt).not.toBeNull();
    expect(stored[1]).toEqual({ exerciseId: 'e0', text: 'Sitz Stufe 3', deletedAt: null });
  });

  it('writes nothing when the note did not change', async () => {
    await notes.save('e0', '');
    await notes.save('e1', 'Griff eng');
    await notes.save('e1', 'Griff eng ');

    expect(await rows()).toHaveLength(1);
  });

  it('loads stored notes and reloads them after the database changed', async () => {
    await notes.save('e0', 'Sitz Stufe 4');
    await driver.run("UPDATE exercise_note SET text = 'aus Backup'");

    await notes.reload();

    expect(notes.noteFor('e0')).toBe('aus Backup');
  });
});
