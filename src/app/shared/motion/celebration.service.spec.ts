import { TestBed } from '@angular/core/testing';
import confetti from 'canvas-confetti';
import { HapticsService } from '../../core/services/haptics.service';
import { CelebrationService, CONFETTI_FACTORY, originOf, tokenColors } from './celebration.service';

describe('tokenColors', () => {
  it('keeps hex token values and drops the rest', () => {
    const values: Record<string, string> = {
      '--a': ' #a8db00',
      '--b': 'oklch(0.9 0.2 120)',
      '--c': '#fff',
    };
    const style = { getPropertyValue: (name: string) => values[name] ?? '' };
    expect(tokenColors(style, ['--a', '--b', '--c', '--missing'])).toEqual(['#a8db00', '#fff']);
  });
});

describe('originOf', () => {
  it('uses the centre of a rect as viewport fractions', () => {
    const rect = { left: 100, top: 400, width: 44, height: 44 } as DOMRect;
    expect(originOf(rect, { width: 400, height: 844 })).toEqual({ x: 122 / 400, y: 422 / 844 });
  });

  it('passes points through and falls back to the centre', () => {
    expect(originOf({ x: 0.2, y: 0.9 }, { width: 1, height: 1 })).toEqual({ x: 0.2, y: 0.9 });
    expect(originOf(null, { width: 1, height: 1 })).toEqual({ x: 0.5, y: 0.5 });
  });
});

describe('CelebrationService', () => {
  const fire = Object.assign(vi.fn(), { reset: vi.fn() }) as unknown as confetti.CreateTypes &
    ReturnType<typeof vi.fn>;
  const haptics = { tap: vi.fn(), success: vi.fn(), heavy: vi.fn() };
  let reduce = false;

  beforeEach(() => {
    vi.clearAllMocks();
    reduce = false;
    // jsdom has neither the Web Animations API nor matchMedia: pretend to be a real browser.
    Element.prototype.animate = vi.fn() as never;
    window.matchMedia = vi.fn(() => ({ matches: reduce })) as never;
    TestBed.configureTestingModule({
      providers: [
        { provide: CONFETTI_FACTORY, useValue: () => fire },
        { provide: HapticsService, useValue: haptics },
      ],
    });
  });

  afterEach(() => {
    delete (Element.prototype as Partial<Element>).animate;
    delete (window as Partial<Window>).matchMedia;
    vi.useRealTimers();
  });

  it('fires stars and a success buzz for a record', () => {
    TestBed.inject(CelebrationService).record({ x: 0.5, y: 0.5 });
    expect(haptics.success).toHaveBeenCalledOnce();
    expect(fire).toHaveBeenCalledWith(
      expect.objectContaining({ shapes: ['star'], origin: { x: 0.5, y: 0.5 } }),
    );
  });

  it('keeps the haptics but drops the particles with reduced motion', () => {
    reduce = true;
    const service = TestBed.inject(CelebrationService);
    service.exercise(null);
    service.sparks(null);
    expect(haptics.success).toHaveBeenCalledOnce();
    expect(fire).not.toHaveBeenCalled();
  });

  it('runs the finale on a schedule and stops it on demand', () => {
    vi.useFakeTimers();
    const stop = TestBed.inject(CelebrationService).finale();
    vi.advanceTimersByTime(500);
    expect(haptics.heavy).toHaveBeenCalledTimes(2);
    expect(fire).toHaveBeenCalledTimes(4); // two cannons, twice
    stop();
    vi.advanceTimersByTime(5000);
    expect(fire).toHaveBeenCalledTimes(4);
    expect(haptics.success).not.toHaveBeenCalled();
    expect(fire.reset).toHaveBeenCalled();
  });
});
