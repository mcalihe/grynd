import { TestBed } from '@angular/core/testing';
import { segmentRatio, SegmentProgress } from '../segment-progress/segment-progress';
import { ProgressRing, RING_CIRCUMFERENCE, ringOffset } from './progress-ring';

describe('ProgressRing', () => {
  it('maps progress to the dash offset', () => {
    expect(ringOffset(0)).toBeCloseTo(RING_CIRCUMFERENCE);
    expect(ringOffset(0.5)).toBeCloseTo(RING_CIRCUMFERENCE / 2);
    expect(ringOffset(1)).toBeCloseTo(0);
    expect(ringOffset(2)).toBeCloseTo(0);
    expect(ringOffset(-1)).toBeCloseTo(RING_CIRCUMFERENCE);
  });

  it('shows a check when complete and an arc otherwise', () => {
    const fixture = TestBed.createComponent(ProgressRing);
    fixture.componentRef.setInput('value', 1 / 3);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('circle')).toHaveLength(2);
    expect(fixture.nativeElement.getAttribute('aria-valuenow')).toBe('33');

    fixture.componentRef.setInput('value', 1);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('svg')).toBeNull();
    expect(fixture.nativeElement.querySelector('ng-icon')).not.toBeNull();
  });
});

describe('SegmentProgress', () => {
  it('computes ratios including extra sets, capped at 1', () => {
    expect(segmentRatio({ done: 2, total: 3 })).toBeCloseTo(2 / 3);
    expect(segmentRatio({ done: 4, total: 3 })).toBe(1);
    expect(segmentRatio({ done: 0, total: 0 })).toBe(0);
  });

  it('renders one segment per exercise and marks the current one', () => {
    const fixture = TestBed.createComponent(SegmentProgress);
    fixture.componentRef.setInput('segments', [
      { done: 3, total: 3 },
      { done: 1, total: 3 },
      { done: 0, total: 4 },
    ]);
    fixture.componentRef.setInput('current', 1);
    fixture.detectChanges();

    const segments = fixture.nativeElement.querySelectorAll(':scope > span');
    expect(segments).toHaveLength(3);
    expect(segments[1].hasAttribute('data-current')).toBe(true);
    expect((segments[1].firstElementChild as HTMLElement).style.width).toMatch(/^33\.3/);
  });
});
