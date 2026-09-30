import initSqlJs, { Database, SqlJsStatic } from 'sql.js';
import { RunResult, SqlDriver, SqlValue } from '../app/core/db/sql-driver';

let sqlJs: Promise<SqlJsStatic> | undefined;

function loadSqlJs(): Promise<SqlJsStatic> {
  // Tests run in Node: load the wasm file straight from node_modules.
  const cwd = (globalThis as { process?: { cwd(): string } }).process?.cwd() ?? '.';
  sqlJs ??= initSqlJs({ locateFile: (file) => `${cwd}/node_modules/sql.js/dist/${file}` });
  return sqlJs;
}

/** In-memory SqlDriver for unit tests; runs the same SQL as the app. */
export class SqlJsDriver implements SqlDriver {
  private depth = 0;

  private constructor(readonly db: Database) {}

  static async create(): Promise<SqlJsDriver> {
    const SQL = await loadSqlJs();
    const db = new SQL.Database();
    db.exec('PRAGMA foreign_keys = ON;');
    return new SqlJsDriver(db);
  }

  async execute(sql: string): Promise<void> {
    this.db.exec(sql);
  }

  async run(sql: string, params: readonly SqlValue[] = []): Promise<RunResult> {
    this.db.run(sql, [...params]);
    return { changes: this.db.getRowsModified() };
  }

  async query<T>(sql: string, params: readonly SqlValue[] = []): Promise<T[]> {
    const statement = this.db.prepare(sql, [...params]);
    const rows: T[] = [];
    while (statement.step()) {
      rows.push(statement.getAsObject() as T);
    }
    statement.free();
    return rows;
  }

  async transaction<T>(work: () => Promise<T>): Promise<T> {
    if (this.depth > 0) {
      return work();
    }
    this.db.exec('BEGIN;');
    this.depth++;
    try {
      const result = await work();
      this.depth--;
      this.db.exec('COMMIT;');
      return result;
    } catch (error) {
      this.depth--;
      this.db.exec('ROLLBACK;');
      throw error;
    }
  }

  close(): void {
    this.db.close();
  }
}
