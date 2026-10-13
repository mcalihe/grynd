import { inject, Injectable, signal } from '@angular/core';
import { ExerciseSetting } from '../db/models';
import { ExerciseSettingRepository } from '../db/repositories/exercise-setting.repository';
import { WeightUnit } from '../settings/settings.service';
import { WEIGHT_STEP } from '../units/weight';

type WeightSteps = Pick<ExerciseSetting, 'weightStepKg' | 'weightStepLb'>;

const COLUMN = { kg: 'weightStepKg', lb: 'weightStepLb' } as const satisfies Record<
  WeightUnit,
  keyof WeightSteps
>;

/**
 * The user's settings per exercise (weight step), shared by all plans and workouts
 * (decision 0022). Loaded once and kept in memory; changes write through to SQLite right away.
 */
@Injectable({ providedIn: 'root' })
export class ExerciseSettingsService {
  private readonly repo = inject(ExerciseSettingRepository);
  private readonly state = signal<ReadonlyMap<string, WeightSteps>>(new Map());
  private loading?: Promise<void>;

  load(): Promise<void> {
    this.loading ??= this.fetch();
    return this.loading;
  }

  /** Reads the settings again, e.g. after a backup replaced them. */
  reload(): Promise<void> {
    this.loading = this.fetch();
    return this.loading;
  }

  /** ± step of the weight stepper for an exercise in the given unit. Reactive. */
  weightStepFor(exerciseId: string, unit: WeightUnit): number {
    return this.state().get(exerciseId)?.[COLUMN[unit]] ?? WEIGHT_STEP;
  }

  /**
   * Sets the weight step of an exercise for one unit; the other unit keeps its own. The default
   * step is stored as null, and a row without any setting left is deleted.
   */
  async setWeightStep(exerciseId: string, unit: WeightUnit, step: number): Promise<void> {
    if (!(step > 0)) {
      return;
    }
    await this.load();
    const existing = await this.repo.findByExercise(exerciseId);
    const steps: WeightSteps = {
      weightStepKg: existing?.weightStepKg ?? null,
      weightStepLb: existing?.weightStepLb ?? null,
      [COLUMN[unit]]: step === WEIGHT_STEP ? null : step,
    };
    const empty = steps.weightStepKg === null && steps.weightStepLb === null;
    if (!existing) {
      if (empty) {
        return;
      }
      await this.repo.insert({ exerciseId, ...steps });
    } else if (empty) {
      await this.repo.softDelete(existing.id);
    } else if (
      existing.weightStepKg !== steps.weightStepKg ||
      existing.weightStepLb !== steps.weightStepLb
    ) {
      await this.repo.update(existing.id, steps);
    }
    this.state.update((settings) => {
      const next = new Map(settings);
      if (empty) {
        next.delete(exerciseId);
      } else {
        next.set(exerciseId, steps);
      }
      return next;
    });
  }

  private async fetch(): Promise<void> {
    const rows = await this.repo.findAll();
    this.state.set(
      new Map(
        rows.map(({ exerciseId, weightStepKg, weightStepLb }) => [
          exerciseId,
          { weightStepKg, weightStepLb },
        ]),
      ),
    );
  }
}
