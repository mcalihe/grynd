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
import { routes } from './app.routes';
import { APP_LANGS, detectLanguage, FALLBACK_LANG } from './core/i18n/language';
import { DatabaseService } from './core/db/database.service';
import { TranslocoHttpLoader } from './core/i18n/transloco-loader';
import { ThemeService } from './core/services/theme.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(),
    provideAppInitializer(() => {
      inject(ThemeService);
    }),
    provideAppInitializer(() => inject(DatabaseService).init()),
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
