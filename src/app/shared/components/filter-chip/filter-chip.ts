import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { NgIcon } from '@ng-icons/core';

/**
 * Dropdown chip for a filter group (decision 0016): label + chevron, primary while the group has
 * a selection. Its options open elsewhere (a sheet), so bind `(click)` on the host; the tap
 * target is extended to 44 px.
 */
@Component({
  selector: 'app-filter-chip',
  imports: [NgIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex shrink-0' },
  template: `
    <button
      type="button"
      aria-haspopup="dialog"
      class="relative flex h-8 items-center gap-1 rounded-full pr-2 pl-3 text-sm font-medium after:absolute after:inset-x-0 after:-inset-y-1.5"
      [class]="
        active() ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
      "
      [attr.aria-expanded]="expanded()"
    >
      <span class="max-w-40 truncate"><ng-content /></span>
      <ng-icon name="lucideChevronDown" size="16" />
    </button>
  `,
})
export class FilterChip {
  /** The group has a selection. */
  readonly active = input(false);
  /** Its options are open. */
  readonly expanded = input(false);
}
