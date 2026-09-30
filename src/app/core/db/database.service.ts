import { Injectable } from '@angular/core';
import { SqlDriver } from './sql-driver';

/** Owns the SQLite connection. `init()` (open, migrate, seed) is added in the next step. */
@Injectable({ providedIn: 'root' })
export class DatabaseService {
  private current?: SqlDriver;

  get driver(): SqlDriver {
    if (!this.current) {
      throw new Error('Database is not initialised yet.');
    }
    return this.current;
  }

  protected setDriver(driver: SqlDriver): void {
    this.current = driver;
  }
}
