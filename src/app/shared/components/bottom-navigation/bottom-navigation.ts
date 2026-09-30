import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon } from '@ng-icons/core';

/** Tab bar Plans · History · Settings (Figma Grynd/Bottom Navigation 15:2111, decision 0006). */
@Component({
  selector: 'app-bottom-navigation',
  imports: [RouterLink, RouterLinkActive, TranslocoPipe, NgIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block px-4' },
  template: `
    <nav
      class="flex h-16 items-center rounded-full border bg-card p-1 shadow-md"
      [attr.aria-label]="'nav.label' | transloco"
    >
      @for (tab of tabs; track tab.path) {
        <a
          [routerLink]="tab.path"
          routerLinkActive
          #rla="routerLinkActive"
          [attr.aria-current]="rla.isActive ? 'page' : null"
          class="flex h-14 flex-1 flex-col items-center justify-center gap-1 rounded-lg text-xs"
          [class]="rla.isActive ? 'font-semibold text-foreground' : 'text-muted-foreground'"
        >
          <span
            class="flex h-8 w-14 items-center justify-center rounded-full text-foreground"
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
export class BottomNavigation {
  protected readonly tabs = [
    { path: '/plans', labelKey: 'nav.plans', icon: 'lucideClipboardList' },
    { path: '/history', labelKey: 'nav.history', icon: 'lucideChartLine' },
    { path: '/settings', labelKey: 'nav.settings', icon: 'lucideSettings' },
  ];
}
