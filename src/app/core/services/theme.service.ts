import { DOCUMENT } from '@angular/common';
import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { SettingsService, ThemeMode } from '../settings/settings.service';

export type { ThemeMode } from '../settings/settings.service';
export type ResolvedTheme = 'light' | 'dark';

export function resolveTheme(mode: ThemeMode, prefersDark: boolean): ResolvedTheme {
  if (mode === 'system') {
    return prefersDark ? 'dark' : 'light';
  }
  return mode;
}

/**
 * Applies the chosen theme by toggling `.dark` on <html> and follows the OS setting live in
 * `system` mode. The choice itself lives in the SettingsService.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly settings = inject(SettingsService);
  private readonly media = this.document.defaultView?.matchMedia?.('(prefers-color-scheme: dark)');
  private readonly prefersDark = signal(this.media?.matches ?? false);

  readonly mode = computed(() => this.settings.settings().theme);
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
    void this.settings.update({ theme: mode });
  }
}
