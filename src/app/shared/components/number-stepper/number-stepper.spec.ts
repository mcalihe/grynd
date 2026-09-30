import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { clamp, formatNumber, parseNumber, stepValue } from './number-stepper.logic';
import { NumberStepper } from './number-stepper';

const kg = { min: 0, max: 999, decimals: 2 };

describe('number stepper logic', () => {
  it('steps by the given delta within bounds', () => {
    expect(stepValue(80, 2.5, kg)).toBe(82.5);
    expect(stepValue(1, -2.5, kg)).toBe(0);
    expect(stepValue(998, 2.5, kg)).toBe(999);
  });

  it('starts an empty value at the minimum', () => {
    expect(stepValue(null, 1, { min: 0, max: 99, decimals: 0 })).toBe(1);
  });

  it('avoids floating point noise', () => {
    expect(stepValue(0.1, 0.2, kg)).toBe(0.3);
  });

  it('parses comma and dot decimals', () => {
    expect(parseNumber('82,5')).toBe(82.5);
    expect(parseNumber(' 82.5 ')).toBe(82.5);
    expect(parseNumber('')).toBeNull();
    expect(parseNumber('abc')).toBeNull();
  });

  it('clamps and rounds typed values', () => {
    expect(clamp(-5, kg)).toBe(0);
    expect(clamp(12.3456, kg)).toBe(12.35);
  });

  it('formats per locale', () => {
    expect(formatNumber(82.5, 'de', 2)).toBe('82,5');
    expect(formatNumber(82.5, 'en', 2)).toBe('82.5');
    expect(formatNumber(null, 'de', 2)).toBe('–');
  });
});

describe('NumberStepper', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [NumberStepper, TranslocoTestingModule.forRoot({ langs: { de: {} } })],
    });
  });

  it('increments and decrements with the buttons', () => {
    const fixture = TestBed.createComponent(NumberStepper);
    fixture.componentRef.setInput('label', 'KG');
    fixture.componentRef.setInput('stepSize', 2.5);
    fixture.componentRef.setInput('decimals', 2);
    fixture.componentInstance.value.set(80);
    fixture.detectChanges();

    const [minus, , plus] = fixture.nativeElement.querySelectorAll('button');
    plus.click();
    plus.click();
    minus.click();

    expect(fixture.componentInstance.value()).toBe(82.5);
  });
});
