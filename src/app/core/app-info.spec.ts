import { displayTitle, displayVersion } from './app-info';

describe('displayVersion', () => {
  it('shows a release as the plain version', () => {
    expect(displayVersion('0.4.0', '')).toBe('0.4.0');
  });

  it('adds the build label as build metadata', () => {
    expect(displayVersion('0.4.0', 'dev')).toBe('0.4.0+dev');
    expect(displayVersion('0.4.0', 'main.abc1234')).toBe('0.4.0+main.abc1234');
    expect(displayVersion('0.4.0', 'pr-31.abc1234')).toBe('0.4.0+pr-31.abc1234');
  });
});

describe('displayTitle', () => {
  it('keeps the title of a release', () => {
    expect(displayTitle('Grynd', '')).toBe('Grynd');
  });

  it('puts the channel without the commit in front', () => {
    expect(displayTitle('Grynd', 'dev')).toBe('dev · Grynd');
    expect(displayTitle('Grynd', 'main.abc1234')).toBe('main · Grynd');
    expect(displayTitle('Grynd', 'pr-31.abc1234')).toBe('pr-31 · Grynd');
  });
});
