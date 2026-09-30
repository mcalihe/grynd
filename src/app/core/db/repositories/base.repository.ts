import { inject } from '@angular/core';
import { Clock } from '../../utils/time';
import { uuid7 } from '../../utils/uuid7';
import { DatabaseService } from '../database.service';
import { BaseEntity, EntityPatch, NewEntity } from '../models';
import { SqlDriver, SqlValue } from '../sql-driver';

export interface ColumnSpec<T> {
  /** Domain columns in insert order (id and timestamps are added automatically). */
  columns: readonly (Exclude<keyof T, keyof BaseEntity> & string)[];
  /** Columns stored as JSON text (arrays). */
  json?: readonly string[];
  /** Columns stored as 0/1. */
  boolean?: readonly string[];
}

const BASE_COLUMNS = ['id', 'createdAt', 'updatedAt', 'deletedAt'] as const;

/**
 * Shared CRUD for all tables: UUIDv7 ids, UTC timestamps, soft delete.
 * Reads skip soft-deleted rows unless asked otherwise.
 */
export abstract class BaseRepository<T extends BaseEntity> {
  protected readonly database = inject(DatabaseService);
  protected readonly clock = inject(Clock);

  protected constructor(
    protected readonly table: string,
    private readonly spec: ColumnSpec<T>,
  ) {}

  protected get db(): SqlDriver {
    return this.database.driver;
  }

  async insert(data: NewEntity<T>): Promise<T> {
    const now = this.clock.nowUtc();
    const entity = {
      ...data,
      id: data.id ?? uuid7(),
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    } as unknown as T;
    const columns = [...BASE_COLUMNS, ...this.spec.columns];
    await this.db.run(
      `INSERT INTO ${this.table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
      columns.map((column) => this.toSql(column, (entity as Record<string, unknown>)[column])),
    );
    return entity;
  }

  async insertMany(items: readonly NewEntity<T>[]): Promise<T[]> {
    return this.db.transaction(async () => {
      const result: T[] = [];
      for (const item of items) {
        result.push(await this.insert(item));
      }
      return result;
    });
  }

  async update(id: string, patch: EntityPatch<T>): Promise<T> {
    const entries = Object.entries(patch).filter(([key]) =>
      (this.spec.columns as readonly string[]).includes(key),
    );
    const assignments = [...entries.map(([key]) => `${key} = ?`), 'updatedAt = ?'];
    const { changes } = await this.db.run(
      `UPDATE ${this.table} SET ${assignments.join(', ')} WHERE id = ? AND deletedAt IS NULL`,
      [...entries.map(([key, value]) => this.toSql(key, value)), this.clock.nowUtc(), id],
    );
    if (changes === 0) {
      throw new Error(`${this.table} ${id} not found`);
    }
    return (await this.findById(id)) as T;
  }

  async softDelete(id: string): Promise<void> {
    const now = this.clock.nowUtc();
    await this.db.run(
      `UPDATE ${this.table} SET deletedAt = ?, updatedAt = ? WHERE id = ? AND deletedAt IS NULL`,
      [now, now, id],
    );
  }

  async findById(id: string, options: { includeDeleted?: boolean } = {}): Promise<T | undefined> {
    const [row] = await this.findWhere(
      options.includeDeleted ? 'id = ?' : 'id = ? AND deletedAt IS NULL',
      [id],
    );
    return row;
  }

  async findAll(orderBy = 'createdAt'): Promise<T[]> {
    return this.findWhere('deletedAt IS NULL', [], orderBy);
  }

  protected async findWhere(
    where: string,
    params: readonly SqlValue[] = [],
    orderBy?: string,
    limit?: number,
  ): Promise<T[]> {
    const sql = [
      `SELECT * FROM ${this.table} WHERE ${where}`,
      orderBy ? `ORDER BY ${orderBy}` : '',
      limit ? `LIMIT ${Math.floor(limit)}` : '',
    ].join(' ');
    const rows = await this.db.query<Record<string, SqlValue>>(sql, params);
    return rows.map((row) => this.fromRow(row));
  }

  protected toSql(column: string, value: unknown): SqlValue {
    if (value === undefined || value === null) {
      return null;
    }
    if (this.spec.json?.includes(column)) {
      return JSON.stringify(value);
    }
    if (this.spec.boolean?.includes(column)) {
      return value ? 1 : 0;
    }
    return value as SqlValue;
  }

  protected fromRow(row: Record<string, SqlValue>): T {
    const entity: Record<string, unknown> = { ...row };
    for (const column of this.spec.json ?? []) {
      entity[column] = row[column] == null ? [] : JSON.parse(String(row[column]));
    }
    for (const column of this.spec.boolean ?? []) {
      entity[column] = row[column] === 1;
    }
    return entity as T;
  }
}
