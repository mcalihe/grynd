import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Translation, TranslocoLoader } from '@jsverse/transloco';
import { displayVersion } from '../app-info';

/**
 * Translation files have no content hash in their name. The version in the URL changes with every
 * release and every staging or preview build, so after a deploy the browser (or a proxy) never
 * hands the new bundle an older cached copy that lacks its new keys.
 */
export function translationUrl(lang: string, version = displayVersion()): string {
  return `i18n/${lang}.json?v=${encodeURIComponent(version)}`;
}

@Injectable({ providedIn: 'root' })
export class TranslocoHttpLoader implements TranslocoLoader {
  private readonly http = inject(HttpClient);

  getTranslation(lang: string) {
    return this.http.get<Translation>(translationUrl(lang));
  }
}
