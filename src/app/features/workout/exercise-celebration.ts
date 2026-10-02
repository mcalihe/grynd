import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { CelebrationService } from '../../shared/motion/celebration.service';
import { canAnimate, EASE_OUT, flyTo, play, SPRING } from '../../shared/motion/motion';

/** How long the badge stays in the middle before it flies into its segment. */
export const HOLD_MS = 950;
/** Without animations the badge simply shows for a moment. */
export const STATIC_HOLD_MS = 1400;

/**
 * «Exercise done» moment (decision 0015): a primary badge springs in with a shockwave, rays and a
 * check that draws itself, confetti bursts out of it, then it shrinks into the exercise's progress
 * segment (`target`). Never takes pointer events, so logging can go on underneath.
 */
@Component({
  selector: 'app-exercise-celebration',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'pointer-events-none fixed inset-0 z-30 flex flex-col items-center justify-center gap-6',
    role: 'status',
  },
  template: `
    <div
      #scrim
      class="absolute inset-0 bg-radial from-background from-30% via-background/80 to-transparent"
    ></div>

    <div #badge class="relative flex size-28 items-center justify-center">
      <span
        #rays
        class="absolute -inset-16 rounded-full bg-[repeating-conic-gradient(var(--primary)_0deg_7deg,transparent_7deg_30deg)] mask-radial-from-20% mask-radial-to-70% opacity-0"
      ></span>
      <span #wave class="absolute inset-0 rounded-full border-4 border-primary opacity-0"></span>
      <span #circle class="absolute inset-0 rounded-full bg-primary shadow-lg"></span>
      <svg viewBox="0 0 24 24" class="relative size-14 text-primary-foreground" aria-hidden="true">
        <path
          #tick
          d="M5 12.5l4.5 4.5L19 7.5"
          fill="none"
          stroke="currentColor"
          stroke-width="3"
          stroke-linecap="round"
          stroke-linejoin="round"
          pathLength="1"
          stroke-dasharray="1"
        />
      </svg>
    </div>

    <div #text class="relative flex flex-col items-center gap-1 px-8 text-center">
      <p class="text-display font-bold">{{ praise() }}</p>
      <p class="text-sm font-medium text-muted-foreground">{{ subline() }}</p>
    </div>
  `,
})
export class ExerciseCelebration {
  readonly praise = input.required<string>();
  readonly subline = input('');
  /** Where the badge flies at the end (the exercise's progress segment). */
  readonly target = input<DOMRect | null>(null);

  /** The badge reached its segment. */
  readonly landed = output<void>();
  /** The animation is over; remove the component. */
  readonly done = output<void>();

  private readonly celebration = inject(CelebrationService);
  private readonly scrim = viewChild.required<ElementRef<HTMLElement>>('scrim');
  private readonly badge = viewChild.required<ElementRef<HTMLElement>>('badge');
  private readonly rays = viewChild.required<ElementRef<HTMLElement>>('rays');
  private readonly wave = viewChild.required<ElementRef<HTMLElement>>('wave');
  private readonly circle = viewChild.required<ElementRef<HTMLElement>>('circle');
  private readonly tick = viewChild.required<ElementRef<SVGPathElement>>('tick');
  private readonly text = viewChild.required<ElementRef<HTMLElement>>('text');
  private destroyed = false;

  constructor() {
    inject(DestroyRef).onDestroy(() => (this.destroyed = true));
    afterNextRender(() => void this.run());
  }

  private async run(): Promise<void> {
    const el = (ref: () => ElementRef<Element>) => ref().nativeElement;
    this.celebration.exercise(el(this.badge));
    void play(el(this.scrim), { opacity: [0, 1] }, { duration: 0.2 });
    void play(el(this.circle), { scale: [0, 1] }, SPRING.bouncy);
    void play(
      el(this.wave),
      { scale: [0.8, 2.8], opacity: [0.8, 0] },
      { duration: 0.8, delay: 0.08, ease: EASE_OUT },
    );
    void play(
      el(this.tick),
      { strokeDashoffset: [1, 0] },
      { duration: 0.35, delay: 0.18, ease: EASE_OUT },
    );
    void play(
      el(this.rays),
      { rotate: [0, 50], scale: [0.4, 1.2], opacity: [0, 0.45, 0] },
      { duration: 1.5, ease: EASE_OUT },
    );
    void play(el(this.text), { y: [18, 0], opacity: [0, 1] }, { ...SPRING.snappy, delay: 0.12 });

    await wait(canAnimate() ? HOLD_MS : STATIC_HOLD_MS);
    if (this.destroyed) {
      return;
    }
    void play(el(this.text), { opacity: 0, y: -8 }, { duration: 0.2 });
    void play(el(this.scrim), { opacity: 0 }, { duration: 0.4 });
    await flyTo(el(this.badge), this.target());
    if (!this.destroyed) {
      this.landed.emit();
      this.done.emit();
    }
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
