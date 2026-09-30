import { computed, inject, Injectable, signal } from '@angular/core';
import { DatabaseService } from '../db/database.service';
import { Plan } from '../db/models';
import { PlanExerciseRepository, PlanRepository } from '../db/repositories/plan.repository';
import { Clock } from '../utils/time';
import { PlanDraft } from './plan-draft';

export interface PlanSummary {
  plan: Plan;
  exerciseCount: number;
}

/** Plans for the list screens and the editor. State lives in signals; SQLite is the source. */
@Injectable({ providedIn: 'root' })
export class PlansService {
  private readonly database = inject(DatabaseService);
  private readonly plansRepo = inject(PlanRepository);
  private readonly planExercises = inject(PlanExerciseRepository);
  private readonly clock = inject(Clock);

  private readonly state = signal<PlanSummary[] | null>(null);
  /** Refreshed on every load, so "today" follows the date when the app stays open overnight. */
  private readonly today = signal(this.clock.now().getDay());

  /** null until the first load. */
  readonly plans = this.state.asReadonly();
  /** Plans scheduled for today's weekday (local time). */
  readonly todayPlans = computed(() => {
    const today = this.today();
    return (this.state() ?? []).filter((p) => p.plan.weekdays.includes(today));
  });

  async load(): Promise<void> {
    const [plans, counts] = await Promise.all([
      this.plansRepo.findAll('createdAt'),
      this.database.driver.query<{ planId: string; n: number }>(
        `SELECT planId, count(*) AS n FROM plan_exercise WHERE deletedAt IS NULL GROUP BY planId`,
      ),
    ]);
    const byPlan = new Map(counts.map((c) => [c.planId, c.n]));
    this.today.set(this.clock.now().getDay());
    this.state.set(plans.map((plan) => ({ plan, exerciseCount: byPlan.get(plan.id) ?? 0 })));
  }

  async getDraft(id: string): Promise<PlanDraft | undefined> {
    const plan = await this.plansRepo.findById(id);
    if (!plan) {
      return undefined;
    }
    const exercises = await this.planExercises.findByPlan(id);
    return {
      id: plan.id,
      name: plan.name,
      weekdays: plan.weekdays,
      exercises: exercises.map((pe) => ({
        planExerciseId: pe.id,
        exerciseId: pe.exerciseId,
        targetSets: pe.targetSets,
        repMin: pe.repMin,
        repMax: pe.repMax,
        restSeconds: pe.restSeconds,
      })),
    };
  }

  /** Saves plan and exercises in one transaction and returns the plan id. */
  async save(draft: PlanDraft): Promise<string> {
    const name = draft.name.trim();
    const weekdays = [...draft.weekdays];
    const id = await this.database.driver.transaction(async () => {
      const planId = draft.id
        ? (await this.plansRepo.update(draft.id, { name, weekdays })).id
        : (await this.plansRepo.insert({ name, weekdays })).id;

      const existing = draft.id ? await this.planExercises.findByPlan(planId) : [];
      const kept = new Set(draft.exercises.map((e) => e.planExerciseId).filter(Boolean));
      for (const row of existing.filter((pe) => !kept.has(pe.id))) {
        await this.planExercises.softDelete(row.id);
      }

      for (const [position, e] of draft.exercises.entries()) {
        const values = {
          position,
          targetSets: e.targetSets,
          repMin: e.repMin,
          repMax: e.repMax,
          restSeconds: e.restSeconds,
        };
        if (e.planExerciseId) {
          await this.planExercises.update(e.planExerciseId, values);
        } else {
          await this.planExercises.insert({ planId, exerciseId: e.exerciseId, ...values });
        }
      }
      return planId;
    });
    await this.load();
    return id;
  }

  /** Soft-deletes the plan and its exercises; past sessions keep their data. */
  async delete(id: string): Promise<void> {
    await this.database.driver.transaction(async () => {
      for (const pe of await this.planExercises.findByPlan(id)) {
        await this.planExercises.softDelete(pe.id);
      }
      await this.plansRepo.softDelete(id);
    });
    await this.load();
  }
}
