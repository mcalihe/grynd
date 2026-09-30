import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CATALOG_VERSION } from './catalog-version';
import { DatabaseService } from './database.service';
import { Exercise, NewEntity } from './models';
import { ExerciseRepository } from './repositories/exercise.repository';

const CATALOG_URL = 'data/exercises.json';

export interface CatalogFile {
  version: string;
  exercises: (NewEntity<Exercise> & { id: string })[];
}

/**
 * Loads the bundled exercise catalog into SQLite when CATALOG_VERSION differs from the stored
 * version (first start or app update). Runs after DatabaseService.init().
 */
@Injectable({ providedIn: 'root' })
export class CatalogSyncService {
  private readonly http = inject(HttpClient);
  private readonly database = inject(DatabaseService);
  private readonly exercises = inject(ExerciseRepository);

  async sync(): Promise<void> {
    const db = this.database.driver;
    const [row] = await db.query<{ value: string }>(
      "SELECT value FROM meta WHERE key = 'catalogVersion'",
    );
    if (row?.value === CATALOG_VERSION) {
      return;
    }

    const catalog = await firstValueFrom(this.http.get<CatalogFile>(CATALOG_URL));
    await db.transaction(async () => {
      await this.exercises.upsertCatalog(catalog.exercises);
      await db.run(
        `INSERT INTO meta (key, value) VALUES ('catalogVersion', ?)
         ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
        [catalog.version],
      );
    });
  }
}
