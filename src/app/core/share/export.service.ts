import { inject, Injectable } from '@angular/core';
import { backupFileName, ExportSelection, selectBackup } from '../backup/backup';
import { BackupService } from '../backup/backup.service';
import { PlansService } from '../plans/plans.service';
import { Clock } from '../utils/time';
import { planShareFileName } from './plan-share';
import { PlanShareService } from './plan-share.service';
import { encodeShareCode } from './share-code';

/** An export ready to be copied as a code or saved as a file. */
export interface ExportResult {
  json: string;
  fileName: string;
  /** Null with photos: the code would be far too long to copy around. */
  code: string | null;
}

/**
 * Builds what the export sheet hands over (decision 0027). Without workouts it is a template:
 * the import adds the plans as copies, which suits sharing with others. With workouts it is a
 * backup of the selected plans: the import merges it, and only a complete one can replace.
 */
@Injectable({ providedIn: 'root' })
export class ExportService {
  private readonly backups = inject(BackupService);
  private readonly planShare = inject(PlanShareService);
  private readonly plans = inject(PlansService);
  private readonly clock = inject(Clock);

  async build(selection: ExportSelection): Promise<ExportResult> {
    const photos = selection.notes && selection.photos;
    const now = this.clock.now();
    let json: string;
    let fileName: string;
    if (selection.history) {
      const backup = selectBackup(await this.backups.create(), selection);
      json = JSON.stringify(backup);
      fileName = backupFileName(now, backup.complete ? 'grynd-backup' : 'grynd-export');
    } else {
      const planIds = selection.plans === 'all' ? await this.livePlanIds() : selection.plans;
      const share = await this.planShare.create(planIds, { ...selection, photos });
      json = JSON.stringify(share);
      fileName =
        share.plans.length === 1
          ? planShareFileName(share.plans[0].name)
          : backupFileName(now, 'grynd-plans');
    }
    return { json, fileName, code: photos ? null : await encodeShareCode(json) };
  }

  private async livePlanIds(): Promise<string[]> {
    await this.plans.load();
    return (this.plans.plans() ?? []).map((summary) => summary.plan.id);
  }
}
