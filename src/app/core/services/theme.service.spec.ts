import { TestBed } from '@angular/core/testing';
import { resolveTheme, ThemeService } from './theme.service';

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
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  it('defaults to system mode', () => {
    const service = TestBed.inject(ThemeService);
    expect(service.mode()).toBe('system');
  });

  it('toggles the dark class and stores the choice', () => {
    const service = TestBed.inject(ThemeService);

    service.setMode('dark');
    TestBed.tick();
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem('grynd.theme')).toBe('dark');

    service.setMode('light');
    TestBed.tick();
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('restores a stored choice', () => {
    localStorage.setItem('grynd.theme', 'dark');
    const service = TestBed.inject(ThemeService);
    expect(service.mode()).toBe('dark');
  });

  it('ignores invalid stored values', () => {
    localStorage.setItem('grynd.theme', 'purple');
    const service = TestBed.inject(ThemeService);
    expect(service.mode()).toBe('system');
  });
});
