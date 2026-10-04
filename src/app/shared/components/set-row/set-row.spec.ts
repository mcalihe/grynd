import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { HapticsService } from '../../../core/services/haptics.service';
import { CelebrationService } from '../../motion/celebration.service';
import { LONG_PRESS_MS, SetRow } from './set-row';

describe('SetRow', () => {
  let fixture: ComponentFixture<SetRow>;
  let host: HTMLElement;
  const haptics = {
    tap: vi.fn(),
    press: vi.fn(),
    selectionStart: vi.fn(),
    tick: vi.fn(),
    selectionEnd: vi.fn(),
  };
  const celebration = { sparks: vi.fn(), record: vi.fn() };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [SetRow, TranslocoTestingModule.forRoot({ langs: { de: {} } })],
      providers: [
        { provide: HapticsService, useValue: haptics },
        { provide: CelebrationService, useValue: celebration },
      ],
    });
    fixture = TestBed.createComponent(SetRow);
    fixture.componentRef.setInput('number', 1);
    fixture.componentInstance.weight.set(80);
    fixture.componentInstance.reps.set(8);
    fixture.detectChanges();
    host = fixture.nativeElement;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  const buttons = () => host.querySelectorAll<HTMLButtonElement>('button');
  const menuButton = () => buttons()[0];
  const checkButton = () => buttons()[buttons().length - 1];

  it('steps the weight by 2.5 kg and reps by 1', () => {
    const [, , , weightPlus, , , repsPlus] = buttons();
    weightPlus.click();
    repsPlus.click();

    expect(fixture.componentInstance.weight()).toBe(82.5);
    expect(fixture.componentInstance.reps()).toBe(9);
  });

  it('shows pounds, steps by 2.5 lb and still emits kilograms', () => {
    fixture.componentRef.setInput('unit', 'lb');
    fixture.componentInstance.weight.set(60);
    fixture.detectChanges();
    expect(host.textContent).toContain('132.3');

    const [, , , weightPlus] = buttons();
    weightPlus.click();
    fixture.detectChanges();
    expect(host.textContent).toContain('134.8');
    expect(fixture.componentInstance.weight()).toBeCloseTo(61.1443, 3);
  });

  it('emits complete from the check on the right and menu from the set number', () => {
    const complete = vi.fn();
    const menu = vi.fn();
    fixture.componentInstance.complete.subscribe(complete);
    fixture.componentInstance.menu.subscribe(menu);

    checkButton().click();
    menuButton().click();

    expect(complete).toHaveBeenCalledOnce();
    expect(menu).toHaveBeenCalledOnce();
    expect(haptics.tap).toHaveBeenCalled();
  });

  it('shows the check as done for completed and record sets', () => {
    for (const [state, pressed] of [
      ['open', 'false'],
      ['completed', 'true'],
      ['record', 'true'],
    ] as const) {
      fixture.componentRef.setInput('state', state);
      fixture.detectChanges();
      expect(checkButton().getAttribute('aria-pressed')).toBe(pressed);
    }
  });

  it('shows the record badge only for record sets', () => {
    expect(host.querySelector('[hlmBadge]')).toBeNull();
    fixture.componentRef.setInput('state', 'record');
    fixture.detectChanges();
    expect(host.querySelector('[hlmBadge]')).not.toBeNull();
  });

  it('opens the menu on long press and swallows the following click', () => {
    vi.useFakeTimers();
    const menu = vi.fn();
    const complete = vi.fn();
    fixture.componentInstance.menu.subscribe(menu);
    fixture.componentInstance.complete.subscribe(complete);

    host.dispatchEvent(new PointerEvent('pointerdown', { button: 0 }));
    vi.advanceTimersByTime(LONG_PRESS_MS);
    expect(haptics.press).toHaveBeenCalled();
    host.dispatchEvent(new PointerEvent('pointerup'));
    checkButton().click();

    expect(menu).toHaveBeenCalledOnce();
    expect(complete).not.toHaveBeenCalled();
  });

  it('does not open the menu on a short press', () => {
    vi.useFakeTimers();
    const menu = vi.fn();
    fixture.componentInstance.menu.subscribe(menu);

    host.dispatchEvent(new PointerEvent('pointerdown', { button: 0 }));
    vi.advanceTimersByTime(LONG_PRESS_MS - 100);
    host.dispatchEvent(new PointerEvent('pointerup'));
    vi.advanceTimersByTime(1000);

    expect(menu).not.toHaveBeenCalled();
  });

  describe('celebration', () => {
    const show = (state: 'open' | 'completed' | 'record' | 'menu-open') => {
      fixture.componentRef.setInput('state', state);
      fixture.detectChanges();
    };

    it('stays quiet on the first render, even for done sets', () => {
      const other = TestBed.createComponent(SetRow);
      other.componentRef.setInput('number', 2);
      other.componentRef.setInput('state', 'record');
      other.detectChanges();
      expect(celebration.sparks).not.toHaveBeenCalled();
      expect(celebration.record).not.toHaveBeenCalled();
    });

    it('sparks when a set is checked and adds stars for a record', () => {
      show('completed');
      expect(celebration.sparks).toHaveBeenCalledOnce();
      expect(celebration.record).not.toHaveBeenCalled();

      show('record');
      expect(celebration.sparks).toHaveBeenCalledOnce();
      expect(celebration.record).toHaveBeenCalledOnce();
    });

    it('does not celebrate again when the menu opens and closes or the set is unchecked', () => {
      show('record');
      show('menu-open');
      show('record');
      show('open');
      expect(celebration.sparks).toHaveBeenCalledOnce();
      expect(celebration.record).toHaveBeenCalledOnce();
    });
  });
});
