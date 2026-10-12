import { inject, Injectable, signal } from '@angular/core';
import { ExerciseNoteImageRepository } from '../db/repositories/exercise-note-image.repository';
import { ExerciseNoteRepository } from '../db/repositories/exercise-note.repository';
import { uuid7 } from '../utils/uuid7';
import { NOTE_IMAGE_ENCODER, NOTE_MAX_IMAGES } from './note-image';
import { NoteImageStore } from './note-image-store';

/** Notes are short reminders (seat position, grip, form cues), not a training diary. */
export const NOTE_MAX_LENGTH = 500;

/** Trimmed and cut to NOTE_MAX_LENGTH; an empty result means "no note". */
export function normalizeNote(text: string): string {
  return text.trim().slice(0, NOTE_MAX_LENGTH).trim();
}

/** A photo in the note of an exercise (decision 0021), ready for `<img src>`. */
export interface NoteImage {
  id: string;
  src: string;
}

export interface AddImagesResult {
  added: number;
  /** Left out because the exercise reached NOTE_MAX_IMAGES. */
  skipped: number;
  /** Could not be read or stored (e.g. an image format the web view cannot decode). */
  failed: number;
}

const NO_IMAGES: readonly NoteImage[] = [];

/**
 * The user's notes per exercise, shared by all plans and workouts (decision 0019): a text and
 * up to NOTE_MAX_IMAGES photos (decision 0021). Loaded once and kept in memory; changes are
 * written through to SQLite and the image files right away.
 */
@Injectable({ providedIn: 'root' })
export class ExerciseNotesService {
  private readonly repo = inject(ExerciseNoteRepository);
  private readonly imageRepo = inject(ExerciseNoteImageRepository);
  private readonly files = inject(NoteImageStore);
  private readonly encode = inject(NOTE_IMAGE_ENCODER);
  private readonly state = signal<ReadonlyMap<string, string>>(new Map());
  private readonly imageState = signal<ReadonlyMap<string, readonly NoteImage[]>>(new Map());
  private readonly pending = signal<ReadonlyMap<string, number>>(new Map());
  private loading?: Promise<void>;

  /** exerciseId → note text; exercises without a note are missing. */
  readonly notes = this.state.asReadonly();

  load(): Promise<void> {
    this.loading ??= this.fetch();
    return this.loading;
  }

  /** Reads the notes again, e.g. after a backup replaced them. */
  reload(): Promise<void> {
    this.loading = this.fetch();
    return this.loading;
  }

  /** The note of an exercise, or '' without one. Reactive when read in a template or computed. */
  noteFor(exerciseId: string): string {
    return this.state().get(exerciseId) ?? '';
  }

  /** The photos of an exercise's note, oldest first. Reactive like noteFor. */
  imagesFor(exerciseId: string): readonly NoteImage[] {
    return this.imageState().get(exerciseId) ?? NO_IMAGES;
  }

  /** Photos of an exercise that are still being scaled down and stored. */
  pendingFor(exerciseId: string): number {
    return this.pending().get(exerciseId) ?? 0;
  }

  /** A note is a text, photos or both. */
  hasNote(exerciseId: string): boolean {
    return !!this.noteFor(exerciseId) || this.imagesFor(exerciseId).length > 0;
  }

  /** Creates, changes or (for an empty text) deletes the note text of an exercise. */
  async save(exerciseId: string, text: string): Promise<void> {
    await this.load();
    const note = normalizeNote(text);
    const existing = await this.repo.findByExercise(exerciseId);
    if ((existing?.text ?? '') === note) {
      return;
    }
    if (!note) {
      await this.repo.softDelete(existing!.id);
    } else if (existing) {
      await this.repo.update(existing.id, { text: note });
    } else {
      await this.repo.insert({ exerciseId, text: note });
    }
    this.state.update((notes) => {
      const next = new Map(notes);
      if (note) {
        next.set(exerciseId, note);
      } else {
        next.delete(exerciseId);
      }
      return next;
    });
  }

  /**
   * Scales the picked images down and stores them one by one, each showing up when it is done.
   * Images beyond NOTE_MAX_IMAGES (counting ones still in progress) are skipped.
   */
  async addImages(exerciseId: string, files: readonly Blob[]): Promise<AddImagesResult> {
    await this.load();
    const free = NOTE_MAX_IMAGES - this.imagesFor(exerciseId).length - this.pendingFor(exerciseId);
    const accepted = files.slice(0, Math.max(0, free));
    const result: AddImagesResult = {
      added: 0,
      skipped: files.length - accepted.length,
      failed: 0,
    };
    this.changePending(exerciseId, accepted.length);
    for (const file of accepted) {
      try {
        const image = await this.store(exerciseId, file);
        this.imageState.update((images) =>
          withImages(images, exerciseId, [...(images.get(exerciseId) ?? []), image]),
        );
        result.added++;
      } catch {
        result.failed++;
      } finally {
        this.changePending(exerciseId, -1);
      }
    }
    return result;
  }

  /** Deletes a photo: the row softly, the file for good (it is private and takes space). */
  async removeImage(exerciseId: string, imageId: string): Promise<void> {
    await this.imageRepo.softDelete(imageId);
    await this.files.remove(imageId);
    this.imageState.update((images) =>
      withImages(
        images,
        exerciseId,
        (images.get(exerciseId) ?? []).filter((image) => image.id !== imageId),
      ),
    );
  }

  /** File first, row last: a row never points to a file that was not written. */
  private async store(exerciseId: string, file: Blob): Promise<NoteImage> {
    const data = await this.encode(file);
    const id = uuid7();
    await this.files.write(id, data);
    try {
      const src = await this.files.src(id);
      await this.imageRepo.insert({ id, exerciseId });
      return { id, src };
    } catch (error) {
      await this.files.remove(id);
      throw error;
    }
  }

  private changePending(exerciseId: string, delta: number): void {
    this.pending.update((pending) => {
      const next = new Map(pending);
      const count = (next.get(exerciseId) ?? 0) + delta;
      if (count > 0) {
        next.set(exerciseId, count);
      } else {
        next.delete(exerciseId);
      }
      return next;
    });
  }

  private async fetch(): Promise<void> {
    const [rows, imageRows] = await Promise.all([
      this.repo.findAll(),
      this.imageRepo.findAll('createdAt, id'),
    ]);
    // A photo whose file is gone (e.g. a failed restore) is left out.
    const images = await Promise.all(
      imageRows.map(async (row) => {
        const src = await this.files.src(row.id).catch(() => null);
        return src === null ? null : { exerciseId: row.exerciseId, image: { id: row.id, src } };
      }),
    );
    const byExercise = new Map<string, NoteImage[]>();
    for (const entry of images) {
      if (entry) {
        byExercise.set(entry.exerciseId, [
          ...(byExercise.get(entry.exerciseId) ?? []),
          entry.image,
        ]);
      }
    }
    this.state.set(new Map(rows.map((row) => [row.exerciseId, row.text])));
    this.imageState.set(byExercise);
  }
}

function withImages(
  images: ReadonlyMap<string, readonly NoteImage[]>,
  exerciseId: string,
  list: readonly NoteImage[],
): ReadonlyMap<string, readonly NoteImage[]> {
  const next = new Map(images);
  if (list.length) {
    next.set(exerciseId, list);
  } else {
    next.delete(exerciseId);
  }
  return next;
}
