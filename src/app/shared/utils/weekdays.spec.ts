import { sortWeekdays, weekdayShort } from './weekdays';

describe('weekdays', () => {
  it('sorts Monday first', () => {
    expect(sortWeekdays([0, 4, 1])).toEqual([1, 4, 0]);
  });

  it('builds two-letter labels per locale', () => {
    expect([1, 2, 3, 4, 5, 6, 0].map((d) => weekdayShort(d, 'de'))).toEqual([
      'Mo',
      'Di',
      'Mi',
      'Do',
      'Fr',
      'Sa',
      'So',
    ]);
    expect(weekdayShort(1, 'en')).toBe('Mo');
    expect(weekdayShort(0, 'en')).toBe('Su');
  });
});
