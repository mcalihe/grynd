import { SqlJsDriver } from '../../../testing/sqljs-driver';
import { getSchemaVersion, migrate, MIGRATIONS } from './migrations';

const TABLES = [
  'exercise',
  'exercise_interval',
  'meta',
  'plan',
  'plan_exercise',
  'session_exercise',
  'set_log',
  'workout_session',
];

describe('migrate', () => {
  let driver: SqlJsDriver;

  beforeEach(async () => {
    driver = await SqlJsDriver.create();
  });

  afterEach(() => driver.close());

  it('creates all tables on a fresh database', async () => {
    const version = await migrate(driver);

    expect(version).toBe(MIGRATIONS.at(-1)?.version);
    const tables = await driver.query<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
    );
    expect(tables.map((t) => t.name)).toEqual(TABLES);
  });

  it('is idempotent', async () => {
    await migrate(driver);
    await migrate(driver);
    expect(await getSchemaVersion(driver)).toBe(MIGRATIONS.at(-1)?.version);
  });

  it('gives every domain table id and soft-delete timestamps', async () => {
    await migrate(driver);
    for (const table of TABLES.filter((t) => t !== 'meta')) {
      const columns = await driver.query<{ name: string }>(`PRAGMA table_info(${table})`);
      expect(columns.map((c) => c.name)).toEqual(
        expect.arrayContaining(['id', 'createdAt', 'updatedAt', 'deletedAt']),
      );
    }
  });

  it('rolls back a failing migration and keeps the old version', async () => {
    await migrate(driver);
    const broken = { version: 99, statements: ['CREATE TABLE broken (x)', 'NOT VALID SQL'] };

    await expect(migrate(driver, [...MIGRATIONS, broken])).rejects.toThrow();

    expect(await getSchemaVersion(driver)).toBe(MIGRATIONS.at(-1)?.version);
    const brokenTables = await driver.query("SELECT name FROM sqlite_master WHERE name = 'broken'");
    expect(brokenTables).toEqual([]);
  });

  it('allows only one active workout session', async () => {
    await migrate(driver);
    const insert = `INSERT INTO workout_session (id, startedAt, status, createdAt, updatedAt)
      VALUES (?, '2026-01-01T00:00:00.000Z', 'active', 'x', 'x')`;
    await driver.run(insert, ['a']);
    await expect(driver.run(insert, ['b'])).rejects.toThrow();
  });
});
