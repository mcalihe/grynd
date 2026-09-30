import { TestBed } from '@angular/core/testing';
import { Exercise, NewEntity } from '../app/core/db/models';
import { ExerciseRepository } from '../app/core/db/repositories/exercise.repository';

export type CatalogEntry = NewEntity<Exercise> & { id: string };

export function catalogEntry(
  id: string,
  key: string,
  overrides: Partial<CatalogEntry> = {},
): CatalogEntry {
  return {
    id,
    key,
    nameDe: key,
    nameEn: key,
    primaryMuscles: ['chest'],
    secondaryMuscles: [],
    muscleGroup: 'chest',
    force: 'push',
    equipment: 'barbell',
    level: 'beginner',
    category: 'strength',
    images: [`exercises/${key}.webp`],
    ...overrides,
  };
}

/** Upserts catalog entries through the repository (needs createTestDatabase providers). */
export async function seedCatalog(entries: CatalogEntry[]): Promise<void> {
  await TestBed.inject(ExerciseRepository).upsertCatalog(entries);
}
