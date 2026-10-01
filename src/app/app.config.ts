import { provideHttpClient } from '@angular/common/http';
import {
  ApplicationConfig,
  inject,
  isDevMode,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideTransloco } from '@jsverse/transloco';
import { provideIcons } from '@ng-icons/core';
import { routes } from './app.routes';
import { APP_LANGS, detectLanguage, FALLBACK_LANG } from './core/i18n/language';
import { CatalogSyncService } from './core/db/catalog-sync.service';
import { WorkoutService } from './core/workout/workout.service';
import { DatabaseService } from './core/db/database.service';
import { TranslocoHttpLoader } from './core/i18n/transloco-loader';
import { APP_ICONS } from './core/icons';
import { BackButtonService } from './core/services/back-button.service';
import { ThemeService } from './core/services/theme.service';
import { SettingsService } from './core/settings/settings.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(),
    provideIcons(APP_ICONS),
    provideAppInitializer(() => {
      // Settings first: theme and language apply before the first render.
      inject(ThemeService);
      return inject(SettingsService).init();
    }),
    provideAppInitializer(() => {
      const database = inject(DatabaseService);
      const catalog = inject(CatalogSyncService);
      const workout = inject(WorkoutService);
      return database
        .init()
        .then(() => catalog.sync())
        .then(() => workout.restore());
    }),
    provideAppInitializer(() => inject(BackButtonService).init()),
    provideTransloco({
      config: {
        availableLangs: [...APP_LANGS],
        defaultLang: detectLanguage(globalThis.navigator?.language),
        fallbackLang: FALLBACK_LANG,
        reRenderOnLangChange: true,
        prodMode: !isDevMode(),
        missingHandler: { useFallbackTranslation: true },
      },
      loader: TranslocoHttpLoader,
    }),
  ],
};
