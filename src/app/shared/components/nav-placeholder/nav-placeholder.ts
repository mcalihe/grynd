import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon } from '@ng-icons/core';

/** Simple tab bar until BottomNavigationComponent (Figma 15:2111) is built in M3. */
@Component({
  selector: 'app-nav-placeholder',
  imports: [RouterLink, RouterLinkActive, TranslocoPipe, NgIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="mx-4 mb-2 flex rounded-full border bg-card p-1">
      @for (tab of tabs; track tab.path) {
        <a
          [routerLink]="tab.path"
          routerLinkActive="text-foreground font-semibold"
          #rla="routerLinkActive"
          [attr.aria-current]="rla.isActive ? 'page' : null"
          class="flex min-h-11 flex-1 flex-col items-center justify-center gap-1 text-xs text-muted-foreground"
        >
          <span
            class="flex h-8 w-14 items-center justify-center rounded-full"
            [class.bg-accent]="rla.isActive"
          >
            <ng-icon [name]="tab.icon" size="22" />
          </span>
          {{ tab.labelKey | transloco }}
        </a>
      }
    </nav>
  `,
})
export class NavPlaceholder {
  protected readonly tabs = [
    { path: '/plans', labelKey: 'nav.plans', icon: 'lucideClipboardList' },
    { path: '/history', labelKey: 'nav.history', icon: 'lucideChartLine' },
    { path: '/settings', labelKey: 'nav.settings', icon: 'lucideSettings' },
  ];
}
