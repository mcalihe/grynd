import { DOCUMENT } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { filter, map, take } from 'rxjs';
import { displayTitle } from './core/app-info';
import { Clock } from './core/utils/time';
import { ExerciseCatalogService } from './core/exercises/exercise-catalog.service';
import { ThemeService } from './core/services/theme.service';
import { WhatsNewService } from './core/whats-new/whats-new.service';
import { WorkoutService } from './core/workout/workout.service';
import { BottomNavigation } from './shared/components/bottom-navigation/bottom-navigation';
import { ConfirmDialogHost } from './shared/components/confirm-dialog/confirm-dialog-host';
import { ImageViewerHost } from './shared/components/image-viewer/image-viewer-host';
import { PausedWorkoutBar } from './shared/components/paused-workout-bar/paused-workout-bar';
import { WhatsNewDialog } from './shared/components/whats-new/whats-new-dialog';
import { HlmToaster } from '@spartan-ng/helm/sonner';

/** Routes that show the bottom navigation (top-level tabs only). */
const TAB_ROUTES = ['/plans', '/history', '/settings'];

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    BottomNavigation,
    ConfirmDialogHost,
    ImageViewerHost,
    PausedWorkoutBar,
    WhatsNewDialog,
    HlmToaster,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html',
})
export class App {
  private readonly router = inject(Router);
  protected readonly theme = inject(ThemeService);

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects.split('?')[0]),
    ),
    { initialValue: this.router.url },
  );

  protected readonly showNav = computed(() => TAB_ROUTES.includes(this.url()));

  protected readonly workout = inject(WorkoutService);
  private readonly clock = inject(Clock);
  /** A paused workout waits above the tabs (decision 0023); its time stands still. */
  protected readonly showPausedWorkout = computed(() => this.showNav() && this.workout.paused());
  protected readonly pausedElapsedMs = computed(() => this.workout.elapsedMs(this.clock.nowUtc()));
  private readonly catalog = inject(ExerciseCatalogService);
  /** The plan name, or the activity of a cardio workout without a plan (decision 0024). */
  protected readonly workoutName = computed(() => {
    const active = this.workout.workout();
    return active?.planName || this.catalog.name(active?.activity ?? undefined);
  });

  protected readonly whatsNew = inject(WhatsNewService);
  /** After an update, on a tab screen only: never in the middle of a workout or an editor. */
  protected readonly showWhatsNew = computed(
    () => this.showNav() && this.whatsNew.pending().length > 0,
  );

  constructor() {
    // App initializers are done once the first frame renders: no blank flash, no theme flicker.
    afterNextRender(() => {
      if (Capacitor.isNativePlatform()) {
        void SplashScreen.hide({ fadeOutDuration: 200 }).catch(() => undefined);
      }
    });

    // An active session survives restarts: open it again on startup (plan.md §7 «Fortsetzen»).
    // A paused one stays in the background, the user left it on purpose (decision 0023).
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        take(1),
        takeUntilDestroyed(),
      )
      .subscribe((event) => {
        if (
          this.workout.isActive() &&
          !this.workout.paused() &&
          !event.urlAfterRedirects.startsWith('/workout')
        ) {
          void this.router.navigateByUrl('/workout', { replaceUrl: true });
        }
      });

    // Once per update: what is new since the last version the user saw (decision 0020).
    void this.whatsNew.check();

    // Staging and previews carry their channel in the tab title (`pr-31 · Grynd`).
    const title = inject(Title);
    title.setTitle(displayTitle(title.getTitle()));

    const document = inject(DOCUMENT);
    inject(TranslocoService)
      .langChanges$.pipe(takeUntilDestroyed())
      .subscribe((lang) => (document.documentElement.lang = lang));
  }

  protected openWorkout(): void {
    void this.router.navigate(['/workout']);
  }
}
