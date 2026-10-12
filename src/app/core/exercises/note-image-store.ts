import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { blobToBase64 } from './note-image';

const FOLDER = 'note-images';
const path = (id: string) => `${FOLDER}/${id}.jpg`;

/**
 * The JPEG files of note photos (decision 0021), named after the image id, in the app's private
 * data directory: app storage on the phone, IndexedDB in the browser. Kept out of SQLite so the
 * database stays small (in the browser every write saves the whole database).
 */
@Injectable({ providedIn: 'root' })
export class NoteImageStore {
  async write(id: string, base64: string): Promise<void> {
    await Filesystem.writeFile({
      path: path(id),
      data: base64,
      directory: Directory.Data,
      recursive: true,
    });
  }

  /** The file as base64; rejects when it is missing. */
  async read(id: string): Promise<string> {
    const { data } = await Filesystem.readFile({ path: path(id), directory: Directory.Data });
    return typeof data === 'string' ? data : blobToBase64(data);
  }

  /** A URL for `<img src>`; rejects when the file is missing. */
  async src(id: string): Promise<string> {
    if (Capacitor.isNativePlatform()) {
      const { uri } = await Filesystem.stat({ path: path(id), directory: Directory.Data });
      return Capacitor.convertFileSrc(uri);
    }
    return `data:image/jpeg;base64,${await this.read(id)}`;
  }

  /** Deletes the file; one that is already gone is fine. */
  async remove(id: string): Promise<void> {
    await Filesystem.deleteFile({ path: path(id), directory: Directory.Data }).catch(
      () => undefined,
    );
  }

  /** Deletes every file, e.g. before a backup brings its own. */
  async clear(): Promise<void> {
    await Filesystem.rmdir({ path: FOLDER, directory: Directory.Data, recursive: true }).catch(
      () => undefined,
    );
  }
}
