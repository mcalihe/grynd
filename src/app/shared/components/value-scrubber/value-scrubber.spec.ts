import { TestBed } from '@angular/core/testing';
import { ValueScrubber } from './value-scrubber';

describe('ValueScrubber', () => {
  const render = (inputs: Record<string, unknown>) => {
    const fixture = TestBed.createComponent(ValueScrubber);
    const defaults = { label: 'KG', step: 2.5, decimals: 2, max: 999, originX: 100, width: 393 };
    for (const [name, value] of Object.entries({ ...defaults, ...inputs })) {
      fixture.componentRef.setInput(name, value);
    }
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };

  it('shows the value and the change since the start', () => {
    const host = render({ value: 87.5, start: 80, pointerX: 148, anchorY: 500 });
    expect(host.getAttribute('aria-hidden')).toBe('true');
    expect(host.textContent).toContain('KG');
    expect(host.textContent).toContain('87,5');
    expect(host.textContent).toContain('+7,5');
  });

  it('shows no change while the value is the start value', () => {
    const host = render({ value: 80, start: 80, anchorY: 500 });
    expect(host.textContent).not.toContain('+');
    expect(host.textContent).not.toContain('−');
  });

  it('labels the ruler every 10 kg', () => {
    const host = render({ value: 80, start: 80, anchorY: 500 });
    const labels = [...host.querySelectorAll('.top-1')].map((el) => el.textContent?.trim());
    expect(labels).toEqual(['60', '70', '80', '90', '100', '110', '120', '130']);
  });

  it('puts the big value below the band when there is no room above', () => {
    const top = render({ value: 80, start: 80, anchorY: 60 });
    const middle = render({ value: 80, start: 80, anchorY: 500 });
    const hud = (host: HTMLElement) => host.children[1] as HTMLElement;
    expect(hud(top).classList).not.toContain('-translate-y-full');
    expect(hud(middle).classList).toContain('-translate-y-full');
  });
});
