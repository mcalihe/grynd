import { inject, Injectable } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { toast } from '@spartan-ng/brain/sonner';
import { Backup, summarizeBackup } from '../../../core/backup/backup';
import { BackupService } from '../../../core/backup/backup.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { PlanShare } from '../../../core/share/plan-share';
import { PlanShareService } from '../../../core/share/plan-share.service';

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
  private readonly plans = inject(PlanShareService);
  private readonly confirm = inject(ConfirmService);
  private readonly transloco = inject(TranslocoService);
  private undoToast?: string | number;

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
    this.offerUndo(this.transloco.translate(`settings.backup.${mode}d`), before);
    return true;
  }

  /** Shows what a shared plan brings, then adds it; false when the user cancelled. */
  async importPlans(share: PlanShare): Promise<boolean> {
    const [first] = share.plans;
    const exercises = share.plans.reduce((sum, plan) => sum + plan.exercises.length, 0);
    const confirmed = await this.confirm.confirm({
      title: share.plans.length === 1 ? 'import.plan.title' : 'import.plan.titleMany',
      message: 'import.plan.text',
      params: {
        name: first.name,
        count: share.plans.length,
        exercises,
        notes: share.notes.length,
        weightSteps: share.weightSteps.length,
      },
      confirm: 'import.plan.confirm',
      cancel: 'common.cancel',
    });
    if (!confirmed) {
      return false;
    }
    const before = await this.backups.create();
    const result = await this.plans.import(share);
    this.offerUndo(
      this.transloco.translate('import.plan.done', { name: result.names.join(', ') }),
      before,
      result.notesKept
        ? this.transloco.translate('import.plan.notesKept', {
            added: result.notesAdded,
            kept: result.notesKept,
          })
        : undefined,
    );
    return true;
  }

  /**
   * Success toast whose «Undo» puts back the data from before the import. Only the latest import
   * can be undone: an older snapshot would also throw away the newer import.
   */
  private offerUndo(message: string, before: Backup, description?: string): void {
    if (this.undoToast !== undefined) {
      toast.dismiss(this.undoToast);
    }
    this.undoToast = toast.success(message, {
      description,
      duration: UNDO_MS,
      action: {
        label: this.transloco.translate('common.undo'),
        onClick: () => {
          this.undoToast = undefined;
          this.backups.restore(before).then(
            () => toast.success(this.transloco.translate('import.undone')),
            () => toast.error(this.transloco.translate('import.undoFailed')),
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
