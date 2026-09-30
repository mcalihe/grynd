import { computed, inject, Injectable, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoService } from '@jsverse/transloco';
import { Exercise } from '../db/models';
import { ExerciseRepository } from '../db/repositories/exercise.repository';

/** The bundled exercise catalog, loaded once from SQLite and kept in memory (≈ 900 rows). */
@Injectable({ providedIn: 'root' })
export class ExerciseCatalogService {
  private readonly repo = inject(ExerciseRepository);
  private readonly lang = toSignal(inject(TranslocoService).langChanges$, { initialValue: 'de' });
  private readonly state = signal<Exercise[] | null>(null);
  private loading?: Promise<void>;

  readonly exercises = this.state.asReadonly();
  readonly byId = computed(() => new Map((this.state() ?? []).map((e) => [e.id, e])));

  load(): Promise<void> {
    this.loading ??= this.repo.findAll('nameEn').then((rows) => this.state.set(rows));
    return this.loading;
  }

  /** Display name in the active UI language. */
  name(exercise: Exercise | undefined): string {
    if (!exercise) {
      return '';
    }
    return this.lang() === 'de' ? exercise.nameDe : exercise.nameEn;
  }

  nameById(id: string): string {
    return this.name(this.byId().get(id));
  }
}
