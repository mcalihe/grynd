import { inject, Injectable, InjectionToken, signal } from '@angular/core';
import { Preferences } from '@capacitor/preferences';
import { TranslocoService } from '@jsverse/transloco';
import { APP_LANGS, AppLang, detectLanguage } from '../i18n/language';
import { DistanceUnit } from '../units/distance';

export type ThemeMode = 'system' | 'light' | 'dark';
export type WeightUnit = 'kg' | 'lb';

export interface Settings {
  theme: ThemeMode;
  unit: WeightUnit;
  /** Kept apart from the weight unit: kg + mi and lb + km both occur (decision 0025). */
  distanceUnit: DistanceUnit;
  /** null = follow the device language until the user picks one. */
  lang: AppLang | null;
  timerAutostart: boolean;
  /** Optional, for the calorie estimate; each workout keeps the value it started with. */
  bodyWeightKg: number | null;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  unit: 'kg',
  distanceUnit: 'km',
  lang: null,
  timerAutostart: true,
  bodyWeightKg: null,
};

/** Accepted body weights in kg; anything else reads as «not set». */
export const BODY_WEIGHT_RANGE = { min: 20, max: 400 } as const;

const STORAGE_KEY = 'grynd.settings';
/** Theme key used before M7 (plain localStorage). */
const LEGACY_THEME_KEY = 'grynd.theme';

/** Key-value storage for the settings; Capacitor Preferences in the app, a fake in tests. */
export interface KeyValueStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}

export const SETTINGS_STORE = new InjectionToken<KeyValueStore>('SETTINGS_STORE', {
  providedIn: 'root',
  factory: () => ({
    get: async (key) => (await Preferences.get({ key })).value,
    set: (key, value) => Preferences.set({ key, value }),
  }),
});

/** Keeps only known values; anything else falls back to the default. */
export function parseSettings(raw: unknown): Settings {
  const value = (raw && typeof raw === 'object' ? raw : {}) as Partial<
    Record<keyof Settings, unknown>
  >;
  const pick = <T>(candidate: unknown, allowed: readonly T[], fallback: T): T =>
    allowed.includes(candidate as T) ? (candidate as T) : fallback;
  return {
    theme: pick(value.theme, ['system', 'light', 'dark'] as const, DEFAULT_SETTINGS.theme),
    unit: pick(value.unit, ['kg', 'lb'] as const, DEFAULT_SETTINGS.unit),
    distanceUnit: pick(value.distanceUnit, ['km', 'mi'] as const, DEFAULT_SETTINGS.distanceUnit),
    lang: pick<AppLang | null>(value.lang, [...APP_LANGS, null], null),
    timerAutostart:
      typeof value.timerAutostart === 'boolean'
        ? value.timerAutostart
        : DEFAULT_SETTINGS.timerAutostart,
    bodyWeightKg:
      typeof value.bodyWeightKg === 'number' &&
      value.bodyWeightKg >= BODY_WEIGHT_RANGE.min &&
      value.bodyWeightKg <= BODY_WEIGHT_RANGE.max
        ? value.bodyWeightKg
        : null,
  };
}

/**
 * User settings (plan.md §8 «Einstellungen»), loaded once by an app initializer before the
 * first render and saved on every change.
 */
@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly store = inject(SETTINGS_STORE);
  private readonly transloco = inject(TranslocoService);
  private readonly state = signal<Settings>(DEFAULT_SETTINGS);

  readonly settings = this.state.asReadonly();

  async init(): Promise<void> {
    let raw: unknown;
    try {
      const stored = await this.store.get(STORAGE_KEY);
      raw = stored ? JSON.parse(stored) : this.legacy();
    } catch {
      raw = null;
    }
    this.state.set(parseSettings(raw));
    this.applyLang();
  }

  async update(patch: Partial<Settings>): Promise<void> {
    this.state.update((current) => ({ ...current, ...patch }));
    if ('lang' in patch) {
      this.applyLang();
    }
    try {
      await this.store.set(STORAGE_KEY, JSON.stringify(this.state()));
    } catch {
      // Storage can be unavailable (private mode); the choice then lasts for this session only.
    }
  }

  /** The language in use: the chosen one or the device language. */
  activeLang(): AppLang {
    return this.state().lang ?? detectLanguage(globalThis.navigator?.language);
  }

  private applyLang(): void {
    this.transloco.setActiveLang(this.activeLang());
  }

  private legacy(): Partial<Settings> | null {
    try {
      const theme = globalThis.localStorage?.getItem(LEGACY_THEME_KEY);
      globalThis.localStorage?.removeItem(LEGACY_THEME_KEY);
      return theme ? { theme: theme as ThemeMode } : null;
    } catch {
      return null;
    }
  }
}
