import { inject } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';
import { ConfirmService } from '../../core/services/confirm.service';
import { PlanEditorStore } from './plan-editor.store';

/**
 * Asks «Änderungen verwerfen?» before leaving the plan editor with unsaved changes
 * (plan.md §8). Sits on the editor's parent route, so switching to «Übungen hinzufügen»
 * does not trigger it. Also used for the Android back button, which navigates via the router.
 */
export const unsavedChangesGuard: CanDeactivateFn<unknown> = async () => {
  const store = inject(PlanEditorStore);
  const confirm = inject(ConfirmService);

  const leave =
    !store.dirty() ||
    (await confirm.confirm({
      title: 'plans.discard.title',
      message: 'plans.discard.text',
      confirm: 'plans.discard.confirm',
      cancel: 'plans.discard.cancel',
      destructive: true,
    }));

  if (leave) {
    store.reset();
  }
  return leave;
};
