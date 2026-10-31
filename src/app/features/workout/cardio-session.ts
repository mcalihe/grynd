import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon } from '@ng-icons/core';
import { HlmButton } from '@spartan-ng/helm/button';
import { activityProfile } from '../../core/energy/activities';
import { ExerciseCatalogService } from '../../core/exercises/exercise-catalog.service';
import { SettingsService } from '../../core/settings/settings.service';
import {
  DISTANCE_DECIMALS,
  DISTANCE_STEP,
  displayToMeters,
  formatTempo,
  metersToDisplay,
  tempo,
} from '../../core/units/distance';
import { EntryValues, WorkoutExercise, WorkoutService } from '../../core/workout/workout.service';
import { NumberStepper } from '../../shared/components/number-stepper/number-stepper';
import { formatElapsed } from '../../shared/components/workout-clock/format-elapsed';

/**
 * Body of a cardio workout without a plan (decision 0025, code only): the activity, a big clock
 * (the workout time without pauses, which becomes the entry's duration), the live tempo once a
 * distance is entered, and the fields of the activity. Unlike decision 0023 the fields stay
 * editable while paused, since device values are read after stopping.
 */
@Component({
  selector: 'app-cardio-session',
  imports: [NumberStepper, HlmButton, NgIcon, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-6 overflow-y-auto px-4 pt-4 pb-6' },
  template: `
    <section class="flex flex-col items-center gap-2 pt-4 text-center">
      <span
        class="flex size-14 items-center justify-center rounded-full bg-secondary text-secondary-foreground"
        aria-hidden="true"
      >
        <ng-icon [name]="profile().icon" size="28" />
      </span>
      <p class="text-sm font-medium text-muted-foreground">
        {{ (paused() ? 'workout.paused.title' : 'workout.cardioSession.running') | transloco }}
      </p>
      <p class="text-6xl font-semibold tabular-nums" data-clock>{{ elapsedText() }}</p>
      @if (tempoText(); as text) {
        <p class="text-sm text-muted-foreground tabular-nums" data-tempo>{{ text }}</p>
      }
    </section>

    <section class="grid grid-cols-2 gap-2">
      @if (profile().distance) {
        <app-number-stepper
          data-field="distance"
          [stretch]="true"
          [label]="'workout.cardio.' + distanceUnit() | transloco"
          [value]="displayDistance()"
          [stepSize]="distanceStep"
          [decimals]="distanceDecimals"
          [max]="999"
          (valueChange)="update({ distanceM: toMeters($event) })"
        />
      }
      @if (profile().level) {
        <app-number-stepper
          data-field="level"
          [stretch]="true"
          [label]="'workout.cardio.level' | transloco"
          [value]="entry()?.level ?? null"
          [decimals]="1"
          [max]="99"
          [origin]="5"
          (valueChange)="update({ level: $event })"
        />
      }
      <app-number-stepper
        data-field="kcal"
        [stretch]="true"
        [label]="'workout.cardio.kcal' | transloco"
        [value]="entry()?.kcal ?? null"
        [stepSize]="10"
        [max]="9999"
        [origin]="100"
        (valueChange)="update({ kcal: $event })"
      />
      <app-number-stepper
        data-field="heartRate"
        [stretch]="true"
        [label]="'workout.cardio.heartRate' | transloco"
        [value]="entry()?.heartRate ?? null"
        [min]="30"
        [max]="240"
        [origin]="120"
        (valueChange)="update({ heartRate: $event })"
      />
    </section>

    <p class="text-center text-xs text-muted-foreground">
      {{ 'workout.cardioSession.hint' | transloco }}
    </p>

    @if (paused()) {
      <button hlmBtn variant="secondary" class="self-center" (click)="leave.emit()">
        <ng-icon name="lucideClipboardList" />{{ 'workout.paused.leave' | transloco }}
      </button>
    }
  `,
})
export class CardioSession {
  readonly item = input.required<WorkoutExercise>();
  /** Workout time without pauses. */
  readonly elapsedMs = input(0);
  readonly paused = input(false);
  /** «Zu den Plänen» while paused. */
  readonly leave = output<void>();

  private readonly workout = inject(WorkoutService);
  private readonly catalog = inject(ExerciseCatalogService);
  private readonly settings = inject(SettingsService);
  private readonly locale = toSignal(inject(TranslocoService).langChanges$, {
    initialValue: 'de',
  });

  protected readonly distanceStep = DISTANCE_STEP;
  protected readonly distanceDecimals = DISTANCE_DECIMALS;
  protected readonly distanceUnit = computed(() => this.settings.settings().distanceUnit);
  protected readonly entry = computed(() => this.item().sets[0]);
  protected readonly profile = computed(() =>
    activityProfile(this.catalog.byId().get(this.item().entry.exerciseId)?.key ?? ''),
  );
  protected readonly elapsedText = computed(() => formatElapsed(this.elapsedMs()));
  protected readonly displayDistance = computed(() =>
    metersToDisplay(this.entry()?.distanceM ?? null, this.distanceUnit()),
  );
  protected readonly tempoText = computed(() => {
    const value = tempo(
      this.profile().tempo,
      Math.floor(this.elapsedMs() / 1000),
      this.entry()?.distanceM ?? null,
      this.distanceUnit(),
    );
    return value ? formatTempo(value, this.distanceUnit(), this.locale()) : null;
  });

  protected toMeters(value: number | null): number | null {
    return displayToMeters(value, this.distanceUnit());
  }

  protected update(patch: Partial<EntryValues>): void {
    const entry = this.entry();
    if (entry) {
      void this.workout.updateSet(entry.id, patch);
    }
  }
}
