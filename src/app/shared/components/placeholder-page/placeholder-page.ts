import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmButton } from '@spartan-ng/helm/button';
import { ThemeMode, ThemeService } from '../../../core/services/theme.service';

/**
 * Temporary page used by every route until the real screens land (M4–M7).
 * The settings route shows the theme switch so the ThemeService can be checked by hand.
 */
@Component({
  selector: 'app-placeholder-page',
  imports: [TranslocoPipe, HlmButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="flex flex-col gap-4 px-4 pt-6">
      <h1 class="text-2xl font-semibold">{{ titleKey() | transloco }}</h1>
      <p class="text-sm text-muted-foreground">{{ 'common.placeholder' | transloco }}</p>

      @if (showThemeSwitch()) {
        <div class="flex gap-2">
          @for (mode of modes; track mode) {
            <button
              hlmBtn
              size="sm"
              [variant]="theme.mode() === mode ? 'default' : 'secondary'"
              [attr.aria-pressed]="theme.mode() === mode"
              (click)="theme.setMode(mode)"
            >
              {{ 'settings.theme.' + mode | transloco }}
            </button>
          }
        </div>
      }
    </section>
  `,
})
export class PlaceholderPage {
  protected readonly theme = inject(ThemeService);
  protected readonly modes: ThemeMode[] = ['system', 'light', 'dark'];

  /** Bound from route data via withComponentInputBinding. */
  readonly titleKey = input.required<string>();
  readonly showThemeSwitch = input(false);
}
