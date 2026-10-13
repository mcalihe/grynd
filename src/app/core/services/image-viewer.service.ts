import { Injectable, signal } from '@angular/core';

export interface ViewerImage {
  id: string;
  src: string;
}

export interface ImageViewerRequest {
  images: readonly ViewerImage[];
  /** The image shown first. */
  index: number;
  /** Shows a delete button; called once the user confirmed. */
  onDelete?: (image: ViewerImage) => void;
}

/**
 * Opens the app-wide full-screen image viewer (ImageViewerHost in the app shell), e.g. for the
 * photos of an exercise note (decision 0021).
 */
@Injectable({ providedIn: 'root' })
export class ImageViewerService {
  private readonly request = signal<ImageViewerRequest | null>(null);
  readonly current = this.request.asReadonly();

  open(request: ImageViewerRequest): void {
    if (request.images.length) {
      this.request.set(request);
    }
  }

  close(): void {
    this.request.set(null);
  }
}
