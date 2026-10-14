import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

/** How handing something over ended; `cancelled` when the user closed the share sheet. */
export type ShareOutcome = 'shared' | 'downloaded' | 'copied' | 'cancelled';

/** The share sheet tells about a closed sheet only through the error message. */
const isCancel = (error: unknown) =>
  (error instanceof Error && /cancel|abort/i.test(error.message)) ||
  (error instanceof DOMException && error.name === 'AbortError');

/** Hands files and texts to other apps: the share sheet in the app, download or clipboard on the web. */
@Injectable({ providedIn: 'root' })
export class ShareService {
  private readonly document = inject(DOCUMENT);

  /** Browser: download. App: write to the cache and open the share sheet. */
  async file(name: string, json: string): Promise<ShareOutcome> {
    if (Capacitor.isNativePlatform()) {
      const { uri } = await Filesystem.writeFile({
        path: name,
        data: json,
        directory: Directory.Cache,
        encoding: Encoding.UTF8,
      });
      return this.native(() => Share.share({ title: name, url: uri }));
    }
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const link = this.document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return 'downloaded';
  }

  /** App: share sheet. Browser: its share sheet where there is one, else the clipboard. */
  async text(text: string): Promise<ShareOutcome> {
    if (Capacitor.isNativePlatform()) {
      return this.native(() => Share.share({ text }));
    }
    const navigator = this.document.defaultView?.navigator;
    if (navigator?.share && navigator.canShare?.({ text })) {
      return this.native(() => navigator.share({ text }));
    }
    await navigator?.clipboard.writeText(text);
    return 'copied';
  }

  private async native(share: () => Promise<unknown>): Promise<ShareOutcome> {
    try {
      await share();
      return 'shared';
    } catch (error) {
      if (isCancel(error)) {
        return 'cancelled';
      }
      throw error;
    }
  }
}
