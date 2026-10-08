import {
  ChangeDetectionStrategy,
  Component,
  effect,
  input,
  model,
  output,
  signal,
  untracked,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmSheetImports } from '@spartan-ng/helm/sheet';
import { HlmTextarea } from '@spartan-ng/helm/textarea';
import { NOTE_MAX_LENGTH } from '../../../core/exercises/exercise-notes.service';

/**
 * Bottom sheet to write the note of an exercise (decision 0019). There is no discard step:
 * however the sheet closes («Fertig», X, tap outside), a changed text is emitted with `save`.
 */
@Component({
  selector: 'app-exercise-note-sheet',
  imports: [HlmSheetImports, HlmTextarea, HlmButton, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <hlm-sheet side="bottom" [state]="open() ? 'open' : 'closed'" (closed)="finish()">
      <hlm-sheet-content *hlmSheetPortal="let ctx" class="max-h-[85dvh]">
        <hlm-sheet-header>
          <h3 hlmSheetTitle class="pr-8 break-words">{{ title() }}</h3>
          <p hlmSheetDescription>{{ 'exerciseNote.hint' | transloco }}</p>
        </hlm-sheet-header>
        <div class="flex min-h-0 flex-col gap-3 px-4 pb-6">
          <textarea
            hlmTextarea
            class="max-h-[40dvh] min-h-28 resize-none"
            [attr.maxlength]="maxLength"
            [attr.aria-label]="'exerciseNote.label' | transloco"
            [placeholder]="'exerciseNote.placeholder' | transloco"
            [value]="draft()"
            (input)="draft.set($any($event.target).value)"
          ></textarea>
          <button hlmBtn size="lg" (click)="finish()">
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
  /** The new text when it differs from `note` (empty = delete the note). */
  readonly save = output<string>();

  protected readonly maxLength = NOTE_MAX_LENGTH;
  protected readonly draft = signal('');
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
