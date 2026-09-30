import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, withComponentInputBinding } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { App } from './app';
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
      providers: [provideRouter(routes, withComponentInputBinding())],
    }).compileComponents();
  });

  it('redirects the root route to /plans and shows the navigation', async () => {
    const fixture = TestBed.createComponent(App);
    await TestBed.inject(Router).navigateByUrl('/');
    await fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe('/plans');
    expect(fixture.nativeElement.querySelector('app-nav-placeholder')).not.toBeNull();
  });

  it('hides the navigation during a workout', async () => {
    const fixture = TestBed.createComponent(App);
    await TestBed.inject(Router).navigateByUrl('/workout');
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('app-nav-placeholder')).toBeNull();
  });
});
