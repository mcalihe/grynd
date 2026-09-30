import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { SqlJsDriver } from '../../../testing/sqljs-driver';
import { CATALOG_VERSION } from './catalog-version';
import { CatalogFile, DatabaseService } from './database.service';
import { ExerciseRepository } from './repositories/exercise.repository';

const catalog: CatalogFile = {
  version: CATALOG_VERSION,
  exercises: ['bench', 'squat'].map((key, i) => ({
    id: `id-${i}`,
    key,
    nameDe: key,
    nameEn: key,
    primaryMuscles: [],
    secondaryMuscles: [],
    muscleGroup: null,
    force: null,
    equipment: null,
    level: null,
    category: null,
    images: [],
  })),
};

describe('DatabaseService', () => {
  let driver: SqlJsDriver;
  let http: HttpTestingController;
  let service: DatabaseService;

  beforeEach(async () => {
    driver = await SqlJsDriver.create();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(DatabaseService);
  });

  afterEach(() => {
    http.verify();
    driver.close();
  });

  async function init(respond: boolean): Promise<void> {
    const done = service.initWith(driver);
    if (respond) {
      // The request is issued after the migrations ran.
      await vi.waitFor(() => http.expectOne('data/exercises.json').flush(catalog));
    }
    await done;
  }

  it('migrates and seeds the catalog on first start', async () => {
    await init(true);
    expect(await TestBed.inject(ExerciseRepository).count()).toBe(2);
  });

  it('does not load the catalog again when the version is unchanged', async () => {
    await init(true);
    await init(false);
    expect(await TestBed.inject(ExerciseRepository).count()).toBe(2);
  });
});
