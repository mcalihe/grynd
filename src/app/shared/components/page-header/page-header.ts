import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon } from '@ng-icons/core';
import { HlmButton } from '@spartan-ng/helm/button';

/**
 * Top of a screen, 52 px (Figma «Seitentitel» 37:27418 / «Kopfzeile» 37:27710).
 * - `title`: large page title for the tab screens.
 * - `bar`: back arrow on the left, projected action (e.g. close or menu) on the right.
 */
@Component({
  selector: 'app-page-header',
  imports: [NgIcon, HlmButton, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex h-13 shrink-0 items-center justify-between px-4' },
  template: `
    @if (variant() === 'title') {
      <h1 class="text-2xl font-semibold">{{ title() }}</h1>
      <ng-content select="[headerAction]" />
    } @else {
      <button
        hlmBtn
        variant="ghost"
        size="sm"
        type="button"
        [attr.aria-label]="'common.back' | transloco"
        (click)="back.emit()"
      >
        <ng-icon name="lucideArrowLeft" />
      </button>
      <ng-content select="[headerAction]" />
    }
  `,
})
export class PageHeader {
  readonly variant = input<'title' | 'bar'>('title');
  readonly title = input('');

  readonly back = output<void>();
}
