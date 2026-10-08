import { inject, Injectable, signal } from '@angular/core';
import { ExerciseNoteRepository } from '../db/repositories/exercise-note.repository';

/** Notes are short reminders (seat position, grip, form cues), not a training diary. */
export const NOTE_MAX_LENGTH = 500;

/** Trimmed and cut to NOTE_MAX_LENGTH; an empty result means "no note". */
export function normalizeNote(text: string): string {
  return text.trim().slice(0, NOTE_MAX_LENGTH).trim();
}

/**
 * The user's notes per exercise, shared by all plans and workouts (decision 0019).
 * Loaded once and kept in memory; saving writes through to SQLite right away.
 */
@Injectable({ providedIn: 'root' })
export class ExerciseNotesService {
  private readonly repo = inject(ExerciseNoteRepository);
  private readonly state = signal<ReadonlyMap<string, string>>(new Map());
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

  /** Creates, changes or (for an empty text) deletes the note of an exercise. */
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

  private async fetch(): Promise<void> {
    const rows = await this.repo.findAll();
    this.state.set(new Map(rows.map((row) => [row.exerciseId, row.text])));
  }
}
