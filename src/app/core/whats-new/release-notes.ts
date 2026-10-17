import { APP_VERSION } from '../app-info';

/**
 * One change users notice. Texts live in Transloco: `releaseNotes.<id>.title` and `.text`
 * (de and en). `icon` is a Lucide icon registered in `APP_ICONS`.
 */
export interface ReleaseNoteItem {
  id: string;
  icon: string;
}

/** What's new in one version; `items` stays empty for a release without anything to tell. */
export interface ReleaseNotes {
  version: string;
  items: readonly ReleaseNoteItem[];
}

/**
 * Release notes for users (decision 0020), newest first. Written by hand with each `feat` or
 * `fix` users notice, in plain words, never generated from commits. The entry for the next
 * version may exist before its release; a test fails the release PR when its version has none.
 */
export const RELEASE_NOTES: readonly ReleaseNotes[] = [
  {
    version: '0.9.0',
    items: [{ id: 'pauseWorkout', icon: 'lucidePause' }],
  },
  {
    version: '0.8.0',
    items: [{ id: 'weightStep', icon: 'lucideWeight' }],
  },
  {
    version: '0.7.0',
    items: [
      { id: 'notePhotos', icon: 'lucideImagePlus' },
      { id: 'whatsNew', icon: 'lucideSparkles' },
    ],
  },
  {
    version: '0.6.0',
    items: [{ id: 'exerciseNotes', icon: 'lucideStickyNote' }],
  },
  {
    version: '0.5.0',
    items: [{ id: 'workoutPercent', icon: 'lucidePercent' }],
  },
  {
    version: '0.4.0',
    items: [
      { id: 'valueScrubber', icon: 'lucideRuler' },
      { id: 'setMenu', icon: 'lucideEllipsis' },
      { id: 'narrowPhones', icon: 'lucideSmartphone' },
    ],
  },
  {
    version: '0.3.0',
    items: [{ id: 'workoutClock', icon: 'lucideTimer' }],
  },
  {
    version: '0.2.0',
    items: [
      { id: 'historyStats', icon: 'lucideChartColumn' },
      { id: 'compareWorkouts', icon: 'lucideArrowLeftRight' },
      { id: 'celebrations', icon: 'lucidePartyPopper' },
    ],
  },
  {
    version: '0.1.0',
    items: [{ id: 'firstRelease', icon: 'lucideDumbbell' }],
  },
];

const VERSION = /^(\d+)\.(\d+)\.(\d+)$/;

/** Plain `major.minor.patch`, the only form release-please writes. */
export function isVersion(value: string): boolean {
  return VERSION.test(value);
}

/** Negative when `a` is older than `b`, 0 when equal, positive when newer. */
export function compareVersions(a: string, b: string): number {
  const parse = (version: string) => (VERSION.exec(version) ?? []).slice(1).map(Number);
  const [left, right] = [parse(a), parse(b)];
  for (let i = 0; i < 3; i++) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0);
    if (diff !== 0) {
      return diff;
    }
  }
  return 0;
}

/** Versions up to `appVersion` that have something to tell, newest first (the settings page). */
export function releasedNotes(
  appVersion = APP_VERSION,
  notes: readonly ReleaseNotes[] = RELEASE_NOTES,
): ReleaseNotes[] {
  return notes.filter(
    (entry) => entry.items.length > 0 && compareVersions(entry.version, appVersion) <= 0,
  );
}

/**
 * What the popup shows after an update: every version after `lastSeen` up to `appVersion` that
 * has something to tell, newest first, so versions skipped in between are not lost.
 */
export function unseenNotes(
  lastSeen: string,
  appVersion = APP_VERSION,
  notes: readonly ReleaseNotes[] = RELEASE_NOTES,
): ReleaseNotes[] {
  return releasedNotes(appVersion, notes).filter(
    (entry) => compareVersions(entry.version, lastSeen) > 0,
  );
}
