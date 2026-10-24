import { TestBed } from '@angular/core/testing';
import { BarChart, BarChartBar } from './bar-chart';

describe('BarChart', () => {
  const render = (bars: BarChartBar[], inputs: Record<string, unknown> = {}) => {
    const fixture = TestBed.createComponent(BarChart);
    fixture.componentRef.setInput('bars', bars);
    for (const [key, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(key, value);
    }
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  };
  const heights = (el: HTMLElement) =>
    [...el.querySelectorAll<HTMLElement>('.rounded-t-md')].map((b) => b.style.height);

  it('scales bars with data and keeps empty ones low', () => {
    const { el } = render(
      [
        { value: 1, filled: true },
        { value: 0, filled: false },
        { value: 0.01, filled: true },
      ],
      { emptyHeight: 4 },
    );
    expect(heights(el)).toEqual(['98px', '4px', '16px']);
    expect(el.querySelectorAll('span')).toHaveLength(0);
  });

  it('selects a bar on tap and dims the others', () => {
    const { fixture, el } = render(
      [
        { value: 1, filled: true, label: '1', description: '1. September' },
        { value: 0.5, filled: true, label: '' },
      ],
      { interactive: true },
    );
    const [first, second] = el.querySelectorAll('button');
    expect(first.getAttribute('aria-label')).toBe('1. September');

    second.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.selected()).toBe(1);
    expect(el.querySelectorAll('.opacity-40')).toHaveLength(1);

    second.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.selected()).toBeNull();
  });
});
