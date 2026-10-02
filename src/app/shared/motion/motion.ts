import { animate, AnimationOptions, DOMKeyframesDefinition, stagger } from 'motion';

export { animate, stagger };

/**
 * Shared motion presets (decision 0015). Springs for things that pop, tweens for things that
 * travel. Every animation in the app should start from these so the app feels like one piece.
 */
export const SPRING = {
  /** Quick with a small overshoot: buttons, badges, checks. */
  snappy: { type: 'spring', stiffness: 520, damping: 20 },
  /** Big overshoot for hero elements (trophy, exercise badge). */
  bouncy: { type: 'spring', stiffness: 320, damping: 13 },
  /** Settles without visible bounce: cards, layout. */
  gentle: { type: 'spring', stiffness: 220, damping: 26 },
} as const satisfies Record<string, AnimationOptions>;

/** Strong ease-out (easeOutQuint) for counters and things flying in. */
export const EASE_OUT = [0.22, 1, 0.36, 1] as const;

/** The user asked the OS for less motion. */
export function reducedMotion(): boolean {
  return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

/**
 * Element animations run only with the Web Animations API (not in jsdom) and without the reduced
 * motion preference. Every helper below checks this and otherwise resolves right away.
 */
export function canAnimate(): boolean {
  return (
    typeof Element !== 'undefined' &&
    typeof Element.prototype.animate === 'function' &&
    !reducedMotion()
  );
}

type Target = Element | null | undefined;

/** Runs a motion animation when allowed; resolves when it ends (or at once when skipped). */
export async function play(
  target: Target | readonly Element[],
  keyframes: DOMKeyframesDefinition,
  options?: AnimationOptions,
): Promise<void> {
  const elements = Array.isArray(target) ? target : target ? [target as Element] : [];
  if (elements.length === 0 || !canAnimate()) {
    return;
  }
  await animate(elements, keyframes, options);
}

/**
 * Staggered entrance: the elements rise and fade in one after another. They are hidden first, so
 * nothing flashes during the delay; without animations they simply stay visible.
 */
export function enter(
  targets: readonly Element[],
  { y = 24, delay = 0, each = 0.08 }: { y?: number; delay?: number; each?: number } = {},
): Promise<void> {
  if (!canAnimate()) {
    return Promise.resolve();
  }
  for (const el of targets) {
    (el as HTMLElement).style.opacity = '0';
  }
  return play(
    targets,
    { y: [y, 0], opacity: [0, 1] },
    { duration: 0.55, ease: EASE_OUT, delay: stagger(each, { startDelay: delay }) },
  );
}

/** Springy scale-in from `from` (e.g. a check that was just ticked). */
export function pop(target: Target, from = 0.6): Promise<void> {
  return play(target, { scale: [from, 1] }, SPRING.bouncy);
}

/** A ring that expands and fades out, like a shockwave. The element should be a centred ring. */
export function shockwave(target: Target, size = 2.6): Promise<void> {
  return play(target, { scale: [0.6, size], opacity: [0.9, 0] }, { duration: 0.6, ease: EASE_OUT });
}

/** Light sweep across a row; the element is a gradient strip inside an overflow-hidden parent. */
export function shine(target: Target, duration = 0.7): Promise<void> {
  return play(
    target,
    { x: ['-100%', '100%'], opacity: [0, 1, 0] },
    { duration, ease: 'easeInOut' },
  );
}

/** Shrinks the element into `rect` (e.g. a badge flying into its progress segment). */
export function flyTo(target: Target, rect: DOMRect | null | undefined): Promise<void> {
  if (!target || !rect) {
    return play(target, { opacity: 0, scale: 0.8 }, { duration: 0.25 });
  }
  const from = target.getBoundingClientRect();
  const x = rect.left + rect.width / 2 - (from.left + from.width / 2);
  const y = rect.top + rect.height / 2 - (from.top + from.height / 2);
  return play(
    target,
    { x, y, scale: 0.12, opacity: [1, 1, 0] },
    { duration: 0.55, ease: [0.55, 0, 0.75, 0.2] },
  );
}

/** Animates a number from 0 to `to`; `onUpdate` gets every frame (the final value when skipped). */
export async function countUp(
  to: number,
  onUpdate: (value: number) => void,
  { duration = 1.2, delay = 0 }: { duration?: number; delay?: number } = {},
): Promise<void> {
  if (!canAnimate() || to === 0) {
    onUpdate(to);
    return;
  }
  onUpdate(0);
  await animate(0, to, { duration, delay, ease: EASE_OUT, onUpdate });
  onUpdate(to);
}
