import { CdkDrag, CdkDragDrop, CdkDropList } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon } from '@ng-icons/core';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmDropdownMenuImports } from '@spartan-ng/helm/dropdown-menu';
import { HlmInput } from '@spartan-ng/helm/input';
import { isCardio } from '../../core/energy/activities';
import { ExerciseCatalogService } from '../../core/exercises/exercise-catalog.service';
import { DraftExercise } from '../../core/plans/plan-draft';
import { ExerciseNotesService } from '../../core/exercises/exercise-notes.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { HapticsService } from '../../core/services/haptics.service';
import { NumberStepper } from '../../shared/components/number-stepper/number-stepper';
import { DURATION_FORMAT } from '../../shared/components/number-stepper/number-stepper.logic';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { StickyAction } from '../../shared/components/sticky-action/sticky-action';
import { WeekdayChips } from '../../shared/components/weekday-chips/weekday-chips';
import { PlanCopy, PlanEditorStore } from './plan-editor.store';
import { cardioSummary, PlanExerciseRow, targetSummary } from './plan-exercise-row';

/**
 * Create or edit a plan (Figma Plan bearbeiten 37:28096, Plan erstellen 63:12060 / 63:12408).
 * No cancel button: leave with the back arrow; the unsaved-changes guard asks when needed.
 */
@Component({
  selector: 'app-plan-editor-page',
  imports: [
    PageHeader,
    StickyAction,
    WeekdayChips,
    PlanExerciseRow,
    NumberStepper,
    CdkDropList,
    CdkDrag,
    HlmButton,
    HlmInput,
    HlmDropdownMenuImports,
    NgIcon,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-1 flex-col' },
  template: `
    <app-page-header variant="bar" (back)="back()">
      @if (!store.isNew()) {
        <ng-container headerAction>
          <button
            hlmBtn
            variant="ghost"
            size="icon"
            [hlmDropdownMenuTrigger]="planMenu"
            align="end"
            [attr.aria-label]="'plans.menu' | transloco"
          >
            <ng-icon name="lucideEllipsis" />
          </button>
          <ng-template #planMenu>
            <hlm-dropdown-menu class="w-56">
              <button hlmDropdownMenuItem (click)="duplicate()">
                {{ 'plans.duplicate.action' | transloco }}
              </button>
              <button hlmDropdownMenuItem variant="destructive" (click)="delete()">
                {{ 'plans.delete.action' | transloco }}
              </button>
            </hlm-dropdown-menu>
          </ng-template>
        </ng-container>
      }
    </app-page-header>

    @if (store.loaded()) {
      <div class="flex flex-1 flex-col gap-4 px-4 pb-4">
        <h1 class="text-display font-semibold">
          {{ (store.isNew() ? 'plans.new' : 'plans.edit') | transloco }}
        </h1>

        <label class="flex flex-col gap-2">
          <span class="text-sm font-medium text-muted-foreground">{{
            'plans.name' | transloco
          }}</span>
          <span class="relative">
            <ng-icon
              name="lucideDumbbell"
              size="20"
              class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
            />
            <input
              hlmInput
              class="pl-11"
              autocomplete="off"
              enterkeyhint="done"
              maxlength="60"
              [placeholder]="'plans.namePlaceholder' | transloco"
              [value]="store.draft().name"
              (input)="store.setName($any($event.target).value)"
            />
          </span>
        </label>

        <section class="flex flex-col gap-2">
          <h2 class="text-sm font-medium text-muted-foreground">
            {{ 'plans.weekdays' | transloco }}
          </h2>
          <app-weekday-chips
            [value]="store.draft().weekdays"
            (valueChange)="store.setWeekdays($event)"
          />
        </section>

        <section class="flex flex-1 flex-col gap-2">
          <h2 class="text-sm font-medium text-muted-foreground">{{ 'plans.order' | transloco }}</h2>

          @if (store.draft().exercises.length === 0) {
            <div class="flex flex-1 flex-col items-center justify-center gap-3 py-8">
              <span class="flex size-14 items-center justify-center rounded-full bg-muted">
                <ng-icon name="lucideDumbbell" size="24" />
              </span>
              <p class="text-sm font-semibold">{{ 'plans.noExercises' | transloco }}</p>
              <button hlmBtn variant="secondary" (click)="addExercises()">
                <ng-icon name="lucidePlus" />{{ 'plans.addExercise' | transloco }}
              </button>
            </div>
          } @else {
            <div
              cdkDropList
              cdkDropListLockAxis="y"
              class="flex flex-col gap-2"
              (cdkDropListSorted)="haptics.tick()"
              (cdkDropListDropped)="drop($event)"
            >
              @for (
                exercise of store.draft().exercises;
                track exercise.exerciseId;
                let i = $index
              ) {
                <app-plan-exercise-row
                  cdkDrag
                  [draggable]="true"
                  (cdkDragStarted)="haptics.selectionStart()"
                  [name]="catalog.nameById(exercise.exerciseId)"
                  [summary]="summary(exercise)"
                  [hasNote]="notes.hasNote(exercise.exerciseId)"
                >
                  <div class="flex flex-col gap-3">
                    @if (isCardio(exercise.exerciseId)) {
                      <div class="grid grid-cols-2 gap-2">
                        <app-number-stepper
                          [stretch]="true"
                          [label]="'plans.targets.duration' | transloco"
                          [value]="exercise.targetDurationSec"
                          [format]="durationFormat"
                          [stepSize]="60"
                          [max]="86399"
                          [origin]="600"
                          (valueChange)="store.update(i, { targetDurationSec: $event || null })"
                        />
                        <app-number-stepper
                          [stretch]="true"
                          [label]="'plans.targets.entries' | transloco"
                          [value]="exercise.targetSets"
                          [min]="1"
                          [max]="20"
                          (valueChange)="store.update(i, { targetSets: $event ?? 1 })"
                        />
                      </div>
                    } @else {
                      <div class="grid grid-cols-2 gap-2">
                        <app-number-stepper
                          [stretch]="true"
                          [label]="'plans.targets.sets' | transloco"
                          [value]="exercise.targetSets"
                          [min]="1"
                          [max]="20"
                          (valueChange)="store.update(i, { targetSets: $event ?? 1 })"
                        />
                        <app-number-stepper
                          [stretch]="true"
                          [label]="'plans.targets.rest' | transloco"
                          [value]="exercise.restSeconds"
                          [stepSize]="15"
                          [max]="600"
                          (valueChange)="store.update(i, { restSeconds: $event ?? 0 })"
                        />
                        <app-number-stepper
                          [stretch]="true"
                          [label]="'plans.targets.repMin' | transloco"
                          [value]="exercise.repMin"
                          [min]="1"
                          [max]="100"
                          (valueChange)="store.update(i, { repMin: $event ?? 1 })"
                        />
                        <app-number-stepper
                          [stretch]="true"
                          [label]="'plans.targets.repMax' | transloco"
                          [value]="exercise.repMax"
                          [min]="1"
                          [max]="100"
                          (valueChange)="store.update(i, { repMax: $event ?? 1 })"
                        />
                      </div>
                    }
                    <button
                      hlmBtn
                      variant="ghost"
                      size="sm"
                      class="self-start text-destructive"
                      (click)="store.remove(i)"
                    >
                      {{ 'plans.removeExercise' | transloco }}
                    </button>
                  </div>
                </app-plan-exercise-row>
              }
            </div>
            <button hlmBtn variant="ghost" class="self-center" (click)="addExercises()">
              <ng-icon name="lucidePlus" />{{ 'plans.addExercise' | transloco }}
            </button>
          }
        </section>
      </div>

      <app-sticky-action>
        <button hlmBtn size="lg" [disabled]="!store.valid() || saving" (click)="save()">
          <ng-icon name="lucideCheck" />{{
            (store.isNew() ? 'plans.saveNew' : 'common.save') | transloco
          }}
        </button>
      </app-sticky-action>
    }
  `,
})
export class PlanEditorPage implements OnInit {
  protected readonly store = inject(PlanEditorStore);
  protected readonly catalog = inject(ExerciseCatalogService);
  protected readonly notes = inject(ExerciseNotesService);
  protected readonly haptics = inject(HapticsService);
  private readonly confirm = inject(ConfirmService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly transloco = inject(TranslocoService);
  /** Emits once the translation file is loaded and on every language change. */
  private readonly translation = toSignal(this.transloco.selectTranslation());

  protected readonly durationFormat = DURATION_FORMAT;
  protected saving = false;

  protected isCardio(exerciseId: string): boolean {
    return isCardio(this.catalog.byId().get(exerciseId));
  }

  /** "3 × 8–12", or "10 Min." for cardio (decision 0024). */
  protected summary(exercise: DraftExercise): string {
    this.translation();
    return this.isCardio(exercise.exerciseId)
      ? cardioSummary(
          (key, params) => this.transloco.translate(key, params),
          exercise.targetSets,
          exercise.targetDurationSec,
        )
      : targetSummary(exercise.targetSets, exercise.repMin, exercise.repMax);
  }

  /** The :id lives on the parent route (…/:id/edit); /plans/new has none. */
  private get planId(): string | null {
    return this.route.parent?.snapshot.paramMap.get('id') ?? null;
  }

  /** /plans/new?copyOf=<id> starts the new plan as a copy of that plan. */
  private get copyOf(): string | null {
    return this.planId ? null : this.route.snapshot.queryParamMap.get('copyOf');
  }

  async ngOnInit(): Promise<void> {
    const [found] = await Promise.all([
      this.store.init(this.planId, this.copyOf ? this.copyRequest(this.copyOf) : undefined),
      this.catalog.load(),
      this.notes.load(),
    ]);
    if (!found) {
      await this.router.navigate(['/plans'], { replaceUrl: true });
    }
  }

  protected drop(event: CdkDragDrop<unknown>): void {
    this.haptics.selectionEnd();
    this.store.move(event.previousIndex, event.currentIndex);
  }

  protected addExercises(): void {
    void this.router.navigate(['add-exercises'], { relativeTo: this.route });
  }

  protected back(): void {
    const id = this.planId ?? this.copyOf;
    void this.router.navigate(id ? ['/plans', id] : ['/plans']);
  }

  /** Opens a new plan prefilled with the saved state of this one; the guard asks first. */
  protected duplicate(): void {
    void this.router.navigate(['/plans/new'], { queryParams: { copyOf: this.planId } });
  }

  private copyRequest(planId: string): PlanCopy {
    return {
      planId,
      name: (name) => this.transloco.translate('plans.duplicate.name', { name }),
    };
  }

  protected async save(): Promise<void> {
    this.saving = true;
    try {
      const id = await this.store.save();
      await this.router.navigate(['/plans', id], { replaceUrl: true });
    } finally {
      this.saving = false;
    }
  }

  protected async delete(): Promise<void> {
    const confirmed = await this.confirm.confirm({
      title: 'plans.delete.title',
      message: 'plans.delete.text',
      confirm: 'plans.delete.confirm',
      cancel: 'common.cancel',
      destructive: true,
    });
    if (confirmed) {
      await this.store.delete();
      await this.router.navigate(['/plans'], { replaceUrl: true });
    }
  }
}
