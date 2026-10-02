import { TestBed } from '@angular/core/testing';
import { HapticsService } from './haptics.service';

describe('HapticsService in the browser', () => {
  afterEach(() => vi.restoreAllMocks());

  it('does nothing and never throws without the native plugin', () => {
    const service = TestBed.inject(HapticsService);
    expect(() => {
      service.tap();
      service.press();
      service.heavy();
      service.selectionStart();
      service.tick();
      service.selectionEnd();
    }).not.toThrow();
  });

  it('falls back to the Vibration API for success', () => {
    const vibrate = vi.fn();
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true });
    TestBed.inject(HapticsService).success();
    expect(vibrate).toHaveBeenCalledOnce();
  });
});
