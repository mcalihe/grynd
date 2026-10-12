import { TranslocoService } from '@jsverse/transloco';
import { toast } from '@spartan-ng/brain/sonner';
import { AddImagesResult } from '../../../core/exercises/exercise-notes.service';
import { NOTE_MAX_IMAGES } from '../../../core/exercises/note-image';

/** Tells the user about picked photos that could not be added to a note (decision 0021). */
export function toastAddImagesResult(result: AddImagesResult, transloco: TranslocoService): void {
  if (result.failed) {
    toast.error(transloco.translate('exerciseNote.imageFailed'));
  }
  if (result.skipped) {
    toast.warning(transloco.translate('exerciseNote.imageLimit', { max: NOTE_MAX_IMAGES }));
  }
}
