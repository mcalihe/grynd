import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

export interface DonutSegment {
  key: string;
  label: string;
  value: number;
  /** CSS colour of the segment, a token such as `var(--muscle-chest)`. */
  color: string;
}

const SIZE = 132;
const STROKE = 21;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
/** Surface gap between neighbouring segments, in px along the ring. */
const GAP = 2;

export interface DonutArc {
  key: string;
  color: string;
  dashArray: string;
  dashOffset: number;
}

/** Ring segments in input order, clockwise from 12 o'clock; empty segments are skipped. */
export function donutArcs(segments: readonly DonutSegment[]): DonutArc[] {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const visible = segments.filter((s) => s.value > 0);
  let start = 0;
  return visible.map((segment) => {
    const length = (segment.value / total) * CIRCUMFERENCE;
    const drawn = visible.length > 1 ? Math.max(0, length - GAP) : length;
    const arc = {
      key: segment.key,
      color: segment.color,
      dashArray: `${drawn} ${CIRCUMFERENCE - drawn}`,
      dashOffset: -start,
    };
    start += length;
    return arc;
  });
}

/**
 * Part-to-whole ring with a legend (Figma Verlauf · Statistik «Muskelgruppen»). The legend is the
 * readable table: sorted by value with count and share. Tapping a segment or a row highlights it
 * and shows its value in the centre.
 */
@Component({
  selector: 'app-donut-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex items-center gap-4' },
  template: `
    <div class="relative shrink-0" [style.width.px]="size" [style.height.px]="size">
      <svg [attr.viewBox]="viewBox" class="size-full -rotate-90" aria-hidden="true">
        @for (arc of arcs(); track arc.key) {
          <circle
            [attr.cx]="size / 2"
            [attr.cy]="size / 2"
            [attr.r]="radius"
            fill="none"
            [attr.stroke-width]="stroke"
            [attr.stroke-dasharray]="arc.dashArray"
            [attr.stroke-dashoffset]="arc.dashOffset"
            class="cursor-pointer transition-opacity"
            [class.opacity-30]="active() !== null && active() !== arc.key"
            [style.stroke]="arc.color"
            (click)="toggle(arc.key)"
          />
        }
      </svg>
      <div
        class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"
        aria-live="polite"
      >
        <span class="text-xl font-semibold">{{ centre().value }}</span
        >{{ ' ' }}
        <span class="max-w-20 truncate text-xs text-muted-foreground">{{ centre().label }}</span>
      </div>
    </div>
    <ul class="flex min-w-0 flex-1 flex-col">
      @for (row of legend(); track row.key) {
        <li>
          <button
            type="button"
            class="flex min-h-7 w-full items-center gap-2 text-left text-sm"
            [class.opacity-40]="active() !== null && active() !== row.key"
            [attr.aria-pressed]="active() === row.key"
            (click)="toggle(row.key)"
          >
            <span class="size-2 shrink-0 rounded-full" [style.background-color]="row.color"></span>
            <span class="min-w-0 flex-1 truncate" [class.text-muted-foreground]="!row.value">
              {{ row.label }}
            </span>
            <span class="font-semibold" [class.text-muted-foreground]="!row.value">
              {{ row.value }}
            </span>
            <span class="w-9 shrink-0 text-right text-xs text-muted-foreground">
              {{ row.share }} %
            </span>
          </button>
        </li>
      }
    </ul>
  `,
})
export class DonutChart {
  /** Drawn in this order around the ring, so neighbouring colours stay fixed. */
  readonly segments = input<readonly DonutSegment[]>([]);
  /** Label under the total in the centre, e.g. "Sätze". */
  readonly totalLabel = input('');

  protected readonly size = SIZE;
  protected readonly stroke = STROKE;
  protected readonly radius = RADIUS;
  protected readonly viewBox = `0 0 ${SIZE} ${SIZE}`;
  protected readonly active = signal<string | null>(null);

  private readonly total = computed(() => this.segments().reduce((sum, s) => sum + s.value, 0));
  protected readonly arcs = computed(() => donutArcs(this.segments()));
  protected readonly legend = computed(() =>
    [...this.segments()]
      .sort((a, b) => b.value - a.value)
      .map((s) => ({
        ...s,
        share: this.total() ? Math.round((s.value / this.total()) * 100) : 0,
      })),
  );
  protected readonly centre = computed(() => {
    const active = this.segments().find((s) => s.key === this.active());
    return active
      ? { value: active.value, label: active.label }
      : { value: this.total(), label: this.totalLabel() };
  });

  protected toggle(key: string): void {
    this.active.update((current) => (current === key ? null : key));
  }
}
