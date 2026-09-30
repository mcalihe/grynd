import { Injectable } from '@angular/core';
import { Exercise, NewEntity } from '../models';
import { BaseRepository } from './base.repository';

const COLUMNS = [
  'key',
  'nameDe',
  'nameEn',
  'primaryMuscles',
  'secondaryMuscles',
  'muscleGroup',
  'force',
  'equipment',
  'level',
  'category',
  'images',
] as const;

/** Exercise catalog (free-exercise-db). Users never edit it; the app upserts it from the bundle. */
@Injectable({ providedIn: 'root' })
export class ExerciseRepository extends BaseRepository<Exercise> {
  constructor() {
    super('exercise', {
      columns: COLUMNS,
      json: ['primaryMuscles', 'secondaryMuscles', 'images'],
    });
  }

  async findByKey(key: string): Promise<Exercise | undefined> {
    const [row] = await this.findWhere('key = ? AND deletedAt IS NULL', [key]);
    return row;
  }

  async count(): Promise<number> {
    const [row] = await this.db.query<{ n: number }>(
      'SELECT count(*) AS n FROM exercise WHERE deletedAt IS NULL',
    );
    return row?.n ?? 0;
  }

  /**
   * Inserts or updates catalog entries by their stable id (from the bundled JSON).
   * Entries missing from the bundle are soft-deleted, so references from plans stay valid.
   */
  async upsertCatalog(items: readonly (NewEntity<Exercise> & { id: string })[]): Promise<void> {
    const now = this.clock.nowUtc();
    await this.db.transaction(async () => {
      for (const item of items) {
        const values = COLUMNS.map((column) => this.toSql(column, item[column]));
        await this.db.run(
          `INSERT INTO exercise (id, createdAt, updatedAt, deletedAt, ${COLUMNS.join(', ')})
           VALUES (?, ?, ?, NULL, ${COLUMNS.map(() => '?').join(', ')})
           ON CONFLICT (id) DO UPDATE SET
             ${COLUMNS.map((column) => `${column} = excluded.${column}`).join(', ')},
             updatedAt = excluded.updatedAt,
             deletedAt = NULL`,
          [item.id, now, now, ...values],
        );
      }
      const ids = items.map((item) => item.id);
      const rows = await this.db.query<{ id: string }>(
        'SELECT id FROM exercise WHERE deletedAt IS NULL',
      );
      for (const { id } of rows.filter((row) => !ids.includes(row.id))) {
        await this.softDelete(id);
      }
    });
  }
}
