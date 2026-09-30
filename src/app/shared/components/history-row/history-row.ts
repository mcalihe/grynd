import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { NgIcon } from '@ng-icons/core';

/** One finished workout in the history list (Figma «Trainingseintrag» 37:29769). */
@Component({
  selector: 'app-history-row',
  imports: [NgIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block border-b' },
  template: `
    <button
      type="button"
      class="flex min-h-14 w-full items-center gap-3 py-2 text-left"
      (click)="open.emit()"
    >
      <span
        class="flex size-10 shrink-0 items-center justify-center rounded-md bg-secondary text-secondary-foreground"
        aria-hidden="true"
      >
        <ng-icon name="lucideDumbbell" size="24" />
      </span>
      <span class="flex min-w-0 flex-1 flex-col gap-1">
        <span class="truncate text-sm font-semibold">{{ name() }}</span>
        <span class="truncate text-xs text-muted-foreground">{{ details() }}</span>
      </span>
    </button>
  `,
})
export class HistoryRow {
  readonly name = input.required<string>();
  readonly details = input('');

  readonly open = output<void>();
}
