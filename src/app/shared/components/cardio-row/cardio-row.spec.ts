import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { HapticsService } from '../../../core/services/haptics.service';
import { M_PER_MI } from '../../../core/units/distance';
import { CelebrationService } from '../../motion/celebration.service';
import { LONG_PRESS_MS } from '../set-row/long-press';
import { CardioRow } from './cardio-row';

describe('CardioRow', () => {
  let fixture: ComponentFixture<CardioRow>;
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
      imports: [CardioRow, TranslocoTestingModule.forRoot({ langs: { de: {} } })],
      providers: [
        { provide: HapticsService, useValue: haptics },
        { provide: CelebrationService, useValue: celebration },
      ],
    });
    fixture = TestBed.createComponent(CardioRow);
    fixture.componentRef.setInput('number', 1);
    fixture.componentInstance.duration.set(1500);
    fixture.componentInstance.distance.set(5000);
    fixture.detectChanges();
    host = fixture.nativeElement;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  const field = (name: string) => host.querySelector<HTMLElement>(`[data-field=${name}]`);
  const plus = (name: string) => field(name)!.querySelectorAll('button')[1] as HTMLButtonElement;

  it('shows the duration as m:ss and steps it by a minute', () => {
    expect(field('duration')!.textContent).toContain('25:00');
    plus('duration').click();
    expect(fixture.componentInstance.duration()).toBe(1560);
  });

  it('shows the distance in the chosen unit and still emits metres', () => {
    plus('distance').click();
    expect(fixture.componentInstance.distance()).toBe(5100);

    fixture.componentRef.setInput('distanceUnit', 'mi');
    fixture.componentInstance.distance.set(M_PER_MI * 3);
    fixture.detectChanges();
    plus('distance').click();
    expect(fixture.componentInstance.distance()).toBeCloseTo(M_PER_MI * 3.1, 3);
  });

  it('starts empty calories and heart rate at a sensible value', () => {
    plus('kcal').click();
    plus('heartRate').click();
    expect(fixture.componentInstance.kcal()).toBe(100);
    expect(fixture.componentInstance.heartRate()).toBe(120);
  });

  it('shows only the fields of the activity', () => {
    fixture.componentRef.setInput('fields', { distance: false, level: false });
    fixture.detectChanges();
    expect(field('distance')).toBeNull();
    expect(field('level')).toBeNull();
    expect(field('kcal')).not.toBeNull();
  });

  it('emits complete from the check and menu from the number and a long press', () => {
    const complete = vi.fn();
    const menu = vi.fn();
    fixture.componentInstance.complete.subscribe(complete);
    fixture.componentInstance.menu.subscribe(menu);
    const buttons = host.querySelectorAll<HTMLButtonElement>(':scope > div > div > button');

    buttons[buttons.length - 1].click();
    buttons[0].click();
    expect(complete).toHaveBeenCalledOnce();
    expect(menu).toHaveBeenCalledOnce();

    vi.useFakeTimers();
    host.dispatchEvent(new PointerEvent('pointerdown', { button: 0, clientX: 10, clientY: 10 }));
    vi.advanceTimersByTime(LONG_PRESS_MS);
    expect(menu).toHaveBeenCalledTimes(2);
  });

  it('celebrates when the entry is checked, not on the first render', () => {
    expect(celebration.sparks).not.toHaveBeenCalled();
    fixture.componentRef.setInput('state', 'completed');
    fixture.detectChanges();
    expect(celebration.sparks).toHaveBeenCalledOnce();
    expect(host.querySelector('[aria-pressed=true]')).not.toBeNull();
  });
});
