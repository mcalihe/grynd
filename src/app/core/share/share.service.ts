import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

/** How handing something over ended; `cancelled` when the user closed the share sheet. */
export type ShareOutcome = 'shared' | 'downloaded' | 'cancelled';

/** The share sheet tells about a closed sheet only through the error message. */
const isCancel = (error: unknown) =>
  (error instanceof Error && /cancel|abort/i.test(error.message)) ||
  (error instanceof DOMException && error.name === 'AbortError');

/** Hands exports over: files via the share sheet in the app or as a download, codes via the clipboard. */
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

  /**
   * Copies a text to the clipboard; false when the web view allows neither way. Call it straight
   * from the click handler, before any other await: iOS only grants the clipboard during the tap.
   */
  async copy(text: string): Promise<boolean> {
    const clipboard = this.document.defaultView?.navigator.clipboard;
    if (clipboard) {
      try {
        await clipboard.writeText(text);
        return true;
      } catch {
        // Older web views refuse; selecting a field and copying still works there.
      }
    }
    return this.copyBySelection(text);
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

  private copyBySelection(text: string): boolean {
    const field = this.document.createElement('textarea');
    field.value = text;
    field.readOnly = true;
    field.className = 'fixed top-0 left-0 opacity-0';
    this.document.body.appendChild(field);
    field.select();
    try {
      return this.document.execCommand('copy');
    } catch {
      return false;
    } finally {
      field.remove();
    }
  }
}
