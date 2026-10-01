import { displayToKg, kgToDisplay } from './weight';

describe('weight units', () => {
  it('leaves kilograms untouched', () => {
    expect(kgToDisplay(82.5, 'kg')).toBe(82.5);
    expect(displayToKg(82.5, 'kg')).toBe(82.5);
    expect(kgToDisplay(null, 'lb')).toBeNull();
    expect(displayToKg(null, 'lb')).toBeNull();
  });

  it('shows pounds rounded to 0.1', () => {
    expect(kgToDisplay(60, 'lb')).toBe(132.3);
    expect(kgToDisplay(100, 'lb')).toBe(220.5);
  });

  it('keeps entered pound values on the way back', () => {
    for (const lb of [135, 137.5, 45, 2.5, 315]) {
      expect(kgToDisplay(displayToKg(lb, 'lb'), 'lb')).toBe(lb);
    }
    expect(displayToKg(135, 'lb')).toBeCloseTo(61.235, 3);
  });
});
