import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon } from '@ng-icons/core';
import { HlmBadge } from '@spartan-ng/helm/badge';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmInput } from '@spartan-ng/helm/input';
import { Exercise, MuscleGroup } from '../../core/db/models';
import { SessionExerciseRepository } from '../../core/db/repositories/workout.repository';
import { ExerciseCatalogService } from '../../core/exercises/exercise-catalog.service';
import {
  EQUIPMENT,
  EQUIPMENT_FILTERS,
  EquipmentFilter,
  filterExercises,
  ForceFilter,
  FORCES,
  isFilterActive,
  MUSCLE_GROUPS,
  normalize,
  toggle,
} from '../../core/exercises/exercise-search';
import { ConfirmService } from '../../core/services/confirm.service';
import { StickyAction } from '../../shared/components/sticky-action/sticky-action';
import { PlanEditorStore } from './plan-editor.store';

interface ListEntry {
  letter?: string;
  exercise?: Exercise;
}

/** Equipment chip for a catalog equipment value (for the meta line). */
function equipmentChip(value: string | null): EquipmentFilter | null {
  return (EQUIPMENT.find((e) =>
    (EQUIPMENT_FILTERS[e] as readonly string[]).includes(value ?? ''),
  ) ?? null) as EquipmentFilter | null;
}

/**
 * «Übungen hinzufügen» (Figma 63:12824, 63:13440, 63:14032): search, chip filters, recently used,
 * alphabetical list with thumbnails, multi-select. Exercises already in the plan are dimmed.
 */
@Component({
  selector: 'app-exercise-picker-page',
  imports: [StickyAction, HlmButton, HlmInput, HlmBadge, NgIcon, TranslocoPipe, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-1 flex-col' },
  template: `
    <header class="flex h-13 shrink-0 items-center gap-2 px-4">
      <button
        hlmBtn
        variant="ghost"
        size="sm"
        [attr.aria-label]="'common.close' | transloco"
        (click)="close()"
      >
        <ng-icon name="lucideX" />
      </button>
      <h1 class="text-xl font-semibold">{{ 'plans.addExercises' | transloco }}</h1>
    </header>

    <div class="flex flex-1 flex-col gap-4 px-4 pb-4">
      <label class="relative block">
        <ng-icon
          name="lucideSearch"
          size="20"
          class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
        />
        <input
          hlmInput
          type="search"
          class="pl-11"
          autocomplete="off"
          enterkeyhint="search"
          [attr.aria-label]="'picker.search' | transloco"
          [placeholder]="'picker.search' | transloco"
          [value]="query()"
          (input)="query.set($any($event.target).value)"
        />
      </label>

      <section class="flex flex-col gap-2">
        <div class="flex flex-col gap-1">
          <h2 class="text-xs text-muted-foreground">{{ 'picker.muscleGroup' | transloco }}</h2>
          <div class="-mx-4 flex [scrollbar-width:none] gap-2 overflow-x-auto px-4">
            @for (muscle of muscleGroups; track muscle) {
              <button
                type="button"
                [class]="chipClass(muscles().includes(muscle))"
                [attr.aria-pressed]="muscles().includes(muscle)"
                (click)="muscles.set(toggle(muscles(), muscle))"
              >
                {{ 'muscles.' + muscle | transloco }}
              </button>
            }
          </div>
        </div>
        <div class="flex flex-col gap-1">
          <h2 class="text-xs text-muted-foreground">{{ 'picker.movement' | transloco }}</h2>
          <div class="flex gap-2">
            @for (force of forceValues; track force) {
              <button
                type="button"
                [class]="chipClass(forces().includes(force))"
                [attr.aria-pressed]="forces().includes(force)"
                (click)="forces.set(toggle(forces(), force))"
              >
                {{ 'forces.' + force | transloco }}
              </button>
            }
          </div>
        </div>
        <div class="flex flex-col gap-1">
          <h2 class="text-xs text-muted-foreground">{{ 'picker.equipment' | transloco }}</h2>
          <div class="-mx-4 flex [scrollbar-width:none] gap-2 overflow-x-auto px-4">
            @for (item of equipmentValues; track item) {
              <button
                type="button"
                [class]="chipClass(equipment().includes(item))"
                [attr.aria-pressed]="equipment().includes(item)"
                (click)="equipment.set(toggle(equipment(), item))"
              >
                {{ 'equipment.' + item | transloco }}
              </button>
            }
          </div>
        </div>
        @if (filterActive()) {
          <button hlmBtn variant="ghost" size="sm" class="self-start" (click)="resetFilters()">
            <ng-icon name="lucideX" />{{ 'picker.resetFilters' | transloco }}
          </button>
        }
      </section>

      @if (catalog.exercises() === null) {
        <!-- catalog loading -->
      } @else if (results().length === 0) {
        <div class="flex flex-1 flex-col items-center justify-center gap-3 py-8">
          <span class="flex size-14 items-center justify-center rounded-full bg-muted">
            <ng-icon name="lucideSearch" size="24" />
          </span>
          <p class="text-sm font-semibold">{{ 'picker.noResults' | transloco }}</p>
          <button hlmBtn variant="outline" (click)="resetFilters()">
            <ng-icon name="lucideX" />{{ 'picker.resetFilters' | transloco }}
          </button>
        </div>
      } @else {
        <section class="flex flex-col gap-1">
          @if (!filterActive() && recent().length) {
            <h2 class="text-sm font-medium text-muted-foreground">
              {{ 'picker.recent' | transloco }}
            </h2>
            @for (exercise of recent(); track exercise.id) {
              <ng-container *ngTemplateOutlet="row; context: { $implicit: exercise }" />
            }
          }
          @if (filterActive()) {
            <h2 class="text-sm font-medium text-muted-foreground">{{ summary() }}</h2>
          }
          @for (entry of list(); track entry.exercise?.id ?? entry.letter) {
            @if (entry.letter) {
              <h3 class="pt-2 text-sm font-semibold">{{ entry.letter }}</h3>
            } @else if (entry.exercise; as exercise) {
              <ng-container *ngTemplateOutlet="row; context: { $implicit: exercise }" />
            }
          }
        </section>
      }
    </div>

    <ng-template #row let-exercise>
      @let inPlan = store.exerciseIds().has(exercise.id);
      @let picked = selected().has(exercise.id);
      <button
        type="button"
        class="flex h-15 w-full items-center gap-3 text-left"
        [class.opacity-50]="inPlan"
        [disabled]="inPlan"
        [attr.aria-pressed]="inPlan ? null : picked"
        (click)="togglePick(exercise.id)"
      >
        <span
          class="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-secondary"
        >
          @if (exercise.images[0]; as image) {
            <img
              [src]="image"
              alt=""
              loading="lazy"
              decoding="async"
              class="size-full object-cover"
            />
          } @else {
            <ng-icon name="lucideDumbbell" size="24" />
          }
        </span>
        <span class="flex min-w-0 flex-1 flex-col gap-1">
          <span class="truncate text-sm font-semibold">{{ catalog.name(exercise) }}</span>
          <span class="truncate text-xs text-muted-foreground">{{ meta(exercise) }}</span>
        </span>
        @if (inPlan) {
          <span hlmBadge variant="secondary">{{ 'picker.inPlan' | transloco }}</span>
        } @else {
          <span class="flex size-11 shrink-0 items-center justify-center">
            <span
              class="flex size-6 items-center justify-center rounded-full border"
              [class]="
                picked ? 'border-primary bg-primary text-primary-foreground' : 'border-input'
              "
            >
              @if (picked) {
                <ng-icon name="lucideCheck" size="16" />
              }
            </span>
          </span>
        }
      </button>
    </ng-template>

    <app-sticky-action>
      <button hlmBtn size="lg" [disabled]="selected().size === 0" (click)="add()">
        <ng-icon name="lucidePlus" />
        @if (selected().size === 0) {
          {{ 'picker.choose' | transloco }}
        } @else {
          {{
            (selected().size === 1 ? 'picker.addOne' : 'picker.addMany')
              | transloco: { count: selected().size }
          }}
        }
      </button>
    </app-sticky-action>
  `,
})
export class ExercisePickerPage implements OnInit {
  protected readonly store = inject(PlanEditorStore);
  protected readonly catalog = inject(ExerciseCatalogService);
  private readonly sessionExercises = inject(SessionExerciseRepository);
  private readonly transloco = inject(TranslocoService);
  private readonly confirm = inject(ConfirmService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly muscleGroups = MUSCLE_GROUPS;
  protected readonly forceValues = FORCES;
  protected readonly equipmentValues = EQUIPMENT;
  protected readonly toggle = toggle;

  protected readonly query = signal('');
  protected readonly muscles = signal<MuscleGroup[]>([]);
  protected readonly forces = signal<ForceFilter[]>([]);
  protected readonly equipment = signal<EquipmentFilter[]>([]);
  protected readonly selected = signal<ReadonlySet<string>>(new Set());
  private readonly recentIds = signal<string[]>([]);

  private readonly filter = computed(() => ({
    query: this.query(),
    muscles: this.muscles(),
    forces: this.forces(),
    equipment: this.equipment(),
  }));
  protected readonly filterActive = computed(() => isFilterActive(this.filter()));

  /** Sorted by display name in the UI language. */
  private readonly sorted = computed(() => {
    const exercises = [...(this.catalog.exercises() ?? [])];
    return exercises.sort((a, b) =>
      this.catalog.name(a).localeCompare(this.catalog.name(b), this.transloco.getActiveLang()),
    );
  });
  protected readonly results = computed(() => filterExercises(this.sorted(), this.filter()));

  protected readonly recent = computed(() => {
    const byId = this.catalog.byId();
    return this.recentIds()
      .map((id) => byId.get(id))
      .filter((e): e is Exercise => !!e);
  });

  /** Results with letter headings when browsing the whole list. */
  protected readonly list = computed<ListEntry[]>(() => {
    const results = this.results();
    if (this.filterActive()) {
      return results.map((exercise) => ({ exercise }));
    }
    const entries: ListEntry[] = [];
    let letter = '';
    for (const exercise of results) {
      const first = normalize(this.catalog.name(exercise)).charAt(0).toUpperCase();
      const heading = /[A-Z]/.test(first) ? first : '#';
      if (heading !== letter) {
        letter = heading;
        entries.push({ letter });
      }
      entries.push({ exercise });
    }
    return entries;
  });

  protected readonly summary = computed(() => {
    const t = (key: string) => this.transloco.translate(key);
    const parts = [
      ...this.muscles().map((m) => t(`muscles.${m}`)),
      ...this.forces().map((f) => t(`forces.${f}`)),
      ...this.equipment().map((e) => t(`equipment.${e}`)),
    ];
    return parts.length ? parts.join(' · ') : t('picker.results');
  });

  async ngOnInit(): Promise<void> {
    // Also covers a reload or deep link straight into the picker: the draft must exist first.
    const planId = this.route.parent?.snapshot.paramMap.get('id') ?? null;
    const [found] = await Promise.all([this.store.init(planId), this.catalog.load()]);
    if (!found) {
      await this.router.navigate(['/plans'], { replaceUrl: true });
      return;
    }
    this.recentIds.set(await this.sessionExercises.findRecentExerciseIds(3));
  }

  protected chipClass(active: boolean): string {
    return `h-8 shrink-0 rounded-full px-2 text-sm font-medium ${
      active ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
    }`;
  }

  protected meta(exercise: Exercise): string {
    const parts: string[] = [];
    if (exercise.muscleGroup) {
      parts.push(this.transloco.translate(`muscles.${exercise.muscleGroup}`));
    }
    const chip = equipmentChip(exercise.equipment);
    if (chip) {
      parts.push(this.transloco.translate(`equipment.${chip}`));
    }
    return parts.join(' · ');
  }

  protected togglePick(id: string): void {
    const next = new Set(this.selected());
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    this.selected.set(next);
  }

  protected resetFilters(): void {
    this.query.set('');
    this.muscles.set([]);
    this.forces.set([]);
    this.equipment.set([]);
  }

  protected add(): void {
    this.store.add([...this.selected()]);
    this.selected.set(new Set());
    this.backToEditor();
  }

  protected async close(): Promise<void> {
    if (this.selected().size > 0) {
      const discard = await this.confirm.confirm({
        title: 'picker.discard.title',
        message: 'picker.discard.text',
        confirm: 'picker.discard.confirm',
        cancel: 'picker.discard.cancel',
        destructive: true,
      });
      if (!discard) {
        return;
      }
    }
    this.backToEditor();
  }

  private backToEditor(): void {
    void this.router.navigate(['..'], { relativeTo: this.route });
  }
}
