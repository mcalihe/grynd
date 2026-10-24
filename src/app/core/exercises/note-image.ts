import { InjectionToken } from '@angular/core';

/** Photos per exercise note: enough for machine settings and form, small in storage and backups. */
export const NOTE_MAX_IMAGES = 6;
/** Longest side of a stored photo in px; a phone screen shows it sharp, the file stays small. */
export const NOTE_IMAGE_MAX_SIDE = 1600;
const JPEG_QUALITY = 0.8;

/** Size that fits within `max` on its longest side, keeping the aspect ratio; never upscales. */
export function fitWithin(
  width: number,
  height: number,
  max: number,
): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** File contents as base64, without the `data:` prefix. */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result);
      resolve(url.slice(url.indexOf(',') + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/**
 * Turns a picked image into a downscaled JPEG (base64), upright as the camera took it: an
 * `<img>` applies the EXIF orientation to its natural size and when drawn, in every web view
 * we support. Rejects when the web view cannot decode the format (e.g. HEIC on Android).
 */
export async function encodeNoteImage(file: Blob): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const { width, height } = fitWithin(
      image.naturalWidth,
      image.naturalHeight,
      NOTE_IMAGE_MAX_SIDE,
    );
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('No 2D canvas');
    }
    // JPEG has no transparency: without a fill, transparent pixels of a PNG turn black.
    context.fillStyle = 'white';
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    const jpeg = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY),
    );
    if (!jpeg) {
      throw new Error('JPEG encoding failed');
    }
    return blobToBase64(jpeg);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export type NoteImageEncoder = (file: Blob) => Promise<string>;

/** The encoder in use; unit tests swap it, since jsdom cannot decode images. */
export const NOTE_IMAGE_ENCODER = new InjectionToken<NoteImageEncoder>('NoteImageEncoder', {
  providedIn: 'root',
  factory: () => encodeNoteImage,
});
