import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  model,
  output,
  viewChild,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon } from '@ng-icons/core';
import { HapticsService } from '../../../core/services/haptics.service';
import {
  DISTANCE_DECIMALS,
  DISTANCE_STEP,
  DistanceUnit,
  displayToMeters,
  metersToDisplay,
} from '../../../core/units/distance';
import { CelebrationService } from '../../motion/celebration.service';
import { NumberStepper } from '../number-stepper/number-stepper';
import { DURATION_FORMAT } from '../number-stepper/number-stepper.logic';
import { celebrateCheck } from '../set-row/check-celebration';
import { LongPress } from '../set-row/long-press';

export type CardioRowState = 'open' | 'completed' | 'menu-open';

/** Which inputs an activity shows besides duration, calories and heart rate (decision 0025). */
export interface CardioFields {
  distance: boolean;
  level: boolean;
}

/** Longest entry: 23:59:59. */
const MAX_DURATION_SEC = 86_399;

/**
 * One cardio entry in a workout (decision 0025, code only): number, duration (m:ss) and distance,
 * check; below level, calories from the device and average heart rate. Behaves like the set row:
 * long-press, right-click or a tap on the number opens the menu, checking celebrates.
 * `distance` is always metres; `distanceUnit` only changes what is shown and typed.
 */
@Component({
  selector: 'app-cardio-row',
  imports: [NumberStepper, NgIcon, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  hostDirectives: [LongPress],
  host: { class: 'block' },
  template: `
    @if (extra()) {
      <span class="mb-1 block text-xs text-muted-foreground">{{
        'workout.set.extra' | transloco
      }}</span>
    }
    <div
      class="relative flex flex-col gap-1 rounded-lg border bg-card p-1"
      [class.border-2]="state() === 'menu-open'"
      [class.border-primary]="state() === 'menu-open'"
      [attr.data-state]="state()"
    >
      <span
        class="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]"
        aria-hidden="true"
      >
        <span
          #sweep
          class="absolute inset-0 bg-linear-to-r from-transparent via-primary/30 to-transparent opacity-0"
        ></span>
      </span>

      <div class="flex h-14 items-center gap-[3px]">
        <button
          type="button"
          class="relative flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs after:absolute after:-inset-y-3 after:right-0 after:-left-1"
          aria-haspopup="menu"
          [attr.aria-expanded]="state() === 'menu-open'"
          [attr.aria-label]="'workout.cardio.menu' | transloco: { number: number() }"
          (click)="menu.emit()"
        >
          {{ number() }}
        </button>

        <app-number-stepper
          data-field="duration"
          [label]="'workout.cardio.duration' | transloco"
          [(value)]="duration"
          [format]="durationFormat"
          [stepSize]="60"
          [max]="maxDuration"
          [origin]="600"
        />
        @if (fields().distance) {
          <app-number-stepper
            data-field="distance"
            [label]="'workout.cardio.' + distanceUnit() | transloco"
            [value]="displayDistance()"
            [stepSize]="distanceStep"
            [decimals]="distanceDecimals"
            [max]="999"
            (valueChange)="distance.set(toMeters($event))"
          />
        }

        <button
          #check
          type="button"
          class="relative ml-auto flex size-11 shrink-0 items-center justify-center rounded-full border"
          [class]="
            done()
              ? 'border-primary bg-primary text-primary-foreground'
              : 'bg-muted text-foreground'
          "
          [attr.aria-label]="'workout.cardio.complete' | transloco"
          [attr.aria-pressed]="done()"
          (click)="haptics.tap(); complete.emit()"
        >
          <ng-icon name="lucideCheck" size="22" />
          <span
            #ring
            class="pointer-events-none absolute -inset-px rounded-full border-2 border-primary opacity-0"
            aria-hidden="true"
          ></span>
        </button>
      </div>

      <div class="grid gap-[3px]" [class]="fields().level ? 'grid-cols-3' : 'grid-cols-2'">
        @if (fields().level) {
          <app-number-stepper
            data-field="level"
            [label]="'workout.cardio.level' | transloco"
            [(value)]="level"
            [decimals]="1"
            [max]="99"
            [origin]="5"
            [stretch]="true"
          />
        }
        <app-number-stepper
          data-field="kcal"
          [label]="'workout.cardio.kcal' | transloco"
          [(value)]="kcal"
          [stepSize]="10"
          [max]="9999"
          [origin]="100"
          [stretch]="true"
        />
        <app-number-stepper
          data-field="heartRate"
          [label]="'workout.cardio.heartRate' | transloco"
          [(value)]="heartRate"
          [min]="30"
          [max]="240"
          [origin]="120"
          [stretch]="true"
        />
      </div>
    </div>
  `,
})
export class CardioRow {
  readonly number = input.required<number>();
  /** Seconds. */
  readonly duration = model<number | null>(null);
  /** Metres. */
  readonly distance = model<number | null>(null);
  readonly level = model<number | null>(null);
  readonly kcal = model<number | null>(null);
  readonly heartRate = model<number | null>(null);
  readonly state = input<CardioRowState>('open');
  readonly extra = input(false);
  readonly distanceUnit = input<DistanceUnit>('km');
  readonly fields = input<CardioFields>({ distance: true, level: true });

  readonly complete = output<void>();
  readonly menu = output<void>();

  protected readonly durationFormat = DURATION_FORMAT;
  protected readonly maxDuration = MAX_DURATION_SEC;
  protected readonly distanceStep = DISTANCE_STEP;
  protected readonly distanceDecimals = DISTANCE_DECIMALS;
  protected readonly displayDistance = computed(() =>
    metersToDisplay(this.distance(), this.distanceUnit()),
  );
  protected readonly haptics = inject(HapticsService);
  private readonly celebration = inject(CelebrationService);
  private readonly injector = inject(Injector);
  private readonly checkButton = viewChild<ElementRef<HTMLElement>>('check');
  private readonly ring = viewChild<ElementRef<HTMLElement>>('ring');
  private readonly sweep = viewChild<ElementRef<HTMLElement>>('sweep');

  constructor() {
    inject(LongPress).longPress.subscribe(() => this.menu.emit());
    // Like the set row: only a change from open to completed celebrates, the menu is skipped.
    let last: CardioRowState | undefined;
    effect(() => {
      const state = this.state();
      if (state === 'menu-open') {
        return;
      }
      const before = last;
      last = state;
      if (before === 'open' && state === 'completed') {
        afterNextRender(
          () =>
            celebrateCheck(this.celebration, {
              check: this.checkButton()?.nativeElement,
              ring: this.ring()?.nativeElement,
              sweep: this.sweep()?.nativeElement,
            }),
          { injector: this.injector },
        );
      }
    });
  }

  protected toMeters(value: number | null): number | null {
    return displayToMeters(value, this.distanceUnit());
  }

  protected done(): boolean {
    return this.state() === 'completed';
  }
}
