import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export interface WeekChartBar {
  /** Short day label, e.g. "Mo". */
  label: string;
  trained: boolean;
  /** Share of the longest training day, 0–1. */
  value: number;
}

/** Heights in px of the bar area (Figma «Aktivitätsdiagramm»: 118 px incl. 20 px label). */
const BAR_AREA = 98;
const MIN_TRAINED = 16;
const EMPTY = 12;

/**
 * Weekly overview card (Figma Verlauf 37:29739): count, period, trend against last week and one
 * bar per day. Training days in chart-1, height by training time; other days low and grey.
 */
@Component({
  selector: 'app-week-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-3 rounded-xl border bg-surface-elevated p-4' },
  template: `
    <div class="flex items-start justify-between gap-3">
      <div class="flex min-w-0 flex-col gap-1">
        <p class="text-2xl font-bold">{{ title() }}</p>
        <p class="text-xs text-muted-foreground">{{ subtitle() }}</p>
      </div>
      @if (trend() !== 0) {
        <span
          class="text-sm font-semibold"
          [class]="trend() > 0 ? 'text-success' : 'text-muted-foreground'"
          [attr.aria-label]="trendLabel()"
        >
          {{ trendText() }}
        </span>
      }
    </div>
    <div class="flex gap-2" role="img" [attr.aria-label]="chartLabel()">
      @for (bar of bars(); track $index) {
        <div class="flex flex-1 flex-col items-center gap-1">
          <div class="flex w-full items-end" [style.height.px]="barArea">
            <div
              class="w-full rounded-t-md"
              [class]="bar.trained ? 'bg-chart-1' : 'bg-muted'"
              [style.height.px]="height(bar)"
              [attr.data-trained]="bar.trained || null"
            ></div>
          </div>
          <span class="text-xs text-muted-foreground" aria-hidden="true">{{ bar.label }}</span>
        </div>
      }
    </div>
  `,
})
export class WeekChart {
  readonly title = input.required<string>();
  readonly subtitle = input('');
  /** Difference in trainings to last week; hidden when 0. */
  readonly trend = input(0);
  readonly trendLabel = input('');
  readonly chartLabel = input('');
  readonly bars = input<readonly WeekChartBar[]>([]);

  protected readonly barArea = BAR_AREA;
  protected readonly trendText = computed(() =>
    this.trend() > 0 ? `+${this.trend()}` : `−${Math.abs(this.trend())}`,
  );

  protected height(bar: WeekChartBar): number {
    return bar.trained ? Math.max(MIN_TRAINED, Math.round(bar.value * BAR_AREA)) : EMPTY;
  }
}
