import { TestBed } from '@angular/core/testing';
import { catalogEntry, seedCatalog } from '../../../testing/catalog';
import { SqlJsDriver } from '../../../testing/sqljs-driver';
import { MemoryNoteImageStore } from '../../../testing/note-image-store';
import { createTestDatabase } from '../../../testing/test-database';
import { ExerciseNotesService, normalizeNote, NOTE_MAX_LENGTH } from './exercise-notes.service';
import { NOTE_MAX_IMAGES } from './note-image';
import { NoteImageStore } from './note-image-store';

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

  describe('photos', () => {
    const photo = (name: string) => new Blob([name], { type: 'image/jpeg' });
    const files = () => TestBed.inject(NoteImageStore) as MemoryNoteImageStore;
    const imageRows = () =>
      driver.query<{ id: string; exerciseId: string; deletedAt: string | null }>(
        'SELECT id, exerciseId, deletedAt FROM exercise_note_image ORDER BY createdAt, id',
      );

    it('stores picked photos as files with a row each, in the order picked', async () => {
      const result = await notes.addImages('e0', [photo('sitz'), photo('griff')]);

      expect(result).toEqual({ added: 2, skipped: 0, failed: 0 });
      const images = notes.imagesFor('e0');
      expect(images.map((image) => image.src)).toEqual([
        `data:image/jpeg;base64,${btoa('sitz')}`,
        `data:image/jpeg;base64,${btoa('griff')}`,
      ]);
      expect((await imageRows()).map((row) => row.id)).toEqual(images.map((image) => image.id));
      expect([...files().files.keys()]).toEqual(images.map((image) => image.id));
      expect(notes.imagesFor('e1')).toEqual([]);
      expect(notes.pendingFor('e0')).toBe(0);
    });

    it('counts photos without text as a note', async () => {
      expect(notes.hasNote('e0')).toBe(false);
      await notes.addImages('e0', [photo('sitz')]);

      expect(notes.noteFor('e0')).toBe('');
      expect(notes.hasNote('e0')).toBe(true);
    });

    it('keeps the photos when the text is emptied', async () => {
      await notes.save('e0', 'Sitz Stufe 4');
      await notes.addImages('e0', [photo('sitz')]);
      await notes.save('e0', '');

      expect(notes.imagesFor('e0')).toHaveLength(1);
      expect(notes.hasNote('e0')).toBe(true);
    });

    it('skips photos beyond the limit', async () => {
      await notes.addImages('e0', [photo('a'), photo('b')]);
      const many = Array.from({ length: NOTE_MAX_IMAGES }, (_, i) => photo(`p${i}`));

      const result = await notes.addImages('e0', many);

      expect(result).toEqual({ added: NOTE_MAX_IMAGES - 2, skipped: 2, failed: 0 });
      expect(notes.imagesFor('e0')).toHaveLength(NOTE_MAX_IMAGES);
      expect(await notes.addImages('e0', [photo('z')])).toEqual({
        added: 0,
        skipped: 1,
        failed: 0,
      });
    });

    it('counts photos still in progress against the limit', async () => {
      const first = notes.addImages(
        'e0',
        Array.from({ length: NOTE_MAX_IMAGES - 1 }, (_, i) => photo(`p${i}`)),
      );
      const second = notes.addImages('e0', [photo('x'), photo('y')]);

      expect((await first).added + (await second).added).toBe(NOTE_MAX_IMAGES);
      expect(notes.imagesFor('e0')).toHaveLength(NOTE_MAX_IMAGES);
    });

    it('reports photos it cannot read and keeps the others', async () => {
      const result = await notes.addImages('e0', [photo('broken'), photo('sitz')]);

      expect(result).toEqual({ added: 1, skipped: 0, failed: 1 });
      expect(await imageRows()).toHaveLength(1);
      expect(files().files.size).toBe(1);
    });

    it('deletes a photo: the row softly, the file for good', async () => {
      await notes.addImages('e0', [photo('sitz'), photo('griff')]);
      const [first, second] = notes.imagesFor('e0');

      await notes.removeImage('e0', first.id);

      expect(notes.imagesFor('e0')).toEqual([second]);
      expect(files().files.has(first.id)).toBe(false);
      const stored = await imageRows();
      expect(stored.find((row) => row.id === first.id)?.deletedAt).not.toBeNull();

      await notes.removeImage('e0', second.id);
      expect(notes.hasNote('e0')).toBe(false);
    });

    it('loads stored photos and leaves out ones whose file is gone', async () => {
      await notes.addImages('e0', [photo('sitz'), photo('griff')]);
      const [lost, kept] = notes.imagesFor('e0');
      files().files.delete(lost.id);

      await notes.reload();

      expect(notes.imagesFor('e0')).toEqual([kept]);
    });
  });
});
