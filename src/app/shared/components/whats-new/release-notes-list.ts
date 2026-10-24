import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon } from '@ng-icons/core';
import { ReleaseNoteItem } from '../../../core/whats-new/release-notes';
import { enter } from '../../motion/motion';

/**
 * Changes of one or more versions as a list: icon, title and a short text each (decision 0020).
 * Used by the «What's new» popup and the page in the settings.
 */
@Component({
  selector: 'app-release-notes-list',
  imports: [NgIcon, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul class="flex flex-col gap-4">
      @for (item of items(); track item.id) {
        <li class="flex items-start gap-3" data-release-note>
          <span
            class="flex size-10 shrink-0 items-center justify-center rounded-md bg-secondary text-secondary-foreground"
            aria-hidden="true"
          >
            <ng-icon [name]="item.icon" size="24" />
          </span>
          <span class="flex min-w-0 flex-col gap-0.5 pt-0.5">
            <span class="text-sm font-semibold">
              {{ 'releaseNotes.' + item.id + '.title' | transloco }}
            </span>
            <span class="text-sm text-muted-foreground">
              {{ 'releaseNotes.' + item.id + '.text' | transloco }}
            </span>
          </span>
        </li>
      }
    </ul>
  `,
})
export class ReleaseNotesList {
  readonly items = input.required<readonly ReleaseNoteItem[]>();
  /** Lets the entries rise in one after another when the list appears (the popup). */
  readonly animated = input(false);

  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    afterNextRender(() => {
      if (this.animated()) {
        void enter([...host.querySelectorAll('[data-release-note]')], {
          y: 12,
          delay: 0.15,
          each: 0.07,
        });
      }
    });
  }
}
