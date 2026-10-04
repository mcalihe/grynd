import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { NgIcon } from '@ng-icons/core';
import { HlmButton } from '@spartan-ng/helm/button';

/** ‹ September 2026 › – steps through weeks, months or years (Verlauf · Kalender/Statistik). */
@Component({
  selector: 'app-period-pager',
  imports: [HlmButton, NgIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex items-center gap-2' },
  template: `
    <button
      hlmBtn
      variant="ghost"
      size="icon"
      class="data-disabled:bg-transparent data-disabled:opacity-30"
      [disabled]="!canPrevious()"
      [attr.aria-label]="previousLabel()"
      (click)="previous.emit()"
    >
      <ng-icon name="lucideChevronLeft" />
    </button>
    <p class="min-w-0 flex-1 truncate text-center text-sm font-semibold" aria-live="polite">
      {{ label() }}
    </p>
    <button
      hlmBtn
      variant="ghost"
      size="icon"
      class="data-disabled:bg-transparent data-disabled:opacity-30"
      [disabled]="!canNext()"
      [attr.aria-label]="nextLabel()"
      (click)="next.emit()"
    >
      <ng-icon name="lucideChevronRight" />
    </button>
  `,
})
export class PeriodPager {
  readonly label = input.required<string>();
  readonly previousLabel = input('');
  readonly nextLabel = input('');
  readonly canPrevious = input(true);
  /** False on the current period: there is nothing in the future. */
  readonly canNext = input(true);

  readonly previous = output<void>();
  readonly next = output<void>();
}
