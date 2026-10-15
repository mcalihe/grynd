import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, withComponentInputBinding } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { App } from './app';
import { ExerciseCatalogService } from './core/exercises/exercise-catalog.service';
import { HistoryService } from './core/history/history.service';
import { PlansService } from './core/plans/plans.service';
import { WorkoutService } from './core/workout/workout.service';
import { routes } from './app.routes';

describe('App', () => {
  /** `workout` fakes an active workout; the real WorkoutService starts without one. */
  async function setup(workout?: object) {
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
        // The history pages load from the database; keep them pending in this shell test.
        {
          provide: HistoryService,
          useValue: {
            detail: () => new Promise(() => undefined),
            load: () => new Promise(() => undefined),
            loadFacts: () => new Promise(() => undefined),
            summaries: signal([]),
            facts: signal([]),
            loaded: signal(false),
          },
        },
        {
          provide: ExerciseCatalogService,
          useValue: { load: () => new Promise(() => undefined), nameById: () => '' },
        },
        ...(workout ? [{ provide: WorkoutService, useValue: workout }] : []),
      ],
    }).compileComponents();
  }

  it('redirects the root route to /plans and shows the navigation', async () => {
    await setup();
    const fixture = TestBed.createComponent(App);
    await TestBed.inject(Router).navigateByUrl('/');
    await fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe('/plans');
    expect(fixture.nativeElement.querySelector('app-bottom-navigation')).not.toBeNull();
  });

  it('hides the navigation outside the tab screens', async () => {
    await setup();
    const fixture = TestBed.createComponent(App);
    await TestBed.inject(Router).navigateByUrl('/history/some-session');
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('app-bottom-navigation')).toBeNull();
  });

  it('leaves a paused workout in the background and leads back to it from the tabs', async () => {
    await setup({
      isActive: signal(true),
      paused: signal(true),
      workout: signal({ planName: 'Beine' }),
      elapsedMs: () => 1_453_900,
    });
    const fixture = TestBed.createComponent(App);
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/');
    await fixture.whenStable();

    expect(router.url).toBe('/plans');
    const bar: HTMLElement = fixture.nativeElement.querySelector('app-paused-workout-bar');
    expect(bar.textContent).toContain('Beine');

    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    bar.querySelector('button')!.click();
    expect(navigate).toHaveBeenCalledWith(['/workout']);
  });
});
