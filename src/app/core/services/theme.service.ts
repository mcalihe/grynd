import { DOCUMENT } from '@angular/common';
import { computed, effect, inject, Injectable, InjectionToken, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SettingsService, ThemeMode } from '../settings/settings.service';

export type { ThemeMode } from '../settings/settings.service';
export type ResolvedTheme = 'light' | 'dark';

/** Native status bar, null in the browser; replaced by a fake in tests. */
export const STATUS_BAR = new InjectionToken<Pick<typeof StatusBar, 'setStyle'> | null>(
  'STATUS_BAR',
  { providedIn: 'root', factory: () => (Capacitor.isNativePlatform() ? StatusBar : null) },
);

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
  private readonly statusBar = inject(STATUS_BAR);
  private readonly media = this.document.defaultView?.matchMedia?.('(prefers-color-scheme: dark)');
  private readonly prefersDark = signal(this.media?.matches ?? false);

  readonly mode = computed(() => this.settings.settings().theme);
  readonly resolved = computed(() => resolveTheme(this.mode(), this.prefersDark()));

  constructor() {
    this.media?.addEventListener('change', (event) => this.prefersDark.set(event.matches));

    effect(() => {
      const dark = this.resolved() === 'dark';
      this.document.documentElement.classList.toggle('dark', dark);
      // Style.Dark = light text for a dark background.
      this.statusBar?.setStyle({ style: dark ? Style.Dark : Style.Light }).catch(() => undefined);
    });
  }

  setMode(mode: ThemeMode): void {
    void this.settings.update({ theme: mode });
  }
}
