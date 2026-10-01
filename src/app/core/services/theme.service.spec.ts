import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { provideMemorySettings } from '../../../testing/settings';
import { SettingsService } from '../settings/settings.service';
import { resolveTheme, STATUS_BAR, ThemeService } from './theme.service';

describe('resolveTheme', () => {
  it('follows the OS preference in system mode', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });

  it('ignores the OS preference for an explicit choice', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });
});

describe('ThemeService', () => {
  const statusBar = { setStyle: vi.fn().mockResolvedValue(undefined) };

  beforeEach(() => {
    statusBar.setStyle.mockClear();
    document.documentElement.classList.remove('dark');
    TestBed.configureTestingModule({
      imports: [TranslocoTestingModule.forRoot({ langs: { de: {} } })],
      providers: [provideMemorySettings(), { provide: STATUS_BAR, useValue: statusBar }],
    });
  });

  it('defaults to system mode', () => {
    expect(TestBed.inject(ThemeService).mode()).toBe('system');
  });

  it('toggles the dark class and stores the choice in the settings', () => {
    const service = TestBed.inject(ThemeService);

    service.setMode('dark');
    TestBed.tick();
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(TestBed.inject(SettingsService).settings().theme).toBe('dark');

    service.setMode('light');
    TestBed.tick();
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('matches the native status bar text to the theme', () => {
    const service = TestBed.inject(ThemeService);
    service.setMode('dark');
    TestBed.tick();
    expect(statusBar.setStyle).toHaveBeenLastCalledWith({ style: 'DARK' });
    service.setMode('light');
    TestBed.tick();
    expect(statusBar.setStyle).toHaveBeenLastCalledWith({ style: 'LIGHT' });
  });
});
