import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite';
import { RunResult, SqlDriver, SqlValue } from './sql-driver';

/**
 * SqlDriver on top of @capacitor-community/sqlite.
 * On the web the plugin runs on jeep-sqlite (sql.js + IndexedDB); writes are flushed with saveToStore.
 */
export class CapacitorSqliteDriver implements SqlDriver {
  private depth = 0;

  private constructor(
    private readonly sqlite: SQLiteConnection,
    private readonly db: SQLiteDBConnection,
    private readonly name: string,
    private readonly isWeb: boolean,
  ) {}

  static async open(name: string): Promise<CapacitorSqliteDriver> {
    const isWeb = Capacitor.getPlatform() === 'web';
    const sqlite = new SQLiteConnection(CapacitorSQLite);

    if (isWeb) {
      await CapacitorSqliteDriver.prepareWebStore(sqlite);
    }

    const consistency = await sqlite.checkConnectionsConsistency();
    const exists = (await sqlite.isConnection(name, false)).result;
    const db =
      consistency.result && exists
        ? await sqlite.retrieveConnection(name, false)
        : await sqlite.createConnection(name, false, 'no-encryption', 1, false);
    await db.open();
    await db.execute('PRAGMA foreign_keys = ON;', false);

    return new CapacitorSqliteDriver(sqlite, db, name, isWeb);
  }

  private static async prepareWebStore(sqlite: SQLiteConnection): Promise<void> {
    const { defineCustomElements } = await import('jeep-sqlite/loader');
    await defineCustomElements(window);
    if (!document.querySelector('jeep-sqlite')) {
      const element = document.createElement('jeep-sqlite');
      // sql-wasm.wasm is copied to /assets by angular.json.
      element.setAttribute('wasmpath', 'assets');
      document.body.appendChild(element);
    }
    await customElements.whenDefined('jeep-sqlite');
    await sqlite.initWebStore();
  }

  async execute(sql: string): Promise<void> {
    await this.db.execute(sql, this.depth === 0);
    await this.persist();
  }

  async run(sql: string, params: readonly SqlValue[] = []): Promise<RunResult> {
    const result = await this.db.run(sql, [...params], this.depth === 0);
    await this.persist();
    return { changes: result.changes?.changes ?? 0 };
  }

  async query<T>(sql: string, params: readonly SqlValue[] = []): Promise<T[]> {
    const result = await this.db.query(sql, [...params]);
    return (result.values ?? []) as T[];
  }

  async transaction<T>(work: () => Promise<T>): Promise<T> {
    if (this.depth > 0) {
      return work();
    }
    await this.db.beginTransaction();
    this.depth++;
    try {
      const result = await work();
      this.depth--;
      await this.db.commitTransaction();
      await this.persist();
      return result;
    } catch (error) {
      this.depth--;
      await this.db.rollbackTransaction();
      throw error;
    }
  }

  private async persist(): Promise<void> {
    if (this.isWeb && this.depth === 0) {
      await this.sqlite.saveToStore(this.name);
    }
  }
}
