import { CelebrationService } from '../../motion/celebration.service';
import { pop, shine, shockwave } from '../../motion/motion';

/**
 * Checking a set or cardio entry (decision 0015): the check pops with a shockwave and sparks and
 * a light sweeps over the row. Non-blocking; motion helpers respect reduced motion.
 */
export function celebrateCheck(
  celebration: CelebrationService,
  parts: { check?: HTMLElement; ring?: HTMLElement; sweep?: HTMLElement },
): void {
  void pop(parts.check, 0.7);
  void shockwave(parts.ring);
  void shine(parts.sweep);
  celebration.sparks(parts.check);
}
