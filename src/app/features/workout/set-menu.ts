import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon } from '@ng-icons/core';

/**
 * Set context menu under the row (Figma «Satzmenü-Popover» 56:49827, 208 px): duplicate or delete.
 * A transparent backdrop closes it on any outside tap. No swipe-to-delete (plan.md §8).
 */
@Component({
  selector: 'app-set-menu',
  imports: [NgIcon, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'relative block h-0', '(keydown.escape)': 'dismiss.emit()' },
  template: `
    <button
      type="button"
      class="fixed inset-0 z-20 cursor-default"
      tabindex="-1"
      [attr.aria-label]="'common.close' | transloco"
      (click)="dismiss.emit()"
    ></button>
    <div
      role="menu"
      class="absolute top-1 right-0 z-30 flex w-52 flex-col rounded-lg border bg-popover p-1 text-popover-foreground shadow-md"
    >
      <button
        type="button"
        role="menuitem"
        class="flex min-h-11 items-center gap-2 rounded-md px-3 text-sm hover:bg-accent"
        (click)="duplicate.emit()"
      >
        <ng-icon name="lucidePlus" size="16" />{{ 'workout.setMenu.duplicate' | transloco }}
      </button>
      <button
        type="button"
        role="menuitem"
        class="flex min-h-11 items-center gap-2 rounded-md px-3 text-sm text-destructive hover:bg-destructive/10"
        (click)="remove.emit()"
      >
        <ng-icon name="lucideX" size="16" />{{ 'workout.setMenu.delete' | transloco }}
      </button>
    </div>
  `,
})
export class SetMenu {
  readonly duplicate = output<void>();
  readonly remove = output<void>();
  readonly dismiss = output<void>();
}
