import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { DatabaseService } from '../db/database.service';
import { MIGRATIONS } from '../db/migrations';
import { ExerciseNotesService } from '../exercises/exercise-notes.service';
import { NoteImageStore } from '../exercises/note-image-store';
import { ExerciseSettingsService } from '../exercises/exercise-settings.service';
import { Clock } from '../utils/time';
import { RestTimerService } from '../workout/rest-timer.service';
import { WorkoutService } from '../workout/workout.service';
import {
  Backup,
  backupFileName,
  BackupResult,
  BackupRow,
  BackupTable,
  BACKUP_TABLE_NAMES,
  buildBackup,
  tableColumns,
  validateBackup,
} from './backup';

export const SCHEMA_VERSION = Math.max(...MIGRATIONS.map((m) => m.version));

/** Export to and restore from a JSON file (plan.md §8 «Einstellungen», decision 0013). */
@Injectable({ providedIn: 'root' })
export class BackupService {
  private readonly database = inject(DatabaseService);
  private readonly workout = inject(WorkoutService);
  private readonly timer = inject(RestTimerService);
  private readonly notes = inject(ExerciseNotesService);
  private readonly imageFiles = inject(NoteImageStore);
  private readonly exerciseSettings = inject(ExerciseSettingsService);
  private readonly clock = inject(Clock);
  private readonly document = inject(DOCUMENT);

  /** All user data, including soft-deleted rows, and the files of live note photos. */
  async create(): Promise<Backup> {
    const data = {} as Record<BackupTable, BackupRow[]>;
    for (const table of BACKUP_TABLE_NAMES) {
      data[table] = await this.database.driver.query<BackupRow>(
        `SELECT ${tableColumns(table).join(', ')} FROM ${table} ORDER BY createdAt, id`,
      );
    }
    const images: Record<string, string> = {};
    const photos: BackupRow[] = [];
    for (const row of data.exercise_note_image) {
      const id = row['id'] as string;
      if (row['deletedAt'] !== null) {
        photos.push(row);
        continue;
      }
      try {
        images[id] = await this.imageFiles.read(id);
        photos.push(row);
      } catch {
        // The file is gone, so the app does not show the photo either; the backup leaves it out.
      }
    }
    data.exercise_note_image = photos;
    return buildBackup(data, SCHEMA_VERSION, this.clock.nowUtc(), images);
  }

  /** Browser: download. App: write to the cache and open the share sheet. */
  async export(): Promise<void> {
    const json = JSON.stringify(await this.create(), null, 2);
    const name = backupFileName(this.clock.now());
    if (Capacitor.isNativePlatform()) {
      const { uri } = await Filesystem.writeFile({
        path: name,
        data: json,
        directory: Directory.Cache,
        encoding: Encoding.UTF8,
      });
      await Share.share({ title: name, url: uri });
      return;
    }
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const link = this.document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /** Parses and validates file contents without touching the database. */
  async parse(text: string): Promise<BackupResult> {
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      return { ok: false, error: 'format' };
    }
    const exercises = await this.database.driver.query<{ id: string }>('SELECT id FROM exercise');
    return validateBackup(raw, SCHEMA_VERSION, new Set(exercises.map((e) => e.id)));
  }

  /** Replaces all user data with the backup in one transaction; nothing changes if it fails. */
  async restore(backup: Backup): Promise<void> {
    const driver = this.database.driver;
    await driver.transaction(async () => {
      for (const table of [...BACKUP_TABLE_NAMES].reverse()) {
        await driver.run(`DELETE FROM ${table}`);
      }
      for (const table of BACKUP_TABLE_NAMES) {
        const columns = tableColumns(table);
        const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`;
        for (const row of backup.data[table]) {
          await driver.run(
            sql,
            columns.map((column) => row[column] ?? null),
          );
        }
      }
    });
    // Files cannot join the transaction; they follow once the rows are in.
    await this.imageFiles.clear();
    for (const [id, file] of Object.entries(backup.images)) {
      await this.imageFiles.write(id, file);
    }
    await this.notes.reload();
    await this.exerciseSettings.reload();
    // A running workout may have been replaced (or brought back by the backup).
    if (!(await this.workout.restore())) {
      this.timer.stop();
    }
  }
}
