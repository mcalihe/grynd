import { translationUrl } from './transloco-loader';

describe('translationUrl', () => {
  it('adds the version so a new release does not reuse cached translations', () => {
    expect(translationUrl('de', '0.9.0')).toBe('i18n/de.json?v=0.9.0');
  });

  it('keeps the build label of staging and previews, encoded', () => {
    expect(translationUrl('en', '0.9.0+pr-31.abc1234')).toBe(
      'i18n/en.json?v=0.9.0%2Bpr-31.abc1234',
    );
  });
});
