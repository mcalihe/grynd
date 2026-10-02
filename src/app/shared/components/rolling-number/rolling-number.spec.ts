import { TestBed } from '@angular/core/testing';
import { digitValue, rollDirection, RollingNumber, rollSlots } from './rolling-number';

describe('rolling number logic', () => {
  it('reads the digits of a clock string', () => {
    expect(digitValue('1:12')).toBe(112);
    expect(digitValue('0:59')).toBe(59);
    expect(digitValue('10:00')).toBe(1000);
    expect(digitValue('')).toBe(0);
  });

  it('keys slots from the right', () => {
    expect(rollSlots('9:59').map((s) => s.key)).toEqual([4, 3, 2, 1]);
    expect(rollSlots('10:00').at(-1)).toEqual({ key: 1, char: '0' });
  });

  it('rolls down while counting down and up when the value grows', () => {
    expect(rollDirection(111, 112)).toBe('down');
    expect(rollDirection(127, 112)).toBe('up');
    expect(rollDirection(112, undefined)).toBe('down');
  });
});

describe('RollingNumber', () => {
  it('renders the text and tracks the direction', () => {
    const fixture = TestBed.createComponent(RollingNumber);
    fixture.componentRef.setInput('text', '1:12');
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;
    expect(host.textContent?.replace(/\s/g, '')).toBe('1:12');
    expect(host.getAttribute('aria-label')).toBe('1:12');

    fixture.componentRef.setInput('text', '1:27');
    fixture.detectChanges();
    expect(host.getAttribute('data-direction')).toBe('up');

    fixture.componentRef.setInput('text', '1:26');
    fixture.detectChanges();
    expect(host.getAttribute('data-direction')).toBe('down');
  });
});
