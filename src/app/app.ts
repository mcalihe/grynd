import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { filter, map } from 'rxjs';
import { BottomNavigation } from './shared/components/bottom-navigation/bottom-navigation';
import { ConfirmDialogHost } from './shared/components/confirm-dialog/confirm-dialog-host';

/** Routes that show the bottom navigation (top-level tabs only). */
const TAB_ROUTES = ['/plans', '/history', '/settings'];

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, BottomNavigation, ConfirmDialogHost],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html',
})
export class App {
  private readonly router = inject(Router);

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects.split('?')[0]),
    ),
    { initialValue: this.router.url },
  );

  protected readonly showNav = computed(() => TAB_ROUTES.includes(this.url()));

  constructor() {
    const document = inject(DOCUMENT);
    inject(TranslocoService)
      .langChanges$.pipe(takeUntilDestroyed())
      .subscribe((lang) => (document.documentElement.lang = lang));
  }
}
