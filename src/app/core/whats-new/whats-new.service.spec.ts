import { TestBed } from '@angular/core/testing';
import { memoryStore, provideMemorySettings } from '../../../testing/settings';
import { SqlJsDriver } from '../../../testing/sqljs-driver';
import { createTestDatabase } from '../../../testing/test-database';
import { PlanRepository } from '../db/repositories/plan.repository';
import { ReleaseNotes } from './release-notes';
import { LAST_SEEN_VERSION_KEY, RELEASE_INFO, WhatsNewService } from './whats-new.service';

const note = (version: string, count = 1): ReleaseNotes => ({
  version,
  items: Array.from({ length: count }, (_, i) => ({
    id: `${version}-${i}`,
    icon: 'lucideSparkles',
  })),
});

const NOTES = [note('0.9.0'), note('0.8.0'), note('0.7.1', 0), note('0.7.0'), note('0.6.0')];

describe('WhatsNewService', () => {
  let driver: SqlJsDriver;
  let store: ReturnType<typeof memoryStore>;

  async function setup(version: string, lastSeen?: string) {
    const db = await createTestDatabase();
    driver = db.driver;
    store = memoryStore();
    if (lastSeen !== undefined) {
      store.data.set(LAST_SEEN_VERSION_KEY, lastSeen);
    }
    TestBed.configureTestingModule({
      providers: [
        ...db.providers,
        provideMemorySettings(store),
        { provide: RELEASE_INFO, useValue: { version, notes: NOTES } },
      ],
    });
    return TestBed.inject(WhatsNewService);
  }

  const versions = (service: WhatsNewService) => service.pending().map((n) => n.version);

  afterEach(() => driver.close());

  it('shows nothing on a new install and remembers the version', async () => {
    const service = await setup('0.8.0');
    await service.check();

    expect(service.pending()).toEqual([]);
    expect(store.data.get(LAST_SEEN_VERSION_KEY)).toBe('0.8.0');
  });

  it('shows the running version to someone who installed before the popup existed', async () => {
    const service = await setup('0.8.0');
    await TestBed.inject(PlanRepository).insert({ name: 'Push', weekdays: [] });
    await service.check();

    expect(versions(service)).toEqual(['0.8.0']);
    expect(store.data.has(LAST_SEEN_VERSION_KEY)).toBe(false);
  });

  it('shows what is new after an update, including skipped versions', async () => {
    const service = await setup('0.8.0', '0.6.0');
    await service.check();

    expect(versions(service)).toEqual(['0.8.0', '0.7.0']);
    expect(service.version).toBe('0.8.0');
  });

  it('shows the popup once: closing it remembers the version', async () => {
    const service = await setup('0.8.0', '0.7.0');
    await service.check();
    await service.dismiss();

    expect(service.pending()).toEqual([]);
    expect(store.data.get(LAST_SEEN_VERSION_KEY)).toBe('0.8.0');
    await service.check();
    expect(service.pending()).toEqual([]);
  });

  it('skips a release without news but remembers it', async () => {
    const service = await setup('0.7.1', '0.7.0');
    await service.check();

    expect(service.pending()).toEqual([]);
    expect(store.data.get(LAST_SEEN_VERSION_KEY)).toBe('0.7.1');
  });

  it('ignores an older build', async () => {
    const service = await setup('0.7.0', '0.8.0');
    await service.check();

    expect(service.pending()).toEqual([]);
    expect(store.data.get(LAST_SEEN_VERSION_KEY)).toBe('0.8.0');
  });

  it('treats an unreadable value like none', async () => {
    const service = await setup('0.8.0', 'garbage');
    await service.check();

    expect(service.pending()).toEqual([]);
    expect(store.data.get(LAST_SEEN_VERSION_KEY)).toBe('0.8.0');
  });
});
