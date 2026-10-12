import { Provider } from '@angular/core';
import { NOTE_IMAGE_ENCODER } from '../app/core/exercises/note-image';
import { NoteImageStore } from '../app/core/exercises/note-image-store';

/** NoteImageStore in memory: `files` maps image id → base64. */
export class MemoryNoteImageStore extends NoteImageStore {
  readonly files = new Map<string, string>();

  override async write(id: string, base64: string): Promise<void> {
    this.files.set(id, base64);
  }

  override async read(id: string): Promise<string> {
    const file = this.files.get(id);
    if (file === undefined) {
      throw new Error(`No file for ${id}`);
    }
    return file;
  }

  override async src(id: string): Promise<string> {
    return `data:image/jpeg;base64,${await this.read(id)}`;
  }

  override async remove(id: string): Promise<void> {
    this.files.delete(id);
  }

  override async clear(): Promise<void> {
    this.files.clear();
  }
}

/** jsdom cannot decode images: the "JPEG" is the file's text as base64; `broken` fails. */
async function fakeEncode(file: Blob): Promise<string> {
  const text = await file.text();
  if (text === 'broken') {
    throw new Error('Cannot decode');
  }
  return btoa(text);
}

export function provideMemoryNoteImages(): Provider[] {
  return [
    { provide: NoteImageStore, useClass: MemoryNoteImageStore },
    { provide: NOTE_IMAGE_ENCODER, useValue: fakeEncode },
  ];
}
