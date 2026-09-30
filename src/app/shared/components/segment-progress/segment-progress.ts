import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

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
      >
        <span
          class="absolute inset-y-0 left-0 rounded-full bg-primary"
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
}
