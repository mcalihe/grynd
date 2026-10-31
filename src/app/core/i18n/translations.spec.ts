import de from '../../../../public/i18n/de.json';
import en from '../../../../public/i18n/en.json';

const files: Record<string, Record<string, unknown>> = { de, en };

describe('translation files', () => {
  // The app tells Transloco the files are already flat (`flatten.aot`), so a nested group would
  // show its keys instead of its texts.
  it('use flat keys with a text as every value', () => {
    for (const [lang, translation] of Object.entries(files)) {
      const nested = Object.keys(translation).filter((key) => typeof translation[key] !== 'string');
      expect(nested, lang).toEqual([]);
    }
  });

  it('never use a key as the group of another key', () => {
    for (const [lang, translation] of Object.entries(files)) {
      const keys = Object.keys(translation);
      const groups = keys.filter((key) => keys.some((other) => other.startsWith(`${key}.`)));
      expect(groups, lang).toEqual([]);
    }
  });

  it('have the same keys in every language', () => {
    expect(Object.keys(de).sort()).toEqual(Object.keys(en).sort());
  });
});
