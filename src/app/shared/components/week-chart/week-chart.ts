import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { BarChart, BarChartBar } from '../bar-chart/bar-chart';

export interface WeekChartBar {
  /** Short day label, e.g. "Mo". */
  label: string;
  trained: boolean;
  /** Share of the longest training day, 0–1. */
  value: number;
}

/**
 * Weekly overview card (Figma Verlauf 37:29739): count, period, trend against last week and one
 * bar per day. Training days in chart-1, height by training time; other days low and grey.
 */
@Component({
  selector: 'app-week-chart',
  imports: [BarChart],
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
    <app-bar-chart [bars]="chartBars()" [label]="chartLabel()" />
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

  protected readonly chartBars = computed(() =>
    this.bars().map((bar): BarChartBar => ({
      label: bar.label,
      filled: bar.trained,
      value: bar.value,
    })),
  );
  protected readonly trendText = computed(() =>
    this.trend() > 0 ? `+${this.trend()}` : `−${Math.abs(this.trend())}`,
  );
}
