import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
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
      providers: [provideMemorySettings(), provideRouter([])],
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

  it('switches the distance unit', async () => {
    const { settings, radio } = await render();
    radio('mi').click();
    expect(settings.settings().distanceUnit).toBe('mi');
  });

  it('sets and clears the body weight in the chosen unit (decision 0025)', async () => {
    const { fixture, el, settings } = await render();
    const card = () => el.querySelector<HTMLElement>('[data-setting=body-weight]')!;
    const plus = () => card().querySelectorAll<HTMLButtonElement>('app-number-stepper button')[1];

    plus().click(); // empty → 75 kg
    expect(settings.settings().bodyWeightKg).toBe(75);
    plus().click();
    expect(settings.settings().bodyWeightKg).toBe(75.5);

    await settings.update({ unit: 'lb' });
    fixture.detectChanges();
    expect(card().textContent).toMatch(/166[.,]4/);

    card().querySelector<HTMLElement>('[role=spinbutton]')!.click();
    fixture.detectChanges();
    const field = card().querySelector('input')!;
    field.value = '';
    field.dispatchEvent(new Event('blur'));
    expect(settings.settings().bodyWeightKg).toBeNull();
  });

  it('turns the timer autostart off', async () => {
    const { el, settings } = await render();
    el.querySelector<HTMLButtonElement>('hlm-switch button')!.click();
    expect(settings.settings().timerAutostart).toBe(false);
  });

  it('links to the release notes', async () => {
    const { el } = await render();
    const link = el.querySelector<HTMLAnchorElement>('[data-action=whats-new]')!;
    expect(link.getAttribute('href')).toBe('/settings/whats-new');
  });

  it('shows the version', async () => {
    const { el } = await render();
    expect(el.textContent).toContain(`Grynd ${displayVersion()}`);
  });
});
