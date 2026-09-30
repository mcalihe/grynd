import { ChangeDetectionStrategy, Component, computed, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon } from '@ng-icons/core';
import { HlmButton } from '@spartan-ng/helm/button';
import { PlansService } from '../../core/plans/plans.service';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { PlanCard } from '../../shared/components/plan-card/plan-card';

/** Plan list (Figma Pläne 37:27416, empty state 84:3262). No primary button on this screen. */
@Component({
  selector: 'app-plans-page',
  imports: [PageHeader, PlanCard, HlmButton, NgIcon, TranslocoPipe],
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
          <button hlmBtn variant="secondary" class="mt-2" (click)="create()">
            <ng-icon name="lucidePlus" />{{ 'plans.new' | transloco }}
          </button>
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
            <button hlmBtn variant="secondary" class="mt-2 w-full" (click)="create()">
              <ng-icon name="lucidePlus" />{{ 'plans.new' | transloco }}
            </button>
          </section>
        </div>
      }
    }
  `,
})
export class PlansPage implements OnInit {
  private readonly service = inject(PlansService);
  private readonly router = inject(Router);

  protected readonly plans = this.service.plans;
  protected readonly today = this.service.todayPlans;
  protected readonly todayIds = computed(() => new Set(this.today().map((p) => p.plan.id)));

  ngOnInit(): void {
    void this.service.load();
  }

  protected open(id: string): void {
    void this.router.navigate(['/plans', id]);
  }

  protected create(): void {
    void this.router.navigate(['/plans', 'new']);
  }
}
