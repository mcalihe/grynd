import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, withComponentInputBinding } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { App } from './app';
import { PlansService } from './core/plans/plans.service';
import { routes } from './app.routes';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        App,
        TranslocoTestingModule.forRoot({
          langs: { en: {} },
          translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
        }),
      ],
      providers: [
        provideRouter(routes, withComponentInputBinding()),
        {
          provide: PlansService,
          useValue: { plans: signal([]), todayPlans: signal([]), load: async () => undefined },
        },
      ],
    }).compileComponents();
  });

  it('redirects the root route to /plans and shows the navigation', async () => {
    const fixture = TestBed.createComponent(App);
    await TestBed.inject(Router).navigateByUrl('/');
    await fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe('/plans');
    expect(fixture.nativeElement.querySelector('app-bottom-navigation')).not.toBeNull();
  });

  it('hides the navigation outside the tab screens', async () => {
    const fixture = TestBed.createComponent(App);
    await TestBed.inject(Router).navigateByUrl('/history/some-session');
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('app-bottom-navigation')).toBeNull();
  });
});
