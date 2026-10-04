import { TestBed } from '@angular/core/testing';
import { calendarMonth } from '../../../core/history/history-insights';
import { MonthCalendar } from './month-calendar';

describe('MonthCalendar', () => {
  const at = (day: number) => ({
    id: `d${day}`,
    planId: 'p1',
    planName: 'Oberkörper',
    startedAt: new Date(2026, 8, day, 18).toISOString(),
    finishedAt: new Date(2026, 8, day, 19).toISOString(),
    exerciseCount: 6,
    setCount: 18,
    volumeKg: 8420,
  });

  it('lets only training days be selected', () => {
    const fixture = TestBed.createComponent(MonthCalendar);
    fixture.componentRef.setInput('weeks', calendarMonth(new Date(2026, 8, 1), [at(1), at(29)]));
    fixture.componentRef.setInput('today', new Date(2026, 8, 30));
    fixture.componentRef.setInput('dayLabel', () => 'Training');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    const buttons = el.querySelectorAll('button');
    expect([...buttons].map((b) => b.textContent?.trim())).toEqual(['1', '29']);
    expect(el.querySelector('.ring-today')?.textContent?.trim()).toBe('30');

    buttons[1].click();
    fixture.detectChanges();
    expect(fixture.componentInstance.selected()).toEqual(new Date(2026, 8, 29));
    expect(buttons[1].getAttribute('aria-pressed')).toBe('true');
    expect(buttons[1].classList).toContain('bg-foreground');
  });
});
