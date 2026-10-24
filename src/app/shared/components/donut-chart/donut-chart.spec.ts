import { TestBed } from '@angular/core/testing';
import { DonutChart, donutArcs, DonutSegment } from './donut-chart';

describe('DonutChart', () => {
  const segments: DonutSegment[] = [
    { key: 'chest', label: 'Brust', value: 30, color: 'var(--muscle-chest)' },
    { key: 'glutes', label: 'Po', value: 0, color: 'var(--muscle-glutes)' },
    { key: 'back', label: 'Rücken', value: 10, color: 'var(--muscle-back)' },
  ];
  const text = (node: Element | null) => node?.textContent?.replace(/\s+/g, ' ').trim();

  it('draws non-empty segments in order with a gap between them', () => {
    const arcs = donutArcs(segments);
    expect(arcs.map((a) => a.key)).toEqual(['chest', 'back']);
    const circumference = 2 * Math.PI * 55.5;
    const [drawn] = arcs[0].dashArray.split(' ').map(Number);
    expect(drawn).toBeCloseTo(circumference * 0.75 - 2);
    expect(arcs[1].dashOffset).toBeCloseTo(-circumference * 0.75);
    // A single segment closes the ring.
    expect(donutArcs([segments[0]])[0].dashArray.split(' ').map(Number)[1]).toBeCloseTo(0);
  });

  it('lists all segments by size and highlights a tapped one', () => {
    const fixture = TestBed.createComponent(DonutChart);
    fixture.componentRef.setInput('segments', segments);
    fixture.componentRef.setInput('totalLabel', 'Sätze');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    expect([...el.querySelectorAll('li')].map(text)).toEqual([
      'Brust 30 75 %',
      'Rücken 10 25 %',
      'Po 0 0 %',
    ]);
    expect(text(el.querySelector('[aria-live]'))).toBe('40 Sätze');

    el.querySelectorAll<HTMLButtonElement>('li button')[1].click();
    fixture.detectChanges();
    expect(text(el.querySelector('[aria-live]'))).toBe('10 Rücken');
  });
});
