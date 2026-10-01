import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmSwitch } from '@spartan-ng/helm/switch';
import { APP_VERSION } from '../../core/app-info';
import { AppLang } from '../../core/i18n/language';
import { SettingsService, ThemeMode, WeightUnit } from '../../core/settings/settings.service';
import { PageHeader } from '../../shared/components/page-header/page-header';
import {
  SegmentedControl,
  SegmentedOption,
} from '../../shared/components/segmented-control/segmented-control';

/**
 * Einstellungen (Figma 84:2796 / 84:3950): theme, units, language, timer autostart, backup and
 * the app version. Every change is saved right away.
 */
@Component({
  selector: 'app-settings-page',
  imports: [PageHeader, SegmentedControl, HlmSwitch, HlmButton, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-1 flex-col' },
  template: `
    <app-page-header [title]="'settings.title' | transloco" />

    <div class="flex flex-col gap-3 px-4 pb-4">
      <section class="flex flex-col gap-2">
        <h2 class="text-sm font-medium text-muted-foreground">
          {{ 'settings.appearance' | transloco }}
        </h2>
        <div class="rounded-xl border bg-card p-4">
          <app-segmented-control
            [options]="themeOptions()"
            [value]="settings().theme"
            (valueChange)="update({ theme: $event })"
          />
        </div>
      </section>

      <section class="flex flex-col gap-2">
        <h2 class="text-sm font-medium text-muted-foreground">
          {{ 'settings.units' | transloco }}
        </h2>
        <div class="rounded-xl border bg-card p-4">
          <app-segmented-control
            [options]="unitOptions"
            [value]="settings().unit"
            (valueChange)="update({ unit: $event })"
          />
        </div>
      </section>

      <section class="flex flex-col gap-2">
        <h2 class="text-sm font-medium text-muted-foreground">
          {{ 'settings.language' | transloco }}
        </h2>
        <div class="rounded-xl border bg-card p-4">
          <app-segmented-control
            [options]="langOptions"
            [value]="service.activeLang()"
            (valueChange)="update({ lang: $event })"
          />
        </div>
      </section>

      <section class="flex flex-col gap-2">
        <h2 class="text-sm font-medium text-muted-foreground">
          {{ 'settings.training' | transloco }}
        </h2>
        <div class="flex items-center gap-3 rounded-xl border bg-card p-4">
          <span class="flex min-w-0 flex-1 flex-col gap-1">
            <span class="text-sm font-semibold">{{ 'settings.autostart.title' | transloco }}</span>
            <span class="text-xs text-muted-foreground">
              {{ 'settings.autostart.text' | transloco }}
            </span>
          </span>
          <hlm-switch
            [checked]="settings().timerAutostart"
            [aria-label]="'settings.autostart.title' | transloco"
            (checkedChange)="update({ timerAutostart: $event })"
          />
        </div>
      </section>

      <section class="flex flex-col gap-2">
        <h2 class="text-sm font-medium text-muted-foreground">{{ 'settings.data' | transloco }}</h2>
        <div class="flex flex-col gap-3 rounded-xl border bg-card p-4">
          <p class="text-xs text-muted-foreground">{{ 'settings.backup.text' | transloco }}</p>
          <div class="grid grid-cols-2 gap-2">
            <button hlmBtn variant="secondary" size="lg" data-action="export">
              {{ 'settings.backup.export' | transloco }}
            </button>
            <button hlmBtn variant="secondary" size="lg" data-action="import">
              {{ 'settings.backup.import' | transloco }}
            </button>
          </div>
        </div>
      </section>

      <p class="pt-1 text-center text-xs text-muted-foreground">Grynd {{ version }}</p>
    </div>
  `,
})
export class SettingsPage {
  protected readonly service = inject(SettingsService);
  private readonly transloco = inject(TranslocoService);
  /** Emits once the translation file is loaded and on every language change. */
  private readonly translation = toSignal(this.transloco.selectTranslation());

  protected readonly settings = this.service.settings;
  protected readonly version = APP_VERSION;

  protected readonly themeOptions = computed<SegmentedOption<ThemeMode>[]>(() => {
    this.translation();
    return (['system', 'light', 'dark'] as const).map((value) => ({
      value,
      label: this.transloco.translate(`settings.theme.${value}`),
    }));
  });
  protected readonly unitOptions: SegmentedOption<WeightUnit>[] = [
    { value: 'kg', label: 'kg' },
    { value: 'lb', label: 'lb' },
  ];
  /** Language names stay in their own language. */
  protected readonly langOptions: SegmentedOption<AppLang>[] = [
    { value: 'de', label: 'Deutsch' },
    { value: 'en', label: 'English' },
  ];

  protected update(patch: Parameters<SettingsService['update']>[0]): void {
    void this.service.update(patch);
  }
}
