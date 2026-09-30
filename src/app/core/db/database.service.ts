import { HttpClient } from '@angular/common/http';
import { inject, Injectable, Injector, isDevMode } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CapacitorSqliteDriver } from './capacitor-sqlite.driver';
import { CATALOG_VERSION } from './catalog-version';
import { migrate } from './migrations';
import { Exercise, NewEntity } from './models';
import { ExerciseRepository } from './repositories/exercise.repository';
import { SqlDriver } from './sql-driver';

const DB_NAME = 'grynd';
const CATALOG_URL = 'data/exercises.json';

export interface CatalogFile {
  version: string;
  exercises: (NewEntity<Exercise> & { id: string })[];
}

/** Owns the SQLite connection: open → migrate → sync the bundled exercise catalog. */
@Injectable({ providedIn: 'root' })
export class DatabaseService {
  private readonly http = inject(HttpClient);
  private readonly injector = inject(Injector);
  private current?: SqlDriver;

  get driver(): SqlDriver {
    if (!this.current) {
      throw new Error('Database is not initialised yet.');
    }
    return this.current;
  }

  async init(): Promise<void> {
    await this.initWith(await CapacitorSqliteDriver.open(DB_NAME));
  }

  /** Separate from init() so tests can pass an in-memory driver. */
  async initWith(driver: SqlDriver): Promise<void> {
    this.current = driver;
    await migrate(driver);
    await this.syncCatalog();

    if (isDevMode()) {
      // Debug hook for the browser console: __gryndDb.query('SELECT …')
      (globalThis as { __gryndDb?: SqlDriver }).__gryndDb = driver;
    }
  }

  private async syncCatalog(): Promise<void> {
    const [row] = await this.driver.query<{ value: string }>(
      "SELECT value FROM meta WHERE key = 'catalogVersion'",
    );
    if (row?.value === CATALOG_VERSION) {
      return;
    }

    const catalog = await firstValueFrom(this.http.get<CatalogFile>(CATALOG_URL));
    // Resolved lazily: ExerciseRepository itself depends on this service.
    const exercises = this.injector.get(ExerciseRepository);
    await this.driver.transaction(async () => {
      await exercises.upsertCatalog(catalog.exercises);
      await this.driver.run(
        `INSERT INTO meta (key, value) VALUES ('catalogVersion', ?)
         ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
        [catalog.version],
      );
    });
  }
}
