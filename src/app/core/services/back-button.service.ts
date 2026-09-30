import { Location } from '@angular/common';
import { inject, Injectable, NgZone } from '@angular/core';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { ConfirmService } from './confirm.service';

/** Screens where the Android back button leaves the app instead of navigating back. */
const ROOT_PATHS = ['/plans', '/history', '/settings'];

/**
 * Android hardware back button: closes an open dialog first, otherwise navigates back through
 * the router (so CanDeactivate guards such as the unsaved-changes guard apply).
 */
@Injectable({ providedIn: 'root' })
export class BackButtonService {
  private readonly location = inject(Location);
  private readonly confirm = inject(ConfirmService);
  private readonly zone = inject(NgZone);

  init(): void {
    if (Capacitor.getPlatform() !== 'android') {
      return;
    }
    void App.addListener('backButton', () => this.zone.run(() => this.handle()));
  }

  handle(): void {
    if (this.confirm.current()) {
      this.confirm.answer(false);
    } else if (ROOT_PATHS.includes(this.location.path())) {
      void App.minimizeApp();
    } else {
      this.location.back();
    }
  }
}
