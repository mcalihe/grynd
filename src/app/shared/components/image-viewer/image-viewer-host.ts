import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  linkedSignal,
  signal,
  viewChild,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon } from '@ng-icons/core';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmDialogImports } from '@spartan-ng/helm/dialog';
import { ConfirmService } from '../../../core/services/confirm.service';
import {
  ImageViewerRequest,
  ImageViewerService,
} from '../../../core/services/image-viewer.service';

/**
 * Renders ImageViewerService requests full screen: swipe between the images (scroll snap, like
 * the workout pager), counter, close and – when the request allows it – delete after a
 * confirmation. Lives in the app shell. No Figma frame, built from tokens only (decision 0021).
 */
@Component({
  selector: 'app-image-viewer-host',
  imports: [HlmDialogImports, HlmButton, NgIcon, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <hlm-dialog [state]="viewer.current() ? 'open' : 'closed'" (closed)="viewer.close()">
      <hlm-dialog-content
        *hlmDialogPortal="let ctx"
        [showCloseButton]="false"
        class="flex h-dvh w-screen max-w-none flex-col gap-0 rounded-none bg-background p-0 pt-safe px-safe pb-[env(safe-area-inset-bottom)] text-foreground ring-0 sm:max-w-none"
      >
        @if (viewer.current(); as request) {
          <header class="flex items-center gap-2 px-2 py-2">
            <button
              hlmBtn
              variant="ghost"
              size="icon"
              [attr.aria-label]="'common.close' | transloco"
              (click)="viewer.close()"
            >
              <ng-icon name="lucideX" />
            </button>
            <h2 hlmDialogTitle class="flex-1 text-center text-sm font-semibold tabular-nums">
              {{
                'imageViewer.position' | transloco: { index: index() + 1, count: images().length }
              }}
            </h2>
            @if (request.onDelete) {
              <button
                hlmBtn
                variant="ghost"
                size="icon"
                [attr.aria-label]="'imageViewer.delete' | transloco"
                (click)="remove(request)"
              >
                <ng-icon name="lucideTrash2" />
              </button>
            } @else {
              <span class="size-11" aria-hidden="true"></span>
            }
          </header>
          <div
            #track
            class="flex min-h-0 flex-1 snap-x snap-mandatory [scrollbar-width:none] overflow-x-auto overscroll-x-contain"
            (scroll)="onScroll()"
          >
            @for (image of images(); track image.id; let i = $index) {
              <div
                class="flex w-full shrink-0 snap-center snap-always items-center justify-center p-4"
              >
                <img
                  class="max-h-full max-w-full rounded-lg object-contain"
                  decoding="async"
                  [src]="image.src"
                  [alt]="'imageViewer.image' | transloco: { index: i + 1, count: images().length }"
                />
              </div>
            }
          </div>
        }
      </hlm-dialog-content>
    </hlm-dialog>
  `,
})
export class ImageViewerHost {
  protected readonly viewer = inject(ImageViewerService);
  private readonly confirm = inject(ConfirmService);
  private readonly track = viewChild<ElementRef<HTMLElement>>('track');

  /** The request's images, minus the ones deleted while the viewer is open. */
  protected readonly images = linkedSignal(() => this.viewer.current()?.images ?? []);
  private readonly position = signal(0);
  protected readonly index = computed(() =>
    Math.min(this.position(), Math.max(0, this.images().length - 1)),
  );
  /** The request whose start image is already scrolled into view. */
  private shown: ImageViewerRequest | null = null;

  constructor() {
    afterRenderEffect(() => {
      const request = this.viewer.current();
      const track = this.track()?.nativeElement;
      if (request && track && this.shown !== request) {
        this.shown = request;
        this.position.set(request.index);
        track.scrollLeft = request.index * track.clientWidth;
      }
    });
  }

  protected onScroll(): void {
    const track = this.track()?.nativeElement;
    if (track?.clientWidth) {
      this.position.set(Math.round(track.scrollLeft / track.clientWidth));
    }
  }

  protected async remove(request: ImageViewerRequest): Promise<void> {
    const image = this.images()[this.index()];
    const confirmed = await this.confirm.confirm({
      title: 'imageViewer.deleteConfirm.title',
      message: 'imageViewer.deleteConfirm.text',
      confirm: 'imageViewer.deleteConfirm.confirm',
      cancel: 'common.cancel',
      destructive: true,
    });
    if (!confirmed || !image || this.viewer.current() !== request) {
      return;
    }
    request.onDelete?.(image);
    const rest = this.images().filter((other) => other.id !== image.id);
    if (rest.length) {
      this.images.set(rest);
    } else {
      this.viewer.close();
    }
  }
}
