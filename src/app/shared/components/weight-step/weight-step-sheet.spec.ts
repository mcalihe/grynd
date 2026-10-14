import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { WeightStepSheet } from './weight-step-sheet';

describe('WeightStepSheet', () => {
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

  afterEach(() =>
    document.body.querySelectorAll('.cdk-overlay-container').forEach((e) => e.remove()),
  );

  async function open(unit: 'kg' | 'lb', step: number) {
    const fixture = TestBed.createComponent(WeightStepSheet);
    const pick = vi.fn();
    fixture.componentInstance.pick.subscribe(pick);
    fixture.componentRef.setInput('title', 'Kurzhantel-Bankdrücken');
    fixture.componentRef.setInput('unit', unit);
    fixture.componentRef.setInput('step', step);
    fixture.componentInstance.open.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    const options = [...document.body.querySelectorAll<HTMLButtonElement>('[role="radio"]')];
    return { fixture, pick, options };
  }

  it('offers the steps of the shown unit and marks the current one', async () => {
    const { options } = await open('kg', 2);

    expect(options.map((o) => o.textContent?.trim())).toEqual([
      '0,25 kg',
      '0,5 kg',
      '1 kg',
      '1,25 kg',
      '2 kg',
      '2,5 kg',
      '5 kg',
      '10 kg',
    ]);
    expect(options.filter((o) => o.getAttribute('aria-checked') === 'true')).toEqual([options[4]]);
  });

  it('has its own steps for pounds', async () => {
    const { options } = await open('lb', 2.5);

    expect(options.map((o) => o.textContent?.trim())).toEqual([
      '0,5 lb',
      '1 lb',
      '2,5 lb',
      '5 lb',
      '10 lb',
    ]);
  });

  it('emits the picked step and closes', async () => {
    const { fixture, pick, options } = await open('kg', 2.5);

    options[2].click();
    fixture.detectChanges();

    expect(pick).toHaveBeenCalledExactlyOnceWith(1);
    expect(fixture.componentInstance.open()).toBe(false);
  });
});
