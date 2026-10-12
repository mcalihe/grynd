import { inject, Injectable, InjectionToken, signal } from '@angular/core';
import { APP_VERSION } from '../app-info';
import { PlanRepository } from '../db/repositories/plan.repository';
import { WorkoutSessionRepository } from '../db/repositories/workout.repository';
import { SETTINGS_STORE } from '../settings/settings.service';
import {
  compareVersions,
  isVersion,
  RELEASE_NOTES,
  ReleaseNotes,
  releasedNotes,
  unseenNotes,
} from './release-notes';

/** The running version and its release notes; fixed values in tests. */
export const RELEASE_INFO = new InjectionToken<{
  version: string;
  notes: readonly ReleaseNotes[];
}>('RELEASE_INFO', {
  providedIn: 'root',
  factory: () => ({ version: APP_VERSION, notes: RELEASE_NOTES }),
});

/** Last version whose news the user has seen (Capacitor Preferences, like the settings). */
export const LAST_SEEN_VERSION_KEY = 'grynd.lastSeenVersion';

/**
 * Decides once per update whether the «What's new» popup shows (decision 0020). A new install
 * starts without news; whoever installed before this feature existed (data, but no version
 * stored) gets the news of the running version.
 */
@Injectable({ providedIn: 'root' })
export class WhatsNewService {
  private readonly store = inject(SETTINGS_STORE);
  private readonly release = inject(RELEASE_INFO);
  private readonly plans = inject(PlanRepository);
  private readonly sessions = inject(WorkoutSessionRepository);
  private readonly state = signal<readonly ReleaseNotes[]>([]);

  /** The running version, shown in the popup title. */
  readonly version = this.release.version;
  /** Versions the popup has to show, newest first; empty when there is nothing new. */
  readonly pending = this.state.asReadonly();

  async check(): Promise<void> {
    const { version, notes } = this.release;
    let stored: string | null;
    try {
      stored = await this.store.get(LAST_SEEN_VERSION_KEY);
    } catch {
      return; // no storage: better no popup than one on every start
    }

    let unseen: ReleaseNotes[];
    if (stored && isVersion(stored)) {
      if (compareVersions(stored, version) >= 0) {
        return; // seen already, or an older build (previews share their storage)
      }
      unseen = unseenNotes(stored, version, notes);
    } else if (await this.hasData()) {
      unseen = releasedNotes(version, notes).filter((entry) => entry.version === version);
    } else {
      unseen = [];
    }

    if (unseen.length) {
      this.state.set(unseen);
    } else {
      await this.remember();
    }
  }

  /** The popup was closed: it does not come back until the next update. */
  async dismiss(): Promise<void> {
    this.state.set([]);
    await this.remember();
  }

  private async remember(): Promise<void> {
    try {
      await this.store.set(LAST_SEEN_VERSION_KEY, this.release.version);
    } catch {
      // Storage can be unavailable (private mode); the popup then shows once per session.
    }
  }

  private async hasData(): Promise<boolean> {
    try {
      return (await this.plans.count()) + (await this.sessions.count()) > 0;
    } catch {
      return false;
    }
  }
}
