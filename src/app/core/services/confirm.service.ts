import { Injectable, signal } from '@angular/core';

/** Translation keys for a confirmation dialog (Figma Dialog 66:1123). */
export interface ConfirmOptions {
  title: string;
  message?: string;
  confirm: string;
  cancel: string;
  /** Confirm button in the destructive style (discard, delete). */
  destructive?: boolean;
}

interface PendingConfirm extends ConfirmOptions {
  resolve: (confirmed: boolean) => void;
}

/**
 * Opens the app-wide confirmation dialog (ConfirmDialogHost in the app shell) and resolves
 * with the answer. Dismissing the dialog counts as "no".
 */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private readonly pending = signal<PendingConfirm | null>(null);
  readonly current = this.pending.asReadonly();

  confirm(options: ConfirmOptions): Promise<boolean> {
    this.pending()?.resolve(false);
    return new Promise((resolve) => this.pending.set({ ...options, resolve }));
  }

  answer(confirmed: boolean): void {
    const pending = this.pending();
    if (pending) {
      this.pending.set(null);
      pending.resolve(confirmed);
    }
  }
}
