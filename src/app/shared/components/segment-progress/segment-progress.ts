import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
} from '@angular/core';
import { EASE_OUT, play } from '../../motion/motion';

/** Share of done sets per exercise, 0–1 (extra sets count too). */
export interface ProgressSegment {
  done: number;
  total: number;
}

export function segmentRatio({ done, total }: ProgressSegment): number {
  return total > 0 ? Math.min(1, Math.max(0, done / total)) : 0;
}

/**
 * Workout progress bar (Figma «Trainingsfortschritt» 56:48035): one segment per exercise in
 * session order, filled by done sets; the current exercise is taller and outlined. No numbers.
 * Fills glide to their new width; `flash` makes a segment jump when its exercise is done.
 */
@Component({
  selector: 'app-segment-progress',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex items-center gap-1.5', 'aria-hidden': 'true' },
  template: `
    @for (ratio of ratios(); track $index) {
      <span
        class="relative flex-1 overflow-hidden rounded-full bg-muted"
        [class]="$index === current() ? 'h-1.5 ring-1 ring-primary' : 'h-1'"
        [attr.data-current]="$index === current() || null"
        [attr.data-index]="$index"
      >
        <span
          class="absolute inset-y-0 left-0 rounded-full bg-primary motion-safe:transition-[width] motion-safe:duration-500 motion-safe:ease-out"
          [style.width.%]="ratio * 100"
        ></span>
      </span>
    }
  `,
})
export class SegmentProgress {
  readonly segments = input.required<readonly ProgressSegment[]>();
  readonly current = input(0);

  protected readonly ratios = computed(() => this.segments().map(segmentRatio));
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  /** Screen position of a segment, e.g. as the target of a flying badge. */
  segmentRect(index: number): DOMRect | null {
    return this.segment(index)?.getBoundingClientRect() ?? null;
  }

  /** Short vertical bounce of one segment. */
  flash(index: number): Promise<void> {
    return play(
      this.segment(index),
      { scaleY: [1, 3, 1], scaleX: [1, 1.04, 1] },
      { duration: 0.5, ease: EASE_OUT },
    );
  }

  private segment(index: number): HTMLElement | null {
    return this.host.querySelector<HTMLElement>(`[data-index="${index}"]`);
  }
}
