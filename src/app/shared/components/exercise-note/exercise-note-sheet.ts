import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
} from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon } from '@ng-icons/core';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmSheetImports } from '@spartan-ng/helm/sheet';
import { HlmTextarea } from '@spartan-ng/helm/textarea';
import { NOTE_MAX_LENGTH, NoteImage } from '../../../core/exercises/exercise-notes.service';
import { NOTE_MAX_IMAGES } from '../../../core/exercises/note-image';
import { ImageViewerService } from '../../../core/services/image-viewer.service';

/**
 * Bottom sheet to write the note of an exercise (decision 0019) and add photos to it
 * (decision 0021). There is no discard step: however the sheet closes («Fertig», X, tap outside),
 * a changed text is emitted with `save`. Photos are picked with the system picker and stored
 * right away; tapping one opens the viewer, where it can be deleted.
 */
@Component({
  selector: 'app-exercise-note-sheet',
  imports: [HlmSheetImports, HlmTextarea, HlmButton, NgIcon, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <hlm-sheet side="bottom" [state]="open() ? 'open' : 'closed'" (closed)="finish()">
      <hlm-sheet-content *hlmSheetPortal="let ctx" class="max-h-[85dvh]">
        <hlm-sheet-header>
          <h3 hlmSheetTitle class="pr-8 break-words">{{ title() }}</h3>
          <p hlmSheetDescription>{{ 'exerciseNote.hint' | transloco }}</p>
        </hlm-sheet-header>
        <div class="flex min-h-0 flex-col gap-4 overflow-y-auto px-4 pb-6">
          <textarea
            hlmTextarea
            class="max-h-[40dvh] min-h-28 shrink-0 resize-none"
            [attr.maxlength]="maxLength"
            [attr.aria-label]="'exerciseNote.label' | transloco"
            [placeholder]="'exerciseNote.placeholder' | transloco"
            [value]="draft()"
            (input)="draft.set($any($event.target).value)"
          ></textarea>

          <section
            class="flex flex-col gap-2"
            [attr.aria-label]="'exerciseNote.images' | transloco"
          >
            <div class="flex items-baseline justify-between gap-2">
              <h4 class="text-sm font-medium">{{ 'exerciseNote.images' | transloco }}</h4>
              <span class="text-xs text-muted-foreground tabular-nums">
                {{ count() }} / {{ maxImages }}
              </span>
            </div>
            @if (count()) {
              <ul class="grid grid-cols-6 gap-2">
                @for (image of images(); track image.id; let i = $index) {
                  <li>
                    <button
                      type="button"
                      class="block aspect-square w-full overflow-hidden rounded-md"
                      [attr.aria-label]="
                        'imageViewer.image' | transloco: { index: i + 1, count: images().length }
                      "
                      (click)="view(i)"
                    >
                      <img
                        class="size-full object-cover"
                        alt=""
                        decoding="async"
                        [src]="image.src"
                      />
                    </button>
                  </li>
                }
                @for (slot of pendingSlots(); track $index) {
                  <li
                    class="aspect-square animate-pulse rounded-md bg-muted"
                    role="status"
                    [attr.aria-label]="'exerciseNote.imageLoading' | transloco"
                  ></li>
                }
              </ul>
            }
            @if (count() < maxImages) {
              <div class="flex flex-wrap gap-2">
                <button
                  hlmBtn
                  variant="secondary"
                  size="sm"
                  class="flex-1"
                  (click)="gallery.click()"
                >
                  <ng-icon name="lucideImagePlus" />{{ 'exerciseNote.chooseImages' | transloco }}
                </button>
                @if (camera) {
                  <button
                    hlmBtn
                    variant="secondary"
                    size="sm"
                    class="flex-1"
                    (click)="cameraInput.click()"
                  >
                    <ng-icon name="lucideCamera" />{{ 'exerciseNote.takePhoto' | transloco }}
                  </button>
                }
              </div>
            }
            <p class="text-xs text-muted-foreground">
              {{ 'exerciseNote.imagesHint' | transloco: { max: maxImages } }}
            </p>
            <input
              #gallery
              type="file"
              accept="image/*"
              multiple
              hidden
              (change)="picked($event)"
            />
            <input
              #cameraInput
              type="file"
              accept="image/*"
              capture="environment"
              hidden
              (change)="picked($event)"
            />
          </section>

          <button hlmBtn size="lg" class="shrink-0" (click)="finish()">
            {{ 'exerciseNote.done' | transloco }}
          </button>
        </div>
      </hlm-sheet-content>
    </hlm-sheet>
  `,
})
export class ExerciseNoteSheet {
  readonly open = model(false);
  /** Exercise name, shown as the title. */
  readonly title = input('');
  /** The saved note; the text area starts with it each time the sheet opens. */
  readonly note = input('');
  /** The saved photos of the note. */
  readonly images = input<readonly NoteImage[]>([]);
  /** Photos still being scaled down and stored, shown as placeholders. */
  readonly pending = input(0);
  /** The new text when it differs from `note` (empty = delete the note). */
  readonly save = output<string>();
  /** Picked image files, to be stored right away. */
  readonly addImages = output<File[]>();
  /** Id of a photo the user deleted in the viewer (after confirming). */
  readonly removeImage = output<string>();

  protected readonly maxLength = NOTE_MAX_LENGTH;
  protected readonly maxImages = NOTE_MAX_IMAGES;
  /**
   * The camera gets its own button on phones: Android's picker for several images (app and
   * Chrome alike) offers no camera. On a desktop browser `capture` would only open a file dialog.
   */
  protected readonly camera =
    Capacitor.isNativePlatform() || !!globalThis.matchMedia?.('(pointer: coarse)').matches;
  protected readonly draft = signal('');
  protected readonly count = computed(() => this.images().length + this.pending());
  protected readonly pendingSlots = computed(() => Array.from({ length: this.pending() }));
  private readonly viewer = inject(ImageViewerService);
  private editing = false;

  constructor() {
    effect(() => {
      if (this.open()) {
        untracked(() => {
          this.draft.set(this.note());
          this.editing = true;
        });
      }
    });
  }

  protected picked(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = [...(input.files ?? [])];
    // Reset, so picking the same file again still fires `change`.
    input.value = '';
    if (files.length) {
      this.addImages.emit(files);
    }
  }

  protected view(index: number): void {
    this.viewer.open({
      images: this.images(),
      index,
      onDelete: (image) => this.removeImage.emit(image.id),
    });
  }

  /** Closes the sheet and saves once, whichever way it was closed. */
  protected finish(): void {
    if (this.editing) {
      this.editing = false;
      if (this.draft().trim() !== this.note().trim()) {
        this.save.emit(this.draft());
      }
    }
    this.open.set(false);
  }
}
