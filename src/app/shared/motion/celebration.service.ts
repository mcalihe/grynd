import { DOCUMENT, inject, Injectable, InjectionToken } from '@angular/core';
import confetti from 'canvas-confetti';
import { HapticsService } from '../../core/services/haptics.service';
import { canAnimate } from './motion';

/** Where a burst starts: an element or rect (its centre), or a point in viewport fractions. */
export type BurstOrigin = Element | DOMRect | { x: number; y: number } | null | undefined;

export type ConfettiFactory = (canvas: HTMLCanvasElement) => confetti.CreateTypes;

/** Creates the confetti instance on our canvas; tests swap it for a fake. */
export const CONFETTI_FACTORY = new InjectionToken<ConfettiFactory>('CONFETTI_FACTORY', {
  providedIn: 'root',
  factory: () => (canvas) =>
    confetti.create(canvas, { resize: true, useWorker: true, disableForReducedMotion: true }),
});

/** Particle colours come from the design tokens, read at burst time so light and dark both fit. */
export const CONFETTI_TOKENS = [
  '--primary',
  '--chart-2',
  '--brand-300',
  '--chart-4',
  '--foreground',
];
const SPARK_TOKENS = ['--primary', '--brand-300', '--chart-2'];
const STAR_TOKENS = ['--primary', '--chart-4', '--brand-300'];

/** Hex values of the given custom properties; anything else is dropped (canvas-confetti needs hex). */
export function tokenColors(
  style: Pick<CSSStyleDeclaration, 'getPropertyValue'>,
  tokens: readonly string[],
): string[] {
  return tokens
    .map((token) => style.getPropertyValue(token).trim())
    .filter((value) => /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value));
}

/** Viewport fractions (0–1) of the origin's centre, as canvas-confetti expects. */
export function originOf(
  from: Exclude<BurstOrigin, Element>,
  viewport: { width: number; height: number },
): confetti.Origin {
  if (!from) {
    return { x: 0.5, y: 0.5 };
  }
  if (!('width' in from)) {
    return { x: from.x, y: from.y };
  }
  const rect = from;
  return {
    x: (rect.left + rect.width / 2) / Math.max(1, viewport.width),
    y: (rect.top + rect.height / 2) / Math.max(1, viewport.height),
  };
}

/**
 * Particle bursts and their haptics for the reward moments (decision 0015): set, record,
 * exercise and the workout finale. One full-screen canvas that never takes pointer events.
 * Without animation support or with reduced motion, only the haptics remain.
 */
@Injectable({ providedIn: 'root' })
export class CelebrationService {
  private readonly document = inject(DOCUMENT);
  private readonly haptics = inject(HapticsService);
  private readonly createConfetti = inject(CONFETTI_FACTORY);
  private instance?: confetti.CreateTypes;

  /** Set checked: a quick spark burst around the check (the tap itself gives the haptics). */
  sparks(from: BurstOrigin): void {
    this.fire(from, SPARK_TOKENS, {
      particleCount: 14,
      spread: 360,
      startVelocity: 13,
      gravity: 0.5,
      decay: 0.86,
      ticks: 45,
      scalar: 0.55,
      shapes: ['circle'],
    });
  }

  /** New record: a star burst from the set. */
  record(from: BurstOrigin): void {
    this.haptics.success();
    this.fire(from, STAR_TOKENS, {
      particleCount: 28,
      spread: 360,
      startVelocity: 22,
      gravity: 0.7,
      decay: 0.9,
      ticks: 90,
      scalar: 0.95,
      shapes: ['star'],
    });
  }

  /** Exercise done: confetti bursting out of the badge. */
  exercise(from: BurstOrigin): void {
    this.haptics.success();
    this.fire(from, CONFETTI_TOKENS, {
      particleCount: 70,
      spread: 360,
      startVelocity: 34,
      gravity: 0.9,
      decay: 0.9,
      ticks: 140,
      scalar: 0.9,
    });
  }

  /** The exercise badge lands in its progress segment. */
  collect(from: BurstOrigin): void {
    this.haptics.tap();
    this.fire(from, SPARK_TOKENS, {
      particleCount: 18,
      angle: 270,
      spread: 120,
      startVelocity: 16,
      gravity: 0.8,
      decay: 0.88,
      ticks: 60,
      scalar: 0.6,
      shapes: ['circle'],
    });
  }

  /**
   * Workout finished: two cannons from the bottom corners, then fireworks for about three
   * seconds. Returns a function that stops everything (call it when the screen closes).
   */
  finale(): () => void {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, run: () => void) => timers.push(setTimeout(run, ms));
    const cannons = (particleCount: number, startVelocity: number) => {
      this.haptics.heavy();
      for (const [x, angle] of [
        [0, 60],
        [1, 120],
      ]) {
        this.fire({ x, y: 0.9 }, CONFETTI_TOKENS, {
          particleCount,
          angle,
          spread: 55,
          startVelocity,
          gravity: 1,
          ticks: 220,
        });
      }
    };
    at(0, () => cannons(90, 62));
    at(420, () => cannons(55, 52));
    for (let i = 0; i < 7; i++) {
      at(950 + i * 330, () =>
        this.fire(
          { x: 0.15 + Math.random() * 0.7, y: 0.1 + Math.random() * 0.3 },
          CONFETTI_TOKENS,
          {
            particleCount: 42,
            spread: 360,
            startVelocity: 26,
            gravity: 0.9,
            decay: 0.91,
            ticks: 110,
            scalar: 0.85,
          },
        ),
      );
    }
    at(3200, () => this.haptics.success());
    return () => {
      timers.forEach(clearTimeout);
      this.instance?.reset();
    };
  }

  private fire(from: BurstOrigin, tokens: readonly string[], options: confetti.Options): void {
    if (!canAnimate()) {
      return;
    }
    const view = this.document.defaultView;
    const colors = view
      ? tokenColors(view.getComputedStyle(this.document.documentElement), tokens)
      : [];
    const origin = originOf(from instanceof Element ? from.getBoundingClientRect() : from, {
      width: view?.innerWidth ?? 1,
      height: view?.innerHeight ?? 1,
    });
    void this.confetti()({ ...options, origin, ...(colors.length ? { colors } : {}) });
  }

  private confetti(): confetti.CreateTypes {
    if (!this.instance) {
      const canvas = this.document.createElement('canvas');
      canvas.className = 'pointer-events-none fixed inset-0 z-100 size-full';
      canvas.setAttribute('aria-hidden', 'true');
      this.document.body.appendChild(canvas);
      this.instance = this.createConfetti(canvas);
    }
    return this.instance;
  }
}
