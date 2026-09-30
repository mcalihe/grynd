import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Bottom action area for the one primary button of a screen (Figma «Sticky Aktion» 37:27886 /
 * 56:48144): full width, above the safe area. `divider` adds the top border used in the workout.
 */
@Component({
  selector: 'app-sticky-action',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class:
      'bg-background sticky bottom-0 z-10 flex flex-col gap-2 px-4 pt-2 pb-[calc(env(safe-area-inset-bottom)+16px)] [&>button]:w-full',
    '[class.border-t]': 'divider()',
    '[class.pt-4]': 'divider()',
  },
  template: `<ng-content />`,
})
export class StickyAction {
  readonly divider = input(false);
}
