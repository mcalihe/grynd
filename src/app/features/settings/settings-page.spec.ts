import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import packageJson from '../../../../package.json';
import { provideMemorySettings } from '../../../testing/settings';
import { APP_VERSION, displayVersion } from '../../core/app-info';
import { SettingsService } from '../../core/settings/settings.service';
import { SettingsPage } from './settings-page';

describe('APP_VERSION', () => {
  it('matches package.json', () => {
    expect(APP_VERSION).toBe(packageJson.version);
  });
});

describe('SettingsPage', () => {
  async function render() {
    TestBed.configureTestingModule({
      imports: [
        SettingsPage,
        TranslocoTestingModule.forRoot({
          langs: { de: {}, en: {} },
          translocoConfig: { availableLangs: ['de', 'en'], defaultLang: 'de' },
        }),
      ],
      providers: [provideMemorySettings()],
    });
    const settings = TestBed.inject(SettingsService);
    await settings.init();
    const fixture = TestBed.createComponent(SettingsPage);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const radio = (label: string) =>
      [...el.querySelectorAll<HTMLButtonElement>('[role=radio]')].find(
        (b) => b.textContent?.trim() === label,
      )!;
    return { fixture, el, settings, radio };
  }

  it('switches unit and language', async () => {
    const { settings, radio } = await render();
    radio('lb').click();
    radio('Deutsch').click();
    expect(settings.settings()).toMatchObject({ unit: 'lb', lang: 'de' });
  });

  it('turns the timer autostart off', async () => {
    const { el, settings } = await render();
    el.querySelector<HTMLButtonElement>('hlm-switch button')!.click();
    expect(settings.settings().timerAutostart).toBe(false);
  });

  it('shows the version', async () => {
    const { el } = await render();
    expect(el.textContent).toContain(`Grynd ${displayVersion()}`);
  });
});
