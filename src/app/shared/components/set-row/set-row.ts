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
import { HlmBadge } from '@spartan-ng/helm/badge';
import { WeightUnit } from '../../../core/settings/settings.service';
import { displayToKg, kgToDisplay, WEIGHT_STEP, weightDecimals } from '../../../core/units/weight';
import { HapticsService } from '../../../core/services/haptics.service';
import { CelebrationService } from '../../motion/celebration.service';
import { play, SPRING } from '../../motion/motion';
import { NumberStepper } from '../number-stepper/number-stepper';
import { celebrateCheck } from './check-celebration';
import { LongPress } from './long-press';

export { LONG_PRESS_MS } from './long-press';

export type SetRowState = 'open' | 'completed' | 'record' | 'menu-open';

/**
 * One set in a workout (Figma Grynd/Set Row 96:3055, decision 0009): number, weight and reps
 * steppers, check. `weight` is always kg; `unit` only changes what is shown and typed. Long-press
 * (500 ms), right-click or a tap on the set number opens the set menu.
 * Checking a set celebrates it (decision 0015): the check pops with a shockwave and sparks and a light
 * sweeps over the row; a new record adds a star burst and pops the «PR» badge.
 */
@Component({
  selector: 'app-set-row',
  imports: [NumberStepper, NgIcon, HlmBadge, TranslocoPipe],
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
      class="relative flex h-20 items-center gap-[3px] rounded-lg border bg-card p-1"
      [class.border-l-4]="state() === 'record'"
      [class.border-l-primary]="state() === 'record'"
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
      <button
        type="button"
        class="relative flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs after:absolute after:-inset-y-3 after:right-0 after:-left-1"
        aria-haspopup="menu"
        [attr.aria-expanded]="state() === 'menu-open'"
        [attr.aria-label]="'workout.set.menu' | transloco: { number: number() }"
        (click)="menu.emit()"
      >
        {{ number() }}
      </button>

      <app-number-stepper
        [label]="'workout.set.' + unit() | transloco"
        [value]="displayWeight()"
        [stepSize]="weightStep()"
        [decimals]="decimals()"
        [max]="unit() === 'kg' ? 999 : 2200"
        (valueChange)="weight.set(toKg($event))"
      />
      <app-number-stepper [label]="'workout.set.reps' | transloco" [(value)]="reps" [max]="999" />

      <button
        #check
        type="button"
        class="relative ml-auto flex size-11 shrink-0 items-center justify-center rounded-full border"
        [class]="
          done() ? 'border-primary bg-primary text-primary-foreground' : 'bg-muted text-foreground'
        "
        [attr.aria-label]="'workout.set.complete' | transloco"
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

      @if (state() === 'record') {
        <span #badge hlmBadge class="absolute -top-3 right-3">{{
          'workout.set.record' | transloco
        }}</span>
      }
    </div>
  `,
})
export class SetRow {
  readonly number = input.required<number>();
  readonly weight = model<number | null>(null);
  readonly reps = model<number | null>(null);
  readonly state = input<SetRowState>('open');
  readonly extra = input(false);
  readonly unit = input<WeightUnit>('kg');
  /** ± step of the weight in the shown unit, chosen per exercise (decision 0022). */
  readonly weightStep = input(WEIGHT_STEP);

  readonly complete = output<void>();
  readonly menu = output<void>();

  protected readonly displayWeight = computed(() => kgToDisplay(this.weight(), this.unit()));
  protected readonly decimals = computed(() => weightDecimals(this.unit()));
  protected readonly haptics = inject(HapticsService);
  private readonly celebration = inject(CelebrationService);
  private readonly injector = inject(Injector);
  private readonly checkButton = viewChild<ElementRef<HTMLElement>>('check');
  private readonly ring = viewChild<ElementRef<HTMLElement>>('ring');
  private readonly sweep = viewChild<ElementRef<HTMLElement>>('sweep');
  private readonly badge = viewChild<ElementRef<HTMLElement>>('badge');

  constructor() {
    inject(LongPress).longPress.subscribe(() => this.menu.emit());
    // Celebrate transitions only: rows rendered on load or restore stay quiet. «menu-open» hides
    // the real state, so it is skipped (closing the menu on a record is not a new record).
    let last: SetRowState | undefined;
    effect(() => {
      const state = this.state();
      if (state === 'menu-open') {
        return;
      }
      const before = last;
      last = state;
      if (before !== undefined && before !== state) {
        afterNextRender(() => this.celebrate(before, state), { injector: this.injector });
      }
    });
  }

  private celebrate(before: SetRowState, state: SetRowState): void {
    const check = this.checkButton()?.nativeElement;
    if (before === 'open') {
      celebrateCheck(this.celebration, {
        check,
        ring: this.ring()?.nativeElement,
        sweep: this.sweep()?.nativeElement,
      });
    }
    if (state === 'record') {
      const badge = this.badge()?.nativeElement;
      void play(badge, { scale: [0, 1], rotate: [-16, 0] }, SPRING.bouncy);
      this.celebration.record(badge ?? check);
    }
  }

  protected toKg(value: number | null): number | null {
    return displayToKg(value, this.unit());
  }

  protected done(): boolean {
    return this.state() === 'completed' || this.state() === 'record';
  }
}
