import { Provider } from '@angular/core';
import { DatabaseService } from '../app/core/db/database.service';
import { migrate } from '../app/core/db/migrations';
import { Clock } from '../app/core/utils/time';
import { SqlJsDriver } from './sqljs-driver';

/** Clock that returns a settable time; advance it to test updatedAt. */
export class FakeClock extends Clock {
  constructor(private current = new Date('2026-09-30T10:00:00.000Z')) {
    super();
  }

  override now(): Date {
    return new Date(this.current);
  }

  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
}

/** Fresh migrated in-memory database plus the providers repositories need. */
export async function createTestDatabase(): Promise<{
  driver: SqlJsDriver;
  clock: FakeClock;
  providers: Provider[];
}> {
  const driver = await SqlJsDriver.create();
  await migrate(driver);
  const clock = new FakeClock();
  return {
    driver,
    clock,
    providers: [
      { provide: DatabaseService, useValue: { driver } },
      { provide: Clock, useValue: clock },
    ],
  };
}
