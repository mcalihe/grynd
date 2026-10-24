import { ChangeDetectionStrategy, Component, input, linkedSignal, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon } from '@ng-icons/core';
import { HlmAlertDialogImports } from '@spartan-ng/helm/alert-dialog';
import { HlmButton } from '@spartan-ng/helm/button';
import { ReleaseNoteItem, ReleaseNotes } from '../../../core/whats-new/release-notes';
import { ReleaseNotesList } from './release-notes-list';

/**
 * «What's new» popup after an update (decision 0020), styled like the app's dialog (Figma
 * «Dialog» 9:303). Lists the changes of every version in `notes` in one list. `closed` fires
 * when the open dialog is closed, by the button or with Escape.
 */
@Component({
  selector: 'app-whats-new-dialog',
  imports: [HlmAlertDialogImports, HlmButton, NgIcon, ReleaseNotesList, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <hlm-alert-dialog [state]="open() ? 'open' : 'closed'" (closed)="close()">
      <hlm-alert-dialog-content
        *hlmAlertDialogPortal="let ctx"
        class="max-h-[85dvh] grid-rows-[auto_minmax(0,1fr)_auto]"
      >
        <hlm-alert-dialog-header>
          <div
            hlmAlertDialogMedia
            class="size-14 rounded-full bg-primary text-primary-foreground"
            aria-hidden="true"
          >
            <ng-icon name="lucideSparkles" size="28" />
          </div>
          <h2 hlmAlertDialogTitle>{{ 'whatsNew.title' | transloco: { version: version() } }}</h2>
          <p hlmAlertDialogDescription>{{ 'whatsNew.text' | transloco }}</p>
        </hlm-alert-dialog-header>
        <div class="-mx-6 min-h-0 overflow-y-auto px-6">
          <app-release-notes-list [items]="items()" [animated]="true" />
        </div>
        <button hlmBtn size="lg" data-action="close-whats-new" (click)="close()">
          {{ 'whatsNew.done' | transloco }}
        </button>
      </hlm-alert-dialog-content>
    </hlm-alert-dialog>
  `,
})
export class WhatsNewDialog {
  readonly open = input(false);
  /** The version the user just got. */
  readonly version = input.required<string>();
  /** Versions to show, newest first. */
  readonly notes = input.required<readonly ReleaseNotes[]>();

  readonly closed = output<void>();

  /** Keeps the last list while the dialog fades out after `notes` was emptied. */
  protected readonly items = linkedSignal<readonly ReleaseNotes[], readonly ReleaseNoteItem[]>({
    source: this.notes,
    computation: (notes, previous) =>
      notes.length ? notes.flatMap((entry) => entry.items) : (previous?.value ?? []),
  });

  protected close(): void {
    if (this.open()) {
      this.closed.emit();
    }
  }
}
