import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { SegmentedControl } from '../segmented-control/segmented-control';
import { toggleWeekday, WeekdayChips } from './weekday-chips';

describe('WeekdayChips', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        TranslocoTestingModule.forRoot({
          langs: { de: {} },
          translocoConfig: { availableLangs: ['de'], defaultLang: 'de' },
        }),
      ],
    });
  });

  it('toggles days and keeps them Monday-first', () => {
    expect(toggleWeekday([4], 1)).toEqual([1, 4]);
    expect(toggleWeekday([1, 4], 1)).toEqual([4]);
    expect(toggleWeekday([6], 0)).toEqual([6, 0]);
  });

  it('renders Mo–So and updates the model on tap', () => {
    const fixture = TestBed.createComponent(WeekdayChips);
    fixture.componentInstance.value.set([4]);
    fixture.detectChanges();

    const chips: HTMLButtonElement[] = [...fixture.nativeElement.querySelectorAll('button')];
    expect(chips.map((c) => c.textContent?.trim())).toEqual([
      'Mo',
      'Di',
      'Mi',
      'Do',
      'Fr',
      'Sa',
      'So',
    ]);
    expect(chips[3].getAttribute('aria-pressed')).toBe('true');

    chips[0].click();
    expect(fixture.componentInstance.value()).toEqual([1, 4]);
  });
});

describe('SegmentedControl', () => {
  it('selects an option like a radio group', () => {
    const fixture = TestBed.createComponent(SegmentedControl<string>);
    fixture.componentRef.setInput('options', [
      { value: 'kg', label: 'kg' },
      { value: 'lb', label: 'lb' },
    ]);
    fixture.componentRef.setInput('value', 'kg');
    fixture.detectChanges();

    const [kg, lb] = fixture.nativeElement.querySelectorAll('[role=radio]');
    expect(kg.getAttribute('aria-checked')).toBe('true');

    lb.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.value()).toBe('lb');
    expect(lb.getAttribute('aria-checked')).toBe('true');
  });
});
