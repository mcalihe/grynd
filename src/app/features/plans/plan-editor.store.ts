import { computed, inject, Injectable, signal } from '@angular/core';
import {
  addExercises,
  copyDraft,
  DraftExercise,
  emptyDraft,
  isDirty,
  isValid,
  moveItem,
  PlanDraft,
  removeExercise,
  updateExercise,
} from '../../core/plans/plan-draft';
import { PlansService } from '../../core/plans/plans.service';

/** Plan to duplicate and how to name the copy (the name is translated by the caller). */
export interface PlanCopy {
  planId: string;
  name: (sourceName: string) => string;
}

/**
 * Draft of the plan being created or edited. Provided on the editor route so it survives the
 * trip to «Übungen hinzufügen» and is discarded when the editor is left.
 */
@Injectable()
export class PlanEditorStore {
  private readonly plans = inject(PlansService);

  private readonly snapshot = signal<PlanDraft>(emptyDraft());
  private loadedKey?: string;

  readonly draft = signal<PlanDraft>(emptyDraft());
  readonly loaded = signal(false);
  readonly isNew = computed(() => !this.draft().id);
  readonly dirty = computed(() => isDirty(this.draft(), this.snapshot()));
  readonly valid = computed(() => isValid(this.draft()));
  readonly exerciseIds = computed(() => new Set(this.draft().exercises.map((e) => e.exerciseId)));

  /**
   * Loads the plan once per editor visit; returns false if the plan (or the copied one) does
   * not exist. With `copyOf`, a new plan starts as a copy that counts as unsaved changes.
   */
  async init(id: string | null, copyOf?: PlanCopy): Promise<boolean> {
    // A copy is a new plan: the picker's init(null) must find and keep its draft.
    const key = id ?? 'new';
    if (this.loadedKey === key) {
      return true;
    }
    const source = id ?? copyOf?.planId;
    const loaded = source ? await this.plans.getDraft(source) : emptyDraft();
    if (!loaded) {
      return false;
    }
    const draft = !id && copyOf ? copyDraft(loaded, copyOf.name(loaded.name)) : loaded;
    this.loadedKey = key;
    this.draft.set(draft);
    this.snapshot.set(draft === loaded ? draft : emptyDraft());
    this.loaded.set(true);
    return true;
  }

  setName(name: string): void {
    this.draft.update((d) => ({ ...d, name }));
  }

  setWeekdays(weekdays: readonly number[]): void {
    this.draft.update((d) => ({ ...d, weekdays: [...weekdays] }));
  }

  add(exerciseIds: readonly string[]): void {
    this.draft.update((d) => addExercises(d, exerciseIds));
  }

  remove(index: number): void {
    this.draft.update((d) => removeExercise(d, index));
  }

  move(from: number, to: number): void {
    this.draft.update((d) => ({ ...d, exercises: moveItem(d.exercises, from, to) }));
  }

  update(
    index: number,
    patch: Partial<Omit<DraftExercise, 'planExerciseId' | 'exerciseId'>>,
  ): void {
    this.draft.update((d) => updateExercise(d, index, patch));
  }

  /** Saves and makes the saved state the new snapshot, so leaving is not blocked. */
  async save(): Promise<string> {
    const id = await this.plans.save(this.draft());
    const saved = (await this.plans.getDraft(id)) ?? { ...this.draft(), id };
    this.loadedKey = id;
    this.draft.set(saved);
    this.snapshot.set(saved);
    return id;
  }

  /**
   * Forgets the draft when the editor is left. Route-level providers outlive the visit
   * (Angular reuses the route injector), so the next visit must start from the database.
   */
  reset(): void {
    this.loadedKey = undefined;
    this.loaded.set(false);
    this.draft.set(emptyDraft());
    this.snapshot.set(emptyDraft());
  }

  async delete(): Promise<void> {
    const id = this.draft().id;
    if (id) {
      await this.plans.delete(id);
    }
    this.snapshot.set(this.draft());
  }
}
