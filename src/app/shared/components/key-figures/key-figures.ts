import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

/** `up` is an improvement (success); `down` and `neutral` stay muted (decision 0012). */
export type DeltaTone = 'up' | 'down' | 'neutral';

export interface KeyFigure {
  label: string;
  value: string;
  /** Signed change, e.g. "+320 kg"; hidden when empty. */
  delta?: string;
  tone?: DeltaTone;
}

/**
 * Key figures (Figma «Kennzahlen» 84:3425): value, label and an optional delta per figure. As
 * `selectable` tiles the figures pick what a chart shows (Verlauf · Statistik). With two columns
 * an odd last figure spans the row (decision 0024).
 */
@Component({
  selector: 'app-key-figures',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    @if (selectable()) {
      <div class="grid gap-2" [class]="columns() === 2 ? 'grid-cols-2' : 'grid-cols-3'">
        @for (figure of figures(); track figure.label; let i = $index) {
          <button
            type="button"
            class="flex min-w-0 flex-col items-start gap-1 rounded-md px-3 py-2 text-left"
            [class.col-span-2]="spansRow(i)"
            [class.bg-muted]="selected() === i"
            [attr.aria-pressed]="selected() === i"
            (click)="selected.set(i)"
          >
            <span class="max-w-full truncate text-xl font-semibold">{{ figure.value }}</span>
            <span class="text-xs text-muted-foreground">{{ figure.label }}</span>
            @if (figure.delta) {
              <span class="text-xs font-semibold" [class]="toneClass(figure.tone)">
                {{ figure.delta }}
              </span>
            }
          </button>
        }
      </div>
    } @else {
      <dl class="grid gap-x-3 gap-y-4" [class]="columns() === 2 ? 'grid-cols-2' : 'grid-cols-3'">
        @for (figure of figures(); track figure.label; let i = $index) {
          <div class="flex min-w-0 flex-col gap-1" [class.col-span-2]="spansRow(i)">
            <dt class="order-2 text-xs text-muted-foreground">{{ figure.label }}</dt>
            <dd class="order-1 truncate text-xl font-semibold">{{ figure.value }}</dd>
            @if (figure.delta) {
              <dd class="order-3 text-xs font-semibold" [class]="toneClass(figure.tone)">
                {{ figure.delta }}
              </dd>
            }
          </div>
        }
      </dl>
    }
    <ng-content />
  `,
})
export class KeyFigures {
  readonly figures = input<readonly KeyFigure[]>([]);
  readonly columns = input<2 | 3>(3);
  /** Figures become buttons; the selected one gets a muted background. */
  readonly selectable = input(false);
  readonly selected = model(0);

  /** With two columns, an odd last figure takes the whole row instead of leaving a gap. */
  protected spansRow(index: number): boolean {
    const count = this.figures().length;
    return this.columns() === 2 && count % 2 === 1 && index === count - 1;
  }

  protected toneClass(tone: DeltaTone | undefined): string {
    return tone === 'up' ? 'text-success' : 'text-muted-foreground';
  }
}
