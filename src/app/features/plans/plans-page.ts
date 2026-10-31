import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon } from '@ng-icons/core';
import { HlmButton } from '@spartan-ng/helm/button';
import { Exercise } from '../../core/db/models';
import { SessionExerciseRepository } from '../../core/db/repositories/workout.repository';
import { activityProfile, CARDIO_CATEGORY, isCardio } from '../../core/energy/activities';
import { ExerciseCatalogService } from '../../core/exercises/exercise-catalog.service';
import { PlansService } from '../../core/plans/plans.service';
import { WorkoutLauncher } from '../../core/workout/workout-launcher.service';
import { WorkoutService } from '../../core/workout/workout.service';
import {
  CardioStartItem,
  CardioStartSheet,
} from '../../shared/components/cardio-start-sheet/cardio-start-sheet';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { PlanCard } from '../../shared/components/plan-card/plan-card';

/**
 * Plan list (Figma Pläne 37:27416, empty state 84:3262). No primary button on this screen.
 * «Ausdauer starten» starts a cardio workout without a plan (decision 0024).
 */
@Component({
  selector: 'app-plans-page',
  imports: [PageHeader, PlanCard, CardioStartSheet, HlmButton, NgIcon, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-1 flex-col' },
  template: `
    <app-page-header [title]="'plans.title' | transloco" />

    @if (plans(); as plans) {
      @if (plans.length === 0) {
        <section class="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
          <span class="flex size-14 items-center justify-center rounded-md bg-muted">
            <ng-icon name="lucideClipboardList" size="24" />
          </span>
          <h2 class="text-xl font-semibold">{{ 'plans.empty.title' | transloco }}</h2>
          <p class="w-64 text-sm text-muted-foreground">{{ 'plans.empty.text' | transloco }}</p>
          <div class="mt-2 flex flex-col gap-2">
            <button hlmBtn variant="secondary" (click)="create()">
              <ng-icon name="lucidePlus" />{{ 'plans.new' | transloco }}
            </button>
            <button hlmBtn variant="ghost" data-action="start-cardio" (click)="openCardio()">
              <ng-icon name="lucideActivity" />{{ 'cardioStart.action' | transloco }}
            </button>
          </div>
        </section>
      } @else {
        <div class="flex flex-col gap-4 px-4 pb-4">
          @if (today().length) {
            <section class="flex flex-col gap-2">
              <h2 class="text-xs text-muted-foreground uppercase">
                {{ 'plans.today' | transloco }}
              </h2>
              @for (item of today(); track item.plan.id) {
                <app-plan-card
                  [name]="item.plan.name"
                  [exerciseCount]="item.exerciseCount"
                  [weekdays]="item.plan.weekdays"
                  [today]="true"
                  (open)="open(item.plan.id)"
                />
              }
            </section>
          }

          <section class="flex flex-col gap-2">
            <h2 class="text-xl font-semibold">{{ 'plans.mine' | transloco }}</h2>
            @for (item of plans; track item.plan.id) {
              <app-plan-card
                [name]="item.plan.name"
                [exerciseCount]="item.exerciseCount"
                [weekdays]="item.plan.weekdays"
                [today]="todayIds().has(item.plan.id)"
                (open)="open(item.plan.id)"
              />
            }
            <div class="mt-2 grid grid-cols-2 gap-2">
              <button hlmBtn variant="secondary" (click)="create()">
                <ng-icon name="lucidePlus" />{{ 'plans.new' | transloco }}
              </button>
              <button hlmBtn variant="secondary" data-action="start-cardio" (click)="openCardio()">
                <ng-icon name="lucideActivity" />{{ 'cardioStart.action' | transloco }}
              </button>
            </div>
          </section>
        </div>
      }
    }

    <app-cardio-start-sheet
      [(open)]="cardioOpen"
      [items]="cardioItems()"
      [recent]="recentCardio()"
      (pick)="startCardio($event)"
    />
  `,
})
export class PlansPage implements OnInit {
  private readonly service = inject(PlansService);
  private readonly router = inject(Router);
  private readonly catalog = inject(ExerciseCatalogService);
  private readonly sessionExercises = inject(SessionExerciseRepository);
  private readonly workout = inject(WorkoutService);
  private readonly launcher = inject(WorkoutLauncher);
  private readonly transloco = inject(TranslocoService);

  protected readonly plans = this.service.plans;
  protected readonly today = this.service.todayPlans;
  protected readonly todayIds = computed(() => new Set(this.today().map((p) => p.plan.id)));

  /** «Ausdauer starten» (decision 0024): every cardio activity of the catalog, A–Z. */
  protected readonly cardioOpen = signal(false);
  private readonly recentCardioIds = signal<string[]>([]);
  protected readonly cardioItems = computed<CardioStartItem[]>(() =>
    (this.catalog.exercises() ?? [])
      .filter((exercise) => isCardio(exercise))
      .map((exercise) => this.cardioItem(exercise))
      .sort((a, b) => a.name.localeCompare(b.name, this.transloco.getActiveLang())),
  );
  protected readonly recentCardio = computed(() => {
    const byId = this.catalog.byId();
    return this.recentCardioIds()
      .map((id) => byId.get(id))
      .filter((exercise) => isCardio(exercise))
      .map((exercise) => this.cardioItem(exercise!));
  });

  ngOnInit(): void {
    void this.service.load();
  }

  protected async openCardio(): Promise<void> {
    await this.catalog.load();
    this.recentCardioIds.set(await this.sessionExercises.findRecentExerciseIds(3, CARDIO_CATEGORY));
    this.cardioOpen.set(true);
  }

  protected startCardio(exerciseId: string): Promise<void> {
    return this.launcher.launch(() => this.workout.startCardio(exerciseId));
  }

  private cardioItem(exercise: Exercise): CardioStartItem {
    return {
      id: exercise.id,
      name: this.catalog.name(exercise),
      icon: activityProfile(exercise.key).icon,
    };
  }

  protected open(id: string): void {
    void this.router.navigate(['/plans', id]);
  }

  protected create(): void {
    void this.router.navigate(['/plans', 'new']);
  }
}
