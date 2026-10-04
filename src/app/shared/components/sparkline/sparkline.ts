import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

const WIDTH = 96;
const HEIGHT = 32;
/** Room for the 8 px end dot. */
const PAD = 4;

/** Points of a sparkline in a 96 × 32 box; gaps (null) are skipped, a flat series sits centred. */
export function sparklinePoints(values: readonly (number | null)[]): [number, number][] {
  const known = values.flatMap((value, index) => (value === null ? [] : [[index, value] as const]));
  if (!known.length) {
    return [];
  }
  const numbers = known.map(([, value]) => value);
  const min = Math.min(...numbers);
  const range = Math.max(...numbers) - min;
  const step = values.length > 1 ? (WIDTH - 2 * PAD) / (values.length - 1) : 0;
  return known.map(([index, value]) => [
    values.length > 1 ? PAD + index * step : WIDTH / 2,
    range > 0 ? HEIGHT - PAD - ((value - min) / range) * (HEIGHT - 2 * PAD) : HEIGHT / 2,
  ]);
}

/** Small trend line in chart-1 with a dot on the latest value (Figma Plan-Verlauf). */
@Component({
  selector: 'app-sparkline',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-block shrink-0', role: 'img', '[attr.aria-label]': 'label() || null' },
  template: `
    <svg [attr.viewBox]="viewBox" [attr.width]="width" [attr.height]="height" aria-hidden="true">
      @if (points().length > 1) {
        <polyline
          [attr.points]="path()"
          fill="none"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="stroke-chart-1"
        />
      }
      @if (last(); as dot) {
        <circle [attr.cx]="dot[0]" [attr.cy]="dot[1]" r="4" class="fill-chart-1" />
      }
    </svg>
  `,
})
export class Sparkline {
  readonly values = input<readonly (number | null)[]>([]);
  readonly label = input('');

  protected readonly width = WIDTH;
  protected readonly height = HEIGHT;
  protected readonly viewBox = `0 0 ${WIDTH} ${HEIGHT}`;
  protected readonly points = computed(() => sparklinePoints(this.values()));
  protected readonly path = computed(() =>
    this.points()
      .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
      .join(' '),
  );
  protected readonly last = computed(() => this.points().at(-1));
}
