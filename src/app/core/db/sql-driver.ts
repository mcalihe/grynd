export type SqlValue = string | number | null;

export interface RunResult {
  changes: number;
}

/**
 * Minimal SQLite access used by migrations and repositories.
 * The app uses the Capacitor SQLite driver; unit tests use an in-memory sql.js driver.
 */
export interface SqlDriver {
  /** Runs one or more statements without parameters (DDL, PRAGMA). */
  execute(sql: string): Promise<void>;
  /** Runs a single statement with positional `?` parameters. */
  run(sql: string, params?: readonly SqlValue[]): Promise<RunResult>;
  /** Runs a SELECT and returns the rows as plain objects keyed by column name. */
  query<T>(sql: string, params?: readonly SqlValue[]): Promise<T[]>;
  /** Runs `work` in a single transaction; rolls back if it throws. Nested calls join the outer one. */
  transaction<T>(work: () => Promise<T>): Promise<T>;
}
