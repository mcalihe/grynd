import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon } from '@ng-icons/core';

/**
 * The user's note on an exercise (decision 0019), e.g. machine settings or form tips.
 * Shows up to three lines; a tap opens the editor. No Figma frame, built from tokens only.
 */
@Component({
  selector: 'app-exercise-note',
  imports: [NgIcon, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <button
      type="button"
      class="flex min-h-11 w-full items-start gap-2 rounded-lg bg-muted px-3 py-2.5 text-left text-sm"
      (click)="edit.emit()"
    >
      <ng-icon
        name="lucideStickyNote"
        size="16"
        class="mt-0.5 shrink-0 text-muted-foreground"
        aria-hidden="true"
      />
      <span class="sr-only">{{ 'exerciseNote.edit' | transloco }}:</span>
      <span class="line-clamp-3 min-w-0 flex-1 break-words whitespace-pre-line">{{ text() }}</span>
    </button>
  `,
})
export class ExerciseNote {
  readonly text = input.required<string>();
  readonly edit = output<void>();
}
