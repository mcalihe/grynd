import de from '../../../../public/i18n/de.json';
import en from '../../../../public/i18n/en.json';
import { APP_VERSION } from '../app-info';
import { APP_ICONS } from '../icons';
import {
  compareVersions,
  isVersion,
  RELEASE_NOTES,
  ReleaseNotes,
  releasedNotes,
  unseenNotes,
} from './release-notes';

const note = (version: string, ids: string[] = [version]): ReleaseNotes => ({
  version,
  items: ids.map((id) => ({ id, icon: 'lucideSparkles' })),
});

describe('compareVersions', () => {
  it('compares major, minor and patch as numbers', () => {
    expect(compareVersions('0.6.0', '0.6.0')).toBe(0);
    expect(compareVersions('0.6.1', '0.6.0')).toBeGreaterThan(0);
    expect(compareVersions('0.9.0', '0.10.0')).toBeLessThan(0);
    expect(compareVersions('1.0.0', '0.12.3')).toBeGreaterThan(0);
  });
});

describe('releasedNotes', () => {
  const notes = [note('0.8.0'), note('0.7.0'), note('0.6.1', []), note('0.6.0')];

  it('leaves out versions after the app version and versions without items', () => {
    expect(releasedNotes('0.7.0', notes).map((n) => n.version)).toEqual(['0.7.0', '0.6.0']);
  });
});

describe('unseenNotes', () => {
  const notes = [note('0.8.0'), note('0.7.0'), note('0.6.1', []), note('0.6.0'), note('0.5.0')];

  it('shows the versions since the last one seen, newest first', () => {
    expect(unseenNotes('0.6.0', '0.7.0', notes).map((n) => n.version)).toEqual(['0.7.0']);
    expect(unseenNotes('0.5.0', '0.7.0', notes).map((n) => n.version)).toEqual(['0.7.0', '0.6.0']);
  });

  it('is empty when nothing new was released', () => {
    expect(unseenNotes('0.7.0', '0.7.0', notes)).toEqual([]);
    expect(unseenNotes('0.6.0', '0.6.1', notes)).toEqual([]);
    expect(unseenNotes('0.9.0', '0.7.0', notes)).toEqual([]);
  });
});

describe('RELEASE_NOTES', () => {
  const versions = RELEASE_NOTES.map((entry) => entry.version);

  // Fails on the release PR when release-please bumps the version and nobody wrote the notes yet
  // (decision 0020): add the entry, with `items: []` if the release has nothing to tell users.
  it('has an entry for the app version', () => {
    expect(versions).toContain(APP_VERSION);
  });

  it('lists valid versions once, newest first', () => {
    expect(versions.filter((version) => !isVersion(version))).toEqual([]);
    const sorted = [...versions].sort((a, b) => compareVersions(b, a));
    expect(versions).toEqual(sorted);
    expect(new Set(versions).size).toBe(versions.length);
  });

  it('prepares at most the next version', () => {
    expect(versions.filter((v) => compareVersions(v, APP_VERSION) > 0).length).toBeLessThan(2);
  });

  it('uses each item id once and only registered icons', () => {
    const items = RELEASE_NOTES.flatMap((entry) => entry.items);
    expect(new Set(items.map((item) => item.id)).size).toBe(items.length);
    expect(items.filter((item) => !(item.icon in APP_ICONS))).toEqual([]);
  });

  it('has a title and a text in every language', () => {
    for (const [lang, translation] of Object.entries({ de, en })) {
      const texts: Record<string, string | undefined> = translation;
      for (const { id } of RELEASE_NOTES.flatMap((entry) => entry.items)) {
        for (const key of [`releaseNotes.${id}.title`, `releaseNotes.${id}.text`]) {
          expect(texts[key], `${lang}: ${key}`).toBeTruthy();
        }
      }
    }
  });
});
