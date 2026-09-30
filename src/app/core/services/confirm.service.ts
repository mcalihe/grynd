import { Injectable, signal } from '@angular/core';

/** Translation keys for a confirmation dialog (Figma Dialog 66:1123). */
export interface ConfirmOptions {
  title: string;
  message?: string;
  confirm: string;
  cancel: string;
  /** Confirm button in the destructive style (discard, delete). */
  destructive?: boolean;
  /** Optional third action between confirm and cancel (e.g. «Training verwerfen»). */
  alternative?: string;
  alternativeDestructive?: boolean;
}

/** Which button closed the dialog. Dismissing counts as 'cancel'. */
export type ConfirmChoice = 'confirm' | 'alternative' | 'cancel';

interface PendingConfirm extends ConfirmOptions {
  resolve: (choice: ConfirmChoice) => void;
}

/**
 * Opens the app-wide confirmation dialog (ConfirmDialogHost in the app shell) and resolves
 * with the answer. Dismissing the dialog counts as "no".
 */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private readonly pending = signal<PendingConfirm | null>(null);
  readonly current = this.pending.asReadonly();

  /** Yes/no dialog: true only for the confirm button. */
  async confirm(options: ConfirmOptions): Promise<boolean> {
    return (await this.choose(options)) === 'confirm';
  }

  /** Dialog with up to three actions; a newer request cancels an open one. */
  choose(options: ConfirmOptions): Promise<ConfirmChoice> {
    this.pending()?.resolve('cancel');
    return new Promise((resolve) => this.pending.set({ ...options, resolve }));
  }

  answer(choice: ConfirmChoice): void {
    const pending = this.pending();
    if (pending) {
      this.pending.set(null);
      pending.resolve(choice);
    }
  }
}
