import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { BottomNavigation } from '../bottom-navigation/bottom-navigation';
import { PageHeader } from '../page-header/page-header';
import { PlanCard } from './plan-card';

describe('layout components', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        TranslocoTestingModule.forRoot({
          langs: {
            de: { plans: { exerciseCount: '{{count}} Übungen', exerciseCountOne: '1 Übung' } },
          },
          translocoConfig: { availableLangs: ['de'], defaultLang: 'de' },
        }),
      ],
      providers: [provideRouter([])],
    });
  });

  describe('PlanCard', () => {
    it('shows name, count and weekdays Monday-first, and opens on tap', () => {
      const fixture = TestBed.createComponent(PlanCard);
      const open = vi.fn();
      fixture.componentInstance.open.subscribe(open);
      fixture.componentRef.setInput('name', 'Oberkörper');
      fixture.componentRef.setInput('exerciseCount', 6);
      fixture.componentRef.setInput('weekdays', [4, 1]);
      fixture.detectChanges();

      const text = fixture.nativeElement.textContent;
      expect(text).toContain('Oberkörper');
      expect(text).toContain('6 Übungen');
      const chips = [...fixture.nativeElement.querySelectorAll('[hlmBadge]')].map((c) =>
        (c as HTMLElement).textContent?.trim(),
      );
      expect(chips).toEqual(['Mo', 'Do']);

      fixture.nativeElement.querySelector('button').click();
      expect(open).toHaveBeenCalledOnce();
    });

    it('uses singular for one exercise and a primary arrow for today', () => {
      const fixture = TestBed.createComponent(PlanCard);
      fixture.componentRef.setInput('name', 'Beine');
      fixture.componentRef.setInput('exerciseCount', 1);
      fixture.componentRef.setInput('today', true);
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain('1 Übung');
      expect(fixture.nativeElement.querySelector('.bg-primary')).not.toBeNull();
    });
  });

  it('BottomNavigation links to the three tabs', () => {
    const fixture = TestBed.createComponent(BottomNavigation);
    fixture.detectChanges();
    const links = [...fixture.nativeElement.querySelectorAll('a')].map((a) =>
      (a as HTMLAnchorElement).getAttribute('href'),
    );
    expect(links).toEqual(['/plans', '/history', '/settings']);
  });

  it('PageHeader bar emits back', () => {
    const fixture = TestBed.createComponent(PageHeader);
    const back = vi.fn();
    fixture.componentInstance.back.subscribe(back);
    fixture.componentRef.setInput('variant', 'bar');
    fixture.detectChanges();

    fixture.nativeElement.querySelector('button').click();
    expect(back).toHaveBeenCalledOnce();
  });
});
