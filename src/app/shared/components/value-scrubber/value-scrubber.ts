import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  input,
  viewChild,
} from '@angular/core';
import { NgIcon } from '@ng-icons/core';
import { EASE_OUT, play, SPRING } from '../../motion/motion';
import {
  EDGE_ZONE_PX,
  edgeSpeed,
  formatNumber,
  RulerFrame,
  rulerTicks,
  rulerX,
  SCRUB_STEP_PX,
} from '../number-stepper/number-stepper.logic';

/** Height of the ruler band. */
const BAND_PX = 72;
/** Height of the label row at the top of the band. */
const LABELS_PX = 26;
/** Gap between the bottom of the band and the finger (room for the touch ring). */
const FINGER_GAP_PX = 32;
/** Gap between the band and the big value above it. */
const HUD_GAP_PX = 16;
/** Room the big value (label + 60 px digits) needs above the band; with less, it goes below. */
const HUD_ROOM_PX = 80 + HUD_GAP_PX + 8;

/**
 * Full-screen ruler shown while scrubbing a NumberStepper (decision 0018). Purely visual and
 * `aria-hidden`: the stepper owns the gesture and the value, and screen readers follow its
 * spinbutton. One tick is one step; the needle sits on the selected tick under the finger, a dot
 * marks the start value, and the « » zones at the edges show where the ruler keeps scrolling.
 */
@Component({
  selector: 'app-value-scrubber',
  imports: [NgIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'pointer-events-none fixed inset-0 block touch-none select-none',
    'aria-hidden': 'true',
  },
  template: `
    <div #backdrop class="absolute inset-0 bg-background/80 backdrop-blur-sm"></div>

    <div
      #hud
      class="absolute left-1/2 flex -translate-x-1/2 flex-col items-center gap-1"
      [class.-translate-y-full]="!hudBelow()"
      [style.top.px]="hudTop()"
    >
      <span class="text-xs leading-4 font-semibold tracking-widest text-muted-foreground">{{
        label()
      }}</span>
      <span class="relative text-6xl leading-none font-bold tabular-nums"
        >{{ display() }}
        @if (delta(); as change) {
          <span
            class="absolute top-1/2 left-full ml-3 -translate-y-1/2 rounded-full bg-muted px-2.5 py-1 text-sm font-semibold whitespace-nowrap"
            >{{ change }}</span
          >
        }
      </span>
    </div>

    <div
      #band
      class="absolute inset-x-0 overflow-hidden border-y bg-card shadow-lg"
      [style.top.px]="bandTop()"
      [style.height.px]="bandHeight"
    >
      @for (tick of ticks(); track tick.value) {
        <span
          class="absolute bottom-4 -translate-x-1/2 rounded-full"
          [class]="tick.major ? 'h-6 w-0.5 bg-foreground/70' : 'h-3 w-px bg-muted-foreground/60'"
          [style.left.px]="tick.x"
        ></span>
        @if (tick.major) {
          <span
            class="absolute top-2 -translate-x-1/2 text-xs font-medium tabular-nums"
            [class]="tick.value === value() ? 'text-foreground' : 'text-muted-foreground'"
            [style.left.px]="tick.x"
            >{{ tickLabel(tick.value) }}</span
          >
        }
      }
      @if (startX(); as x) {
        <span
          class="absolute bottom-1 size-1.5 -translate-x-1/2 rounded-full bg-foreground/50"
          [style.left.px]="x"
        ></span>
      }
      <span
        class="absolute inset-y-0 left-0 flex items-center bg-linear-to-r from-card from-40% to-transparent pl-1"
        [class]="edge() < 0 ? 'text-primary' : 'text-muted-foreground'"
        [style.width.px]="edgeZone"
      >
        <ng-icon
          name="lucideChevronLeft"
          size="20"
          [class.motion-safe:animate-pulse]="edge() < 0"
        />
      </span>
      <span
        class="absolute inset-y-0 right-0 flex items-center justify-end bg-linear-to-l from-card from-40% to-transparent pr-1"
        [class]="edge() > 0 ? 'text-primary' : 'text-muted-foreground'"
        [style.width.px]="edgeZone"
      >
        <ng-icon
          name="lucideChevronRight"
          size="20"
          [class.motion-safe:animate-pulse]="edge() > 0"
        />
      </span>
    </div>

    <div
      #needle
      class="absolute top-0 left-0 transition-transform duration-75 ease-out motion-reduce:transition-none"
      [style.transform]="'translateX(' + needleX() + 'px)'"
    >
      <span
        class="absolute w-[3px] -translate-x-1/2 rounded-full bg-primary shadow-[0_0_12px_var(--primary)]"
        [style.top.px]="needleLine().top"
        [style.height.px]="needleLine().height"
      ></span>
      <span
        class="absolute size-12 -translate-1/2 rounded-full border-2 border-primary bg-primary/15"
        [style.top.px]="pointerY()"
      ></span>
    </div>
  `,
})
export class ValueScrubber {
  readonly label = input.required<string>();
  /** Current value; null while an empty stepper has not moved yet. */
  readonly value = input.required<number | null>();
  /** Value when the scrub started. */
  readonly start = input<number | null>(null);
  readonly step = input(1);
  readonly min = input(0);
  readonly max = input(9999);
  readonly decimals = input(0);
  readonly locale = input('de');
  /** Screen x where the start value sits, and how far the ruler has scrolled since. */
  readonly originX = input(0);
  readonly scrollPx = input(0);
  /** Current finger position. */
  readonly pointerX = input(0);
  readonly pointerY = input(0);
  readonly width = input(393);

  protected readonly bandHeight = BAND_PX;
  protected readonly edgeZone = EDGE_ZONE_PX;

  private readonly backdropRef = viewChild<ElementRef<HTMLElement>>('backdrop');
  private readonly hudRef = viewChild<ElementRef<HTMLElement>>('hud');
  private readonly bandRef = viewChild<ElementRef<HTMLElement>>('band');
  private readonly needleRef = viewChild<ElementRef<HTMLElement>>('needle');

  private readonly frame = computed<RulerFrame>(() => ({
    base: this.start() ?? this.min(),
    step: this.step(),
    originX: this.originX(),
    scrollPx: this.scrollPx(),
  }));

  protected readonly ticks = computed(() =>
    rulerTicks(this.frame(), -2 * SCRUB_STEP_PX, this.width() + 2 * SCRUB_STEP_PX, {
      min: this.min(),
      max: this.max(),
      decimals: this.decimals(),
    }),
  );

  protected readonly needleX = computed(() => {
    const value = this.value() ?? this.start();
    return value === null ? this.pointerX() : rulerX(value, this.frame());
  });

  protected readonly startX = computed(() => {
    const start = this.start();
    // 0 would read as «no marker» in the template, so keep it just inside the screen.
    return start === null ? null : Math.max(0.5, rulerX(start, this.frame()));
  });

  protected readonly edge = computed(() => Math.sign(edgeSpeed(this.pointerX(), this.width())));

  protected readonly display = computed(() =>
    formatNumber(this.value() ?? this.start(), this.locale(), this.decimals()),
  );

  /** Change since the scrub started, e.g. «+7,5»; empty while unchanged. */
  protected readonly delta = computed(() => {
    const value = this.value();
    const start = this.start();
    if (value === null || start === null || value === start) {
      return '';
    }
    const diff = value - start;
    const sign = diff > 0 ? '+' : '−';
    return sign + formatNumber(Math.abs(diff), this.locale(), this.decimals());
  });

  /** The band sits above the finger, where the thumb does not cover it; below only without room. */
  private readonly bandBelow = computed(() => this.pointerY() - FINGER_GAP_PX - BAND_PX < 8);

  protected readonly bandTop = computed(() =>
    this.bandBelow() ? this.pointerY() + FINGER_GAP_PX : this.pointerY() - FINGER_GAP_PX - BAND_PX,
  );

  /** Line from the touch ring (radius 24) across the ticks; it stops below the labels. */
  protected readonly needleLine = computed(() => {
    const [ring, top] = [this.pointerY(), this.bandTop()];
    return this.bandBelow()
      ? { top: ring + 22, height: top + BAND_PX - 8 - (ring + 22) }
      : { top: top + LABELS_PX, height: ring - 22 - (top + LABELS_PX) };
  });

  protected readonly hudBelow = computed(() => this.bandBelow() || this.bandTop() < HUD_ROOM_PX);

  protected readonly hudTop = computed(() => {
    if (!this.hudBelow()) {
      return this.bandTop() - HUD_GAP_PX;
    }
    return this.bandBelow() ? this.bandTop() + BAND_PX + 20 : this.pointerY() + 40;
  });

  constructor() {
    afterNextRender(() => void this.enter());
  }

  protected tickLabel(value: number): string {
    return formatNumber(value, this.locale(), this.decimals());
  }

  private enter(): Promise<unknown> {
    return Promise.all([
      play(this.backdropRef()?.nativeElement, { opacity: [0, 1] }, { duration: 0.15 }),
      play(
        this.bandRef()?.nativeElement,
        { opacity: [0, 1], scaleY: [0.6, 1] },
        { duration: 0.22, ease: EASE_OUT },
      ),
      play(this.hudRef()?.nativeElement, { opacity: [0, 1], scale: [0.8, 1] }, SPRING.snappy),
      play(this.needleRef()?.nativeElement, { opacity: [0, 1] }, { duration: 0.15 }),
    ]);
  }

  /** Fades everything out; resolves at once without animations. */
  leave(): Promise<unknown> {
    const out = { duration: 0.16, ease: EASE_OUT };
    return Promise.all([
      play(this.backdropRef()?.nativeElement, { opacity: 0 }, out),
      play(this.bandRef()?.nativeElement, { opacity: 0, scaleY: 0.8 }, out),
      play(this.hudRef()?.nativeElement, { opacity: 0, scale: 0.9 }, out),
      play(this.needleRef()?.nativeElement, { opacity: 0 }, out),
    ]);
  }
}
