import { migration001Initial } from './migrations/001-initial';
import { SqlDriver } from './sql-driver';

export interface Migration {
  version: number;
  statements: string[];
}

/** Ordered list of schema migrations. Never edit a released migration; add a new one. */
export const MIGRATIONS: readonly Migration[] = [migration001Initial];

export async function getSchemaVersion(driver: SqlDriver): Promise<number> {
  const [row] = await driver.query<{ user_version: number }>('PRAGMA user_version');
  return row?.user_version ?? 0;
}

/** Applies all migrations newer than the stored `PRAGMA user_version`, each in its own transaction. */
export async function migrate(
  driver: SqlDriver,
  migrations: readonly Migration[] = MIGRATIONS,
): Promise<number> {
  let version = await getSchemaVersion(driver);
  for (const migration of [...migrations].sort((a, b) => a.version - b.version)) {
    if (migration.version <= version) {
      continue;
    }
    await driver.transaction(async () => {
      for (const statement of migration.statements) {
        await driver.execute(statement);
      }
      await driver.execute(`PRAGMA user_version = ${migration.version}`);
    });
    version = migration.version;
  }
  return version;
}
