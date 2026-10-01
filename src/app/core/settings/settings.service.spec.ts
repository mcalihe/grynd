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
    expect(parseSettings({ theme: 'dark', unit: 'lb', lang: 'en', timerAutostart: false })).toEqual(
      { theme: 'dark', unit: 'lb', lang: 'en', timerAutostart: false },
    );
    expect(
      parseSettings({ theme: 'purple', unit: 'stone', lang: 'fr', timerAutostart: 'no' }),
    ).toEqual(DEFAULT_SETTINGS);
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
