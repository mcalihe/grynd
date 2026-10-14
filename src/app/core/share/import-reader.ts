import { inject, Injectable } from '@angular/core';
import { Backup, BackupError, MAX_IMPORT_BYTES } from '../backup/backup';
import { BackupService } from '../backup/backup.service';
import { DatabaseService } from '../db/database.service';
import { isPlanShare, PlanShare, PlanShareError, validatePlanShare } from './plan-share';
import { decodeShareCode, findShareCode } from './share-code';

/** Why a file or pasted text cannot be imported; one message each (`import.errors.<error>`). */
export type ImportError =
  | 'empty'
  | 'format'
  | 'damagedCode'
  | 'newerVersion'
  | 'invalid'
  | 'missingReference'
  | 'unknownExercise'
  | 'tooLarge';

export type ImportContent =
  | { kind: 'backup'; backup: Backup }
  | { kind: 'plan'; share: PlanShare }
  | { kind: 'error'; error: ImportError };

const BACKUP_ERRORS: Record<BackupError, ImportError> = {
  format: 'format',
  newerSchema: 'newerVersion',
  invalidRow: 'invalid',
  missingReference: 'missingReference',
  unknownExercise: 'unknownExercise',
  tooLarge: 'tooLarge',
};

const PLAN_ERRORS: Record<PlanShareError, ImportError> = {
  format: 'format',
  newerVersion: 'newerVersion',
  invalid: 'invalid',
  unknownExercise: 'unknownExercise',
};

/**
 * Reads what the user wants to import, without touching the data (decision 0023): a backup or
 * shared plan as a file or pasted JSON, or a shared plan's code anywhere in a pasted text.
 */
@Injectable({ providedIn: 'root' })
export class ImportReader {
  private readonly database = inject(DatabaseService);
  private readonly backups = inject(BackupService);

  async readFile(file: Blob): Promise<ImportContent> {
    if (file.size > MAX_IMPORT_BYTES) {
      return { kind: 'error', error: 'tooLarge' };
    }
    return this.read(await file.text());
  }

  async read(text: string): Promise<ImportContent> {
    if (!text.trim()) {
      return { kind: 'error', error: 'empty' };
    }
    const code = findShareCode(text);
    const json = code === null ? text : await decodeShareCode(code);
    if (json === null) {
      return { kind: 'error', error: 'damagedCode' };
    }
    let raw: unknown;
    try {
      raw = JSON.parse(json);
    } catch {
      return { kind: 'error', error: code === null ? 'format' : 'damagedCode' };
    }

    if (isPlanShare(raw)) {
      const exercises = await this.database.driver.query<{ id: string }>('SELECT id FROM exercise');
      const result = validatePlanShare(raw, new Set(exercises.map((e) => e.id)));
      return result.ok
        ? { kind: 'plan', share: result.share }
        : { kind: 'error', error: PLAN_ERRORS[result.error] };
    }
    const result = await this.backups.validate(raw);
    return result.ok
      ? { kind: 'backup', backup: result.backup }
      : { kind: 'error', error: BACKUP_ERRORS[result.error] };
  }
}
