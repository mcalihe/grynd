import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { RestDurationSheet } from './rest-duration-sheet';

describe('RestDurationSheet', () => {
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

  async function open(seconds: number) {
    const fixture = TestBed.createComponent(RestDurationSheet);
    const pick = vi.fn();
    fixture.componentInstance.pick.subscribe(pick);
    fixture.componentRef.setInput('title', 'Kniebeuge');
    fixture.componentRef.setInput('seconds', seconds);
    fixture.componentInstance.open.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    const options = [...document.body.querySelectorAll<HTMLButtonElement>('[role="radio"]')];
    const stepper = document.body.querySelector<HTMLElement>('[role="spinbutton"]')!;
    return { fixture, pick, options, stepper };
  }

  it('offers the timer presets and marks the current one', async () => {
    const { options, stepper } = await open(120);

    expect(options.map((o) => o.textContent?.trim())).toEqual([
      '0:30',
      '1:00',
      '1:30',
      '2:00',
      '3:00',
    ]);
    expect(options.filter((o) => o.getAttribute('aria-checked') === 'true')).toEqual([options[3]]);
    expect(stepper.getAttribute('aria-valuenow')).toBe('120');
  });

  it('marks no preset for another value', async () => {
    const { options } = await open(105);

    expect(options.some((o) => o.getAttribute('aria-checked') === 'true')).toBe(false);
  });

  it('emits a picked preset and closes', async () => {
    const { fixture, pick, options } = await open(90);

    options[0].click();
    fixture.detectChanges();

    expect(pick).toHaveBeenCalledExactlyOnceWith(30);
    expect(fixture.componentInstance.open()).toBe(false);
  });

  it('emits stepper changes in 15 s steps and stays open', async () => {
    const { fixture, pick } = await open(90);

    document.body.querySelector<HTMLButtonElement>('app-number-stepper button:last-child')!.click();
    fixture.detectChanges();

    expect(pick).toHaveBeenCalledExactlyOnceWith(105);
    expect(fixture.componentInstance.open()).toBe(true);
  });
});
