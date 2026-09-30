import { DOCUMENT } from '@angular/common';
import { computed, effect, inject, Injectable, signal } from '@angular/core';

export type ThemeMode = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'grynd.theme';
const THEME_MODES: readonly ThemeMode[] = ['system', 'light', 'dark'];

export function resolveTheme(mode: ThemeMode, prefersDark: boolean): ResolvedTheme {
  if (mode === 'system') {
    return prefersDark ? 'dark' : 'light';
  }
  return mode;
}

/**
 * Applies the chosen theme by toggling `.dark` on <html> and follows the OS setting live in `system` mode.
 * The choice is kept in localStorage for now; M7 moves it to Capacitor Preferences.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly media = this.document.defaultView?.matchMedia?.('(prefers-color-scheme: dark)');
  private readonly prefersDark = signal(this.media?.matches ?? false);

  readonly mode = signal<ThemeMode>(this.readStoredMode());
  readonly resolved = computed(() => resolveTheme(this.mode(), this.prefersDark()));

  constructor() {
    this.media?.addEventListener('change', (event) => this.prefersDark.set(event.matches));

    effect(() => {
      const dark = this.resolved() === 'dark';
      this.document.documentElement.classList.toggle('dark', dark);
      // M8: update the native status bar style here.
    });
  }

  setMode(mode: ThemeMode): void {
    this.mode.set(mode);
    try {
      this.document.defaultView?.localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // Storage can be unavailable (private mode); the choice then lasts for this session only.
    }
  }

  private readStoredMode(): ThemeMode {
    try {
      const stored = this.document.defaultView?.localStorage.getItem(STORAGE_KEY);
      return THEME_MODES.find((mode) => mode === stored) ?? 'system';
    } catch {
      return 'system';
    }
  }
}
