import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import {
  clamp,
  formatNumber,
  parseNumber,
  stepValue,
  swipeStepPx,
  swipeSteps,
} from './number-stepper.logic';
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

  it('needs fewer pixels per step the faster the swipe', () => {
    expect(swipeStepPx(0)).toBe(24);
    expect(swipeStepPx(5)).toBe(4);
    expect(swipeStepPx(0.8)).toBeGreaterThan(4);
    expect(swipeStepPx(0.8)).toBeLessThan(24);
  });

  it('turns travel into whole steps in both directions and keeps the rest', () => {
    expect(swipeSteps(50, 0)).toEqual({ steps: 2, rest: 2 });
    expect(swipeSteps(-50, 0)).toEqual({ steps: -2, rest: -2 });
    expect(swipeSteps(10, 0)).toEqual({ steps: 0, rest: 10 });
    expect(swipeSteps(40, 5).steps).toBe(10);
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

  describe('swiping across the value', () => {
    const setup = () => {
      const fixture = TestBed.createComponent(NumberStepper);
      fixture.componentRef.setInput('label', 'KG');
      fixture.componentRef.setInput('stepSize', 2.5);
      fixture.componentRef.setInput('decimals', 2);
      fixture.componentInstance.value.set(80);
      fixture.detectChanges();
      const area = fixture.nativeElement.querySelector('.touch-pan-y') as HTMLElement;
      const fire = (type: string, clientX: number, clientY = 0) =>
        area.dispatchEvent(new MouseEvent(type, { clientX, clientY, button: 0, bubbles: true }));
      return { fixture, area, fire };
    };

    it('increases to the right and decreases to the left', () => {
      const { fixture, fire } = setup();
      fire('pointerdown', 100);
      fire('pointermove', 160);
      fire('pointerup', 160);
      const afterRight = fixture.componentInstance.value()!;
      expect(afterRight).toBeGreaterThan(80);

      fire('pointerdown', 160);
      fire('pointermove', 60);
      fire('pointerup', 60);
      expect(fixture.componentInstance.value()!).toBeLessThan(afterRight);
    });

    it('still opens the text field on a tap but not after a swipe', () => {
      const { fixture, area, fire } = setup();
      fire('pointerdown', 100);
      fire('pointermove', 160);
      fire('pointerup', 160);
      area.querySelector('button')!.click();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('input')).toBeNull();

      fire('pointerdown', 100);
      fire('pointerup', 102);
      area.querySelector('button')!.click();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('input')).not.toBeNull();
    });

    it('ignores vertical movement', () => {
      const { fixture, fire } = setup();
      fire('pointerdown', 100, 0);
      fire('pointermove', 104, 60);
      fire('pointermove', 160, 60);
      expect(fixture.componentInstance.value()).toBe(80);
    });
  });
});
