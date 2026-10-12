import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmBadge } from '@spartan-ng/helm/badge';
import { APP_VERSION } from '../../core/app-info';
import { releasedNotes } from '../../core/whats-new/release-notes';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { ReleaseNotesList } from '../../shared/components/whats-new/release-notes-list';

/** «Neuigkeiten» in the settings (decision 0020): every released version, newest first. */
@Component({
  selector: 'app-whats-new-page',
  imports: [PageHeader, ReleaseNotesList, HlmBadge, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-1 flex-col' },
  template: `
    <app-page-header variant="bar" (back)="back()" />

    <div class="flex flex-col gap-6 px-4 pb-6">
      <h1 class="text-display font-semibold">{{ 'whatsNew.page.title' | transloco }}</h1>

      @for (entry of releases; track entry.version) {
        <section class="flex flex-col gap-2" [attr.data-version]="entry.version">
          <div class="flex items-center gap-2">
            <h2 class="text-sm font-medium text-muted-foreground">
              {{ 'whatsNew.page.version' | transloco: { version: entry.version } }}
            </h2>
            @if (entry.version === current) {
              <span hlmBadge variant="secondary">{{ 'whatsNew.page.current' | transloco }}</span>
            }
          </div>
          <div class="rounded-xl border bg-card p-4">
            <app-release-notes-list [items]="entry.items" />
          </div>
        </section>
      }
    </div>
  `,
})
export class WhatsNewPage {
  private readonly router = inject(Router);
  private readonly location = inject(Location);

  protected readonly current = APP_VERSION;
  protected readonly releases = releasedNotes();

  /** Back to the settings, also when the page was opened directly. */
  protected back(): void {
    if (this.router.lastSuccessfulNavigation()?.previousNavigation) {
      this.location.back();
    } else {
      void this.router.navigate(['/settings']);
    }
  }
}
