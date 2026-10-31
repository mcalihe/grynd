import { TestBed } from '@angular/core/testing';
import { KeyFigure, KeyFigures } from './key-figures';

describe('KeyFigures', () => {
  const figures: KeyFigure[] = [
    { label: 'Volumen', value: '8 420 kg', delta: '+320 kg', tone: 'up' },
    { label: 'Dauer', value: '54 Min.', delta: '−4 Min.', tone: 'neutral' },
    { label: 'Rekorde', value: '1' },
  ];
  const render = (selectable = false) => {
    const fixture = TestBed.createComponent(KeyFigures);
    fixture.componentRef.setInput('figures', figures);
    fixture.componentRef.setInput('selectable', selectable);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  };

  it('shows improvements in success and other changes muted', () => {
    const { el } = render();
    expect([...el.querySelectorAll('dt')].map((dt) => dt.textContent?.trim())).toEqual([
      'Volumen',
      'Dauer',
      'Rekorde',
    ]);
    expect(el.querySelector('.text-success')?.textContent?.trim()).toBe('+320 kg');
    expect(el.querySelectorAll('dd')).toHaveLength(5);
  });

  it('lets a tile pick the chart metric', () => {
    const { fixture, el } = render(true);
    el.querySelectorAll('button')[1].click();
    fixture.detectChanges();
    expect(fixture.componentInstance.selected()).toBe(1);
    expect(el.querySelectorAll('[aria-pressed="true"]')).toHaveLength(1);
  });

  it('lets an odd last figure span both columns (decision 0024)', () => {
    const fixture = TestBed.createComponent(KeyFigures);
    fixture.componentRef.setInput('figures', figures);
    fixture.componentRef.setInput('columns', 2);
    fixture.detectChanges();
    const cells = (fixture.nativeElement as HTMLElement).querySelectorAll('dl > div');
    expect([...cells].map((cell) => cell.classList.contains('col-span-2'))).toEqual([
      false,
      false,
      true,
    ]);

    fixture.componentRef.setInput('columns', 3);
    fixture.detectChanges();
    expect(
      (fixture.nativeElement as HTMLElement).querySelectorAll('dl > div.col-span-2'),
    ).toHaveLength(0);
  });
});
