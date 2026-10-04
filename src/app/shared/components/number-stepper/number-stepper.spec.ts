import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import {
  clamp,
  edgeScroll,
  edgeSpeed,
  formatNumber,
  majorEvery,
  parseNumber,
  RulerFrame,
  rulerOffset,
  rulerTicks,
  rulerX,
  SCRUB_STEP_PX,
  scrubValue,
  stepValue,
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

  it('formats per locale', () => {
    expect(formatNumber(82.5, 'de', 2)).toBe('82,5');
    expect(formatNumber(82.5, 'en', 2)).toBe('82.5');
    expect(formatNumber(null, 'de', 2)).toBe('–');
  });

  describe('scrubbing', () => {
    it('labels the ruler at round numbers', () => {
      expect(majorEvery(2.5)).toBe(4); // every 10 kg
      expect(majorEvery(1)).toBe(5); // every 5 reps
      expect(majorEvery(15)).toBe(4); // every minute
    });

    it('moves one step per tick in both directions', () => {
      expect(scrubValue(80, 3, 2.5, kg)).toBe(87.5);
      expect(scrubValue(80, -3, 2.5, kg)).toBe(72.5);
      expect(scrubValue(8, 2.4, 1, kg)).toBe(10);
    });

    it('keeps the start value within half a step', () => {
      expect(scrubValue(80, 0.4, 2.5, kg)).toBe(80);
      expect(scrubValue(82.25, -0.4, 2.5, kg)).toBe(82.25);
      expect(scrubValue(null, 0.2, 1, kg)).toBeNull();
    });

    it('snaps off-grid values to the steps', () => {
      expect(scrubValue(82.25, 1, 2.5, kg)).toBe(85);
      expect(scrubValue(82.25, -1, 2.5, kg)).toBe(80);
      expect(scrubValue(132.3, 1, 2.5, { min: 0, max: 2200, decimals: 1 })).toBe(135);
    });

    it('starts an empty value at the minimum and stays within bounds', () => {
      expect(scrubValue(null, 2, 1, { min: 1, max: 20, decimals: 0 })).toBe(3);
      expect(scrubValue(5, -10, 2.5, kg)).toBe(0);
      expect(scrubValue(995, 10, 2.5, kg)).toBe(999);
    });

    const frame: RulerFrame = { base: 80, step: 2.5, originX: 100, scrollPx: 0 };

    it('maps values to screen positions and back', () => {
      expect(rulerX(80, frame)).toBe(100);
      expect(rulerX(85, frame)).toBe(100 + 2 * SCRUB_STEP_PX);
      expect(rulerX(85, { ...frame, scrollPx: 32 })).toBe(100);
      expect(rulerOffset(100 + 3 * SCRUB_STEP_PX, frame)).toBe(3);
      expect(rulerOffset(100, { ...frame, scrollPx: -32 })).toBe(-2);
    });

    it('lists the visible ticks on the grid and marks the labelled ones', () => {
      const ticks = rulerTicks(frame, 0, 200, kg);
      expect(ticks[0].value).toBe(65);
      expect(ticks.at(-1)?.value).toBe(95);
      expect(ticks.filter((t) => t.major).map((t) => t.value)).toEqual([70, 80, 90]);
      expect(ticks.find((t) => t.value === 85)?.x).toBe(132);
    });

    it('draws no ticks outside the bounds', () => {
      const ticks = rulerTicks({ ...frame, base: 5 }, 0, 200, kg);
      expect(ticks[0].value).toBe(0);
    });

    it('keeps scrolling at the screen edges, faster towards the edge', () => {
      expect(edgeSpeed(200, 393)).toBe(0);
      expect(edgeSpeed(40, 393)).toBeLessThan(0);
      expect(edgeSpeed(380, 393)).toBeGreaterThan(0);
      expect(Math.abs(edgeSpeed(2, 393))).toBeGreaterThan(Math.abs(edgeSpeed(40, 393)));
    });

    it('scrolls with elapsed time and stops at the bounds', () => {
      const atEdge = { ...frame, originX: 380 };
      expect(edgeScroll(380, 393, 100, atEdge, kg)).toBeGreaterThan(0);
      expect(edgeScroll(200, 393, 100, atEdge, kg)).toBe(0);
      // Near the minimum: 80 kg are 32 steps away, so the scroll stops there.
      const left = { ...frame, originX: 10 };
      expect(edgeScroll(10, 393, 60_000, left, kg)).toBe(-32 * SCRUB_STEP_PX);
      // Already past the minimum: the ruler is not pulled back.
      const past = { ...left, scrollPx: -40 * SCRUB_STEP_PX };
      expect(edgeScroll(10, 393, 100, past, kg)).toBe(-40 * SCRUB_STEP_PX);
    });
  });
});

describe('NumberStepper', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [NumberStepper, TranslocoTestingModule.forRoot({ langs: { de: {} } })],
    });
  });

  const setup = (value: number | null = 80, inputs: Record<string, unknown> = {}) => {
    const fixture = TestBed.createComponent(NumberStepper);
    fixture.componentRef.setInput('label', 'KG');
    fixture.componentRef.setInput('stepSize', 2.5);
    fixture.componentRef.setInput('decimals', 2);
    for (const [name, input] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, input);
    }
    fixture.componentInstance.value.set(value);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    const spin = () => host.querySelector('[role="spinbutton"]') as HTMLElement;
    const [minus, plus] = [...host.querySelectorAll('button')];
    const fire = (type: string, clientX: number, clientY = 300, target: Element = spin()) =>
      target.dispatchEvent(new MouseEvent(type, { clientX, clientY, button: 0, bubbles: true }));
    /** Press at `from`, cross the threshold at `from + 10`, then move `steps` ticks further. */
    const scrub = (steps: number, from = 300, target: Element = spin()) => {
      fire('pointerdown', from, 300, target);
      fire('pointermove', from + 10, 300, target);
      fire('pointermove', from + 10 + steps * SCRUB_STEP_PX, 300, target);
    };
    const scrubber = () => document.querySelector('app-value-scrubber');
    return { fixture, host, spin, minus, plus, fire, scrub, scrubber };
  };

  it('increments and decrements with the buttons', () => {
    const { fixture, minus, plus } = setup();
    plus.click();
    plus.click();
    minus.click();
    expect(fixture.componentInstance.value()).toBe(82.5);
  });

  it('is a spinbutton for keyboards and screen readers', () => {
    const { fixture, spin } = setup(82.5);
    expect(spin().getAttribute('aria-label')).toBe('KG');
    expect(spin().getAttribute('aria-valuenow')).toBe('82.5');
    expect(spin().getAttribute('aria-valuetext')).toBe('82.5');
    expect(spin().getAttribute('tabindex')).toBe('0');

    const key = (key: string) => {
      spin().dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
      fixture.detectChanges();
      return fixture.componentInstance.value();
    };
    expect(key('ArrowUp')).toBe(85);
    expect(key('ArrowLeft')).toBe(82.5);
    expect(key('PageUp')).toBe(92.5);
    expect(key('PageDown')).toBe(82.5);
    expect(key('Home')).toBe(0);
    expect(key('End')).toBe(9999);
    key('Enter');
    expect(fixture.nativeElement.querySelector('input')).not.toBeNull();
  });

  describe('scrubbing', () => {
    afterEach(() => document.querySelector('.cdk-overlay-container')?.remove());

    it('moves exactly one step per tick, right up and left down', () => {
      const { fixture, fire, scrub } = setup();
      scrub(3);
      expect(fixture.componentInstance.value()).toBe(87.5);
      fire('pointerup', 0);

      scrub(-5);
      expect(fixture.componentInstance.value()).toBe(75);
      fire('pointerup', 0);
    });

    it('can start on the − and + buttons, and their click after a scrub does nothing', () => {
      const { fixture, plus, fire, scrub } = setup();
      scrub(2, 300, plus);
      fire('pointerup', 0, 300, plus);
      plus.click();
      expect(fixture.componentInstance.value()).toBe(85);

      fire('pointerdown', 300, 300, plus);
      fire('pointerup', 300, 300, plus);
      plus.click();
      expect(fixture.componentInstance.value()).toBe(87.5);
    });

    it('shows the ruler only while scrubbing', async () => {
      const { fixture, fire, scrub, scrubber } = setup();
      fire('pointerdown', 300);
      fire('pointermove', 304);
      expect(scrubber()).toBeNull();

      scrub(1);
      expect(scrubber()).not.toBeNull();
      expect(scrubber()?.getAttribute('aria-hidden')).toBe('true');

      fire('pointerup', 0);
      await fixture.whenStable();
      expect(scrubber()).toBeNull();
    });

    it('still opens the text field on a tap but not after a scrub', () => {
      const { fixture, spin, fire, scrub } = setup();
      scrub(3);
      fire('pointerup', 0);
      spin().click();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('input')).toBeNull();

      fire('pointerdown', 300);
      fire('pointerup', 302);
      spin().click();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('input')).not.toBeNull();
    });

    it('ignores vertical movement', () => {
      const { fixture, fire } = setup();
      fire('pointerdown', 300, 300);
      fire('pointermove', 304, 360);
      fire('pointermove', 360, 360);
      expect(fixture.componentInstance.value()).toBe(80);
    });

    it('restores the start value on Esc and on a cancelled touch', async () => {
      const { fixture, fire, scrub, scrubber } = setup();
      scrub(4);
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      expect(fixture.componentInstance.value()).toBe(80);
      await fixture.whenStable();
      expect(scrubber()).toBeNull();
      fire('pointermove', 600); // still pressed, but the scrub is over
      expect(fixture.componentInstance.value()).toBe(80);
      fire('pointerup', 600);

      scrub(4);
      fire('pointercancel', 0);
      expect(fixture.componentInstance.value()).toBe(80);
    });

    it('keeps scrolling while the finger rests at the screen edge', () => {
      const frames: FrameRequestCallback[] = [];
      const { requestAnimationFrame, cancelAnimationFrame } = window;
      window.requestAnimationFrame = (callback) => frames.push(callback);
      window.cancelAnimationFrame = () => undefined;
      try {
        const { fixture, fire, scrub } = setup(80, { max: 100 });
        const edge = window.innerWidth - 4;
        scrub(0, edge - 30);
        fire('pointermove', edge);
        const held = fixture.componentInstance.value()!;
        for (let time = 0; time <= 3000; time += 16) {
          frames.shift()?.(time);
        }
        expect(held).toBeLessThan(100);
        expect(fixture.componentInstance.value()).toBe(100);
        fire('pointerup', edge);
      } finally {
        Object.assign(window, { requestAnimationFrame, cancelAnimationFrame });
      }
    });
  });
});
