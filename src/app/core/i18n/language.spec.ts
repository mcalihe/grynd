import { detectLanguage } from './language';

describe('detectLanguage', () => {
  it('uses German for German locales', () => {
    expect(detectLanguage('de')).toBe('de');
    expect(detectLanguage('de-CH')).toBe('de');
    expect(detectLanguage('DE-at')).toBe('de');
  });

  it('uses English for English locales', () => {
    expect(detectLanguage('en-US')).toBe('en');
  });

  it('falls back to English for unsupported or missing locales', () => {
    expect(detectLanguage('fr-FR')).toBe('en');
    expect(detectLanguage('')).toBe('en');
    expect(detectLanguage(undefined)).toBe('en');
  });
});
