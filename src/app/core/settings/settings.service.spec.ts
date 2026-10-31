import { TestBed } from '@angular/core/testing';
import { TranslocoService, TranslocoTestingModule } from '@jsverse/transloco';
import { memoryStore } from '../../../testing/settings';
import {
  DEFAULT_SETTINGS,
  parseSettings,
  SETTINGS_STORE,
  SettingsService,
} from './settings.service';

describe('parseSettings', () => {
  it('keeps valid values and falls back for everything else', () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    const valid = {
      theme: 'dark',
      unit: 'lb',
      distanceUnit: 'mi',
      lang: 'en',
      timerAutostart: false,
      bodyWeightKg: 72.5,
    };
    expect(parseSettings(valid)).toEqual(valid);
    expect(
      parseSettings({
        theme: 'purple',
        unit: 'stone',
        distanceUnit: 'furlong',
        lang: 'fr',
        timerAutostart: 'no',
        bodyWeightKg: '72',
      }),
    ).toEqual(DEFAULT_SETTINGS);
  });

  it('reads settings saved before body weight and distance unit existed', () => {
    expect(parseSettings({ theme: 'dark', unit: 'kg', lang: 'de', timerAutostart: true })).toEqual({
      ...DEFAULT_SETTINGS,
      theme: 'dark',
      lang: 'de',
    });
  });

  it('drops implausible body weights', () => {
    expect(parseSettings({ bodyWeightKg: 5 }).bodyWeightKg).toBeNull();
    expect(parseSettings({ bodyWeightKg: 1000 }).bodyWeightKg).toBeNull();
  });
});

describe('SettingsService', () => {
  let store: ReturnType<typeof memoryStore>;

  beforeEach(() => {
    localStorage.clear();
    store = memoryStore();
    TestBed.configureTestingModule({
      imports: [
        TranslocoTestingModule.forRoot({
          langs: { de: {}, en: {} },
          translocoConfig: { availableLangs: ['de', 'en'], defaultLang: 'de' },
        }),
      ],
      providers: [{ provide: SETTINGS_STORE, useValue: store }],
    });
  });

  it('starts with the defaults', async () => {
    const service = TestBed.inject(SettingsService);
    await service.init();
    expect(service.settings()).toEqual(DEFAULT_SETTINGS);
  });

  it('saves changes and restores them on the next start', async () => {
    const service = TestBed.inject(SettingsService);
    await service.init();
    await service.update({ unit: 'lb', timerAutostart: false });

    const next = TestBed.runInInjectionContext(() => new SettingsService());
    await next.init();
    expect(next.settings()).toMatchObject({ unit: 'lb', timerAutostart: false });
  });

  it('switches the language when one is chosen', async () => {
    const service = TestBed.inject(SettingsService);
    await service.init();
    await service.update({ lang: 'en' });
    expect(TestBed.inject(TranslocoService).getActiveLang()).toBe('en');
  });

  it('takes over the theme stored before settings existed', async () => {
    localStorage.setItem('grynd.theme', 'dark');
    const service = TestBed.inject(SettingsService);
    await service.init();
    expect(service.settings().theme).toBe('dark');
    expect(localStorage.getItem('grynd.theme')).toBeNull();
  });
});
