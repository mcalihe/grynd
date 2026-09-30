import { Injectable, isDevMode } from '@angular/core';
import { CapacitorSqliteDriver } from './capacitor-sqlite.driver';
import { migrate } from './migrations';
import { SqlDriver } from './sql-driver';

const DB_NAME = 'grynd';

/**
 * Owns the SQLite connection: open → migrate. Must not import repositories (they depend on
 * this service); the catalog sync lives in CatalogSyncService.
 */
@Injectable({ providedIn: 'root' })
export class DatabaseService {
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

    if (isDevMode()) {
      // Debug hook for the browser console: __gryndDb.query('SELECT …')
      (globalThis as { __gryndDb?: SqlDriver }).__gryndDb = driver;
    }
  }
}
