import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';

export interface BarChartBar {
  /** Share of the largest bar, 0–1. */
  value: number;
  /** Bars with data are drawn in chart-1, others low and grey. */
  filled: boolean;
  /** Axis label below the bar; leave empty to skip (e.g. most days of a month). */
  label?: string;
  /** Spoken label of the bar when the chart is interactive. */
  description?: string;
}

/** Bars from Figma «Aktivitätsdiagramm» (37:29745): 98 px bar area, chart-1 for data. */
const BAR_AREA = 98;
const MIN_FILLED = 16;

/**
 * Column chart for the history (week overview, statistics, plan history). Heights are relative to
 * the largest bar. When `interactive`, tapping a bar selects it and dims the others.
 */
@Component({
  selector: 'app-bar-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet],
  host: {
    class: 'flex flex-col',
    '[attr.role]': 'interactive() ? "group" : "img"',
    '[attr.aria-label]': 'label() || null',
  },
  template: `
    <div class="flex" [class]="dense() ? 'gap-0.5' : 'gap-2'">
      @for (bar of bars(); track $index; let i = $index) {
        @if (interactive()) {
          <button
            type="button"
            class="flex min-w-0 flex-1 flex-col items-center gap-1"
            [attr.aria-label]="bar.description || bar.label"
            [attr.aria-pressed]="selected() === i"
            (click)="toggle(i)"
          >
            <ng-container *ngTemplateOutlet="column; context: { $implicit: bar, i }" />
          </button>
        } @else {
          <div class="flex min-w-0 flex-1 flex-col items-center gap-1">
            <ng-container *ngTemplateOutlet="column; context: { $implicit: bar, i }" />
          </div>
        }
      }
    </div>

    <ng-template #column let-bar let-i="i">
      <div class="flex w-full items-end" [style.height.px]="area">
        <div
          class="w-full rounded-t-md transition-opacity"
          [class]="bar.filled ? 'bg-chart-1' : 'bg-muted'"
          [class.opacity-40]="selected() !== null && selected() !== i"
          [style.height.px]="height(bar)"
          [attr.data-filled]="bar.filled || null"
        ></div>
      </div>
      @if (hasLabels()) {
        <span class="h-4 text-xs whitespace-nowrap text-muted-foreground" aria-hidden="true">
          {{ bar.label }}
        </span>
      }
    </ng-template>
  `,
})
export class BarChart {
  readonly bars = input<readonly BarChartBar[]>([]);
  /** Accessible summary of the whole chart. */
  readonly label = input('');
  /** Height of bars without data, e.g. 12 px for a week, 4 px for 30 days. */
  readonly emptyHeight = input(12);
  readonly interactive = input(false);
  readonly selected = model<number | null>(null);

  protected readonly area = BAR_AREA;
  /** Many bars (a month) get thin gaps. */
  protected readonly dense = computed(() => this.bars().length > 12);
  protected readonly hasLabels = computed(() => this.bars().some((bar) => bar.label));

  protected height(bar: BarChartBar): number {
    return bar.filled ? Math.max(MIN_FILLED, Math.round(bar.value * BAR_AREA)) : this.emptyHeight();
  }

  protected toggle(index: number): void {
    this.selected.update((current) => (current === index ? null : index));
  }
}
