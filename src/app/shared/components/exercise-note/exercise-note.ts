import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon } from '@ng-icons/core';
import { NoteImage } from '../../../core/exercises/exercise-notes.service';
import { ImageViewerService } from '../../../core/services/image-viewer.service';

/**
 * The user's note on an exercise (decisions 0019, 0021), e.g. machine settings or form tips:
 * up to three lines of text and a row of photos. A tap on the text opens the editor, a tap on a
 * photo the image viewer. No Figma frame, built from tokens only.
 */
@Component({
  selector: 'app-exercise-note',
  imports: [NgIcon, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block rounded-lg bg-muted' },
  template: `
    <button
      type="button"
      class="flex min-h-11 w-full items-start gap-2 px-3 py-2.5 text-left text-sm"
      (click)="edit.emit()"
    >
      <ng-icon
        name="lucideStickyNote"
        size="16"
        class="mt-0.5 shrink-0 text-muted-foreground"
        aria-hidden="true"
      />
      <span class="sr-only">{{ 'exerciseNote.edit' | transloco }}:</span>
      @if (text()) {
        <span class="line-clamp-3 min-w-0 flex-1 break-words whitespace-pre-line">{{
          text()
        }}</span>
      } @else {
        <span class="text-muted-foreground">{{ 'exerciseNote.images' | transloco }}</span>
      }
    </button>
    @if (images().length) {
      <ul
        class="flex flex-wrap gap-1.5 pr-3 pb-3 pl-9"
        [attr.aria-label]="'exerciseNote.images' | transloco"
      >
        @for (image of images(); track image.id; let i = $index) {
          <li>
            <button
              type="button"
              class="block size-11 overflow-hidden rounded-md"
              [attr.aria-label]="
                'imageViewer.image' | transloco: { index: i + 1, count: images().length }
              "
              (click)="view(i)"
            >
              <img class="size-full object-cover" alt="" decoding="async" [src]="image.src" />
            </button>
          </li>
        }
      </ul>
    }
  `,
})
export class ExerciseNote {
  readonly text = input('');
  readonly images = input<readonly NoteImage[]>([]);
  readonly edit = output<void>();

  private readonly viewer = inject(ImageViewerService);

  protected view(index: number): void {
    this.viewer.open({ images: this.images(), index });
  }
}
