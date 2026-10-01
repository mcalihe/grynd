import { TestBed } from '@angular/core/testing';
import { WeekChart, WeekChartBar } from './week-chart';

describe('WeekChart', () => {
  const render = (trend: number, bars: WeekChartBar[]) => {
    const fixture = TestBed.createComponent(WeekChart);
    fixture.componentRef.setInput('title', '2 Trainings');
    fixture.componentRef.setInput('trend', trend);
    fixture.componentRef.setInput('bars', bars);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };
  const bar = (trained: boolean, value: number): WeekChartBar => ({ label: 'Mo', trained, value });

  it('scales training days and keeps other days low', () => {
    const el = render(0, [bar(true, 1), bar(true, 0.5), bar(false, 0), bar(true, 0.01)]);
    const heights = [...el.querySelectorAll<HTMLElement>('.rounded-t-md')].map(
      (b) => b.style.height,
    );
    expect(heights).toEqual(['98px', '49px', '12px', '16px']);
    expect(el.querySelectorAll('[data-trained]')).toHaveLength(3);
  });

  it('shows the trend only when it differs from last week', () => {
    expect(render(0, []).textContent).not.toContain('+');
    expect(render(2, []).querySelector('.text-success')?.textContent?.trim()).toBe('+2');
    expect(render(-1, []).textContent).toContain('−1');
  });
});
