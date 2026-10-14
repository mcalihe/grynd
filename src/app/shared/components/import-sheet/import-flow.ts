import { inject, Injectable } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { toast } from '@spartan-ng/brain/sonner';
import { Backup, summarizeBackup } from '../../../core/backup/backup';
import { BackupService } from '../../../core/backup/backup.service';
import { ConfirmService } from '../../../core/services/confirm.service';

/** How long «Undo» stays offered after an import. */
const UNDO_MS = 10_000;

/**
 * The steps after a file or code was read and checked (decision 0023): show what it contains,
 * ask how to import, import, and offer «Undo». Used by the import sheet on the plans and
 * settings screens.
 */
@Injectable({ providedIn: 'root' })
export class ImportFlow {
  private readonly backups = inject(BackupService);
  private readonly confirm = inject(ConfirmService);
  private readonly transloco = inject(TranslocoService);

  /** Preview, then merge (default) or replace; false when the user cancelled. */
  async importBackup(backup: Backup): Promise<boolean> {
    const summary = summarizeBackup(backup);
    const exported = Date.parse(summary.exportedAt);
    const choice = await this.confirm.choose({
      title: isNaN(exported)
        ? 'settings.backup.preview.titleUndated'
        : 'settings.backup.preview.title',
      message: 'settings.backup.preview.text',
      params: { ...summary, date: isNaN(exported) ? '' : this.dateTime(new Date(exported)) },
      confirm: 'settings.backup.preview.merge',
      alternative: 'settings.backup.preview.replace',
      alternativeDestructive: true,
      cancel: 'common.cancel',
    });
    if (choice === 'cancel') {
      return false;
    }
    const mode = choice === 'confirm' ? 'merge' : 'replace';
    const before = await this.backups.import(backup, mode);
    this.offerUndo(`settings.backup.${mode === 'merge' ? 'merged' : 'imported'}`, () =>
      this.backups.restore(before),
    );
    return true;
  }

  private offerUndo(message: string, undo: () => Promise<void>): void {
    toast.success(this.transloco.translate(message), {
      duration: UNDO_MS,
      action: {
        label: this.transloco.translate('common.undo'),
        onClick: () => {
          undo().then(
            () => toast.success(this.transloco.translate('settings.backup.undone')),
            () => toast.error(this.transloco.translate('settings.backup.undoFailed')),
          );
        },
      },
    });
  }

  private dateTime(date: Date): string {
    return new Intl.DateTimeFormat(this.transloco.getActiveLang(), {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  }
}
