import { inject, Injectable } from '@angular/core';
import { DatabaseService } from '../db/database.service';
import { ExerciseNoteImageRepository } from '../db/repositories/exercise-note-image.repository';
import { ExerciseNoteRepository } from '../db/repositories/exercise-note.repository';
import { ExerciseSettingRepository } from '../db/repositories/exercise-setting.repository';
import { PlanRepository } from '../db/repositories/plan.repository';
import { ExerciseNotesService } from '../exercises/exercise-notes.service';
import { ExerciseSettingsService } from '../exercises/exercise-settings.service';
import { NoteImageStore } from '../exercises/note-image-store';
import { PlansService } from '../plans/plans.service';
import { WEIGHT_STEP } from '../units/weight';
import { Clock } from '../utils/time';
import { uuid7 } from '../utils/uuid7';
import {
  buildPlanShare,
  PlanShare,
  SharedNote,
  SharedWeightStep,
  uniquePlanName,
} from './plan-share';

/** Extras the sender adds to a shared plan. */
export interface PlanShareOptions {
  notes: boolean;
  /** Only with notes. */
  photos: boolean;
  weightSteps: boolean;
}

/** What importing a shared plan did, for the toast. */
export interface PlanImportResult {
  /** Names of the new plans, after making them unique. */
  names: string[];
  notesAdded: number;
  /** Notes left out because the exercise already has one here. */
  notesKept: number;
  weightStepsAdded: number;
}

/** Sharing plans as templates and adding shared plans (decision 0024). */
@Injectable({ providedIn: 'root' })
export class PlanShareService {
  private readonly database = inject(DatabaseService);
  private readonly plans = inject(PlansService);
  private readonly planRepo = inject(PlanRepository);
  private readonly notes = inject(ExerciseNotesService);
  private readonly noteRepo = inject(ExerciseNoteRepository);
  private readonly imageRepo = inject(ExerciseNoteImageRepository);
  private readonly imageFiles = inject(NoteImageStore);
  private readonly settings = inject(ExerciseSettingsService);
  private readonly settingRepo = inject(ExerciseSettingRepository);
  private readonly clock = inject(Clock);

  /** The plans as templates, with the chosen extras; plans that are gone are left out. */
  async create(planIds: readonly string[], options: PlanShareOptions): Promise<PlanShare> {
    const drafts = (await Promise.all(planIds.map((id) => this.plans.getDraft(id)))).filter(
      (draft) => draft !== undefined,
    );
    const exerciseIds = [
      ...new Set(drafts.flatMap((draft) => draft.exercises.map((e) => e.exerciseId))),
    ];
    const notes: SharedNote[] = [];
    const weightSteps: SharedWeightStep[] = [];
    if (options.notes) {
      await this.notes.load();
      for (const exerciseId of exerciseIds) {
        const text = this.notes.noteFor(exerciseId);
        const images = options.photos ? await this.photos(exerciseId) : [];
        if (text || images.length) {
          notes.push({ exerciseId, text, images });
        }
      }
    }
    if (options.weightSteps) {
      for (const exerciseId of exerciseIds) {
        const setting = await this.settingRepo.findByExercise(exerciseId);
        if (setting && (setting.weightStepKg !== null || setting.weightStepLb !== null)) {
          weightSteps.push({ exerciseId, kg: setting.weightStepKg, lb: setting.weightStepLb });
        }
      }
    }
    return buildPlanShare(drafts, this.clock.nowUtc(), notes, weightSteps);
  }

  /**
   * Adds the shared plans as new plans, never changing existing ones. Notes only go to exercises
   * without a note here, weight steps only fill units without one: what the user set wins.
   */
  async import(share: PlanShare): Promise<PlanImportResult> {
    await this.notes.load();
    const result: PlanImportResult = {
      names: [],
      notesAdded: 0,
      notesKept: 0,
      weightStepsAdded: 0,
    };
    // Files cannot join the transaction: write them first and remove them if it fails.
    const written: string[] = [];
    try {
      await this.database.driver.transaction(async () => {
        const taken = (await this.planRepo.findAll()).map((plan) => plan.name);
        for (const plan of share.plans) {
          const name = uniquePlanName(plan.name, [...taken, ...result.names]);
          await this.plans.save({ name, weekdays: plan.weekdays, exercises: plan.exercises });
          result.names.push(name);
        }
        for (const note of share.notes) {
          if (this.notes.hasNote(note.exerciseId)) {
            result.notesKept++;
            continue;
          }
          if (note.text) {
            await this.noteRepo.insert({ exerciseId: note.exerciseId, text: note.text });
          }
          for (const file of note.images) {
            const id = uuid7();
            await this.imageFiles.write(id, file);
            written.push(id);
            await this.imageRepo.insert({ id, exerciseId: note.exerciseId });
          }
          result.notesAdded++;
        }
        for (const step of share.weightSteps) {
          result.weightStepsAdded += (await this.fillWeightStep(step)) ? 1 : 0;
        }
      });
    } catch (error) {
      for (const id of written) {
        await this.imageFiles.remove(id);
      }
      throw error;
    } finally {
      // Also after a rollback: saving a plan already refreshed the list.
      await Promise.all([this.plans.load(), this.notes.reload(), this.settings.reload()]);
    }
    return result;
  }

  /** Live photos of an exercise's note as base64; ones whose file is gone are left out. */
  private async photos(exerciseId: string): Promise<string[]> {
    const files: string[] = [];
    for (const image of this.notes.imagesFor(exerciseId)) {
      try {
        files.push(await this.imageFiles.read(image.id));
      } catch {
        // The app does not show it either.
      }
    }
    return files;
  }

  /** Sets the shared step for units without one here; true when something changed. */
  private async fillWeightStep(step: SharedWeightStep): Promise<boolean> {
    const own = (value: number | null) => (value === WEIGHT_STEP ? null : value);
    const existing = await this.settingRepo.findByExercise(step.exerciseId);
    const weightStepKg = existing?.weightStepKg ?? own(step.kg);
    const weightStepLb = existing?.weightStepLb ?? own(step.lb);
    if (
      weightStepKg === (existing?.weightStepKg ?? null) &&
      weightStepLb === (existing?.weightStepLb ?? null)
    ) {
      return false;
    }
    if (existing) {
      await this.settingRepo.update(existing.id, { weightStepKg, weightStepLb });
    } else {
      await this.settingRepo.insert({ exerciseId: step.exerciseId, weightStepKg, weightStepLb });
    }
    return true;
  }
}
