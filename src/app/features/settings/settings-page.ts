import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon } from '@ng-icons/core';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmSwitch } from '@spartan-ng/helm/switch';
import { toast } from '@spartan-ng/brain/sonner';
import { displayVersion } from '../../core/app-info';
import { BackupService } from '../../core/backup/backup.service';
import { AppLang } from '../../core/i18n/language';
import { SettingsService, ThemeMode, WeightUnit } from '../../core/settings/settings.service';
import { ImportSheet } from '../../shared/components/import-sheet/import-sheet';
import { PageHeader } from '../../shared/components/page-header/page-header';
import {
  SegmentedControl,
  SegmentedOption,
} from '../../shared/components/segmented-control/segmented-control';

/**
 * Einstellungen (Figma 84:2796 / 84:3950): theme, units, language, timer autostart, backup, the
 * «What's new» page (decision 0020) and the app version. Every change is saved right away.
 */
@Component({
  selector: 'app-settings-page',
  imports: [
    PageHeader,
    SegmentedControl,
    ImportSheet,
    HlmSwitch,
    HlmButton,
    NgIcon,
    RouterLink,
    TranslocoPipe,
  ],
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
            <button
              hlmBtn
              variant="secondary"
              size="lg"
              data-action="export"
              [disabled]="busy()"
              (click)="exportBackup()"
            >
              {{ 'settings.backup.export' | transloco }}
            </button>
            <button
              hlmBtn
              variant="secondary"
              size="lg"
              data-action="import"
              [disabled]="busy()"
              (click)="importOpen.set(true)"
            >
              {{ 'settings.backup.import' | transloco }}
            </button>
          </div>
        </div>
      </section>

      <section class="flex flex-col gap-2">
        <h2 class="text-sm font-medium text-muted-foreground">{{ 'settings.app' | transloco }}</h2>
        <a
          routerLink="/settings/whats-new"
          class="flex items-center gap-3 rounded-xl border bg-card p-4"
          data-action="whats-new"
        >
          <span
            class="flex size-10 shrink-0 items-center justify-center rounded-md bg-secondary text-secondary-foreground"
            aria-hidden="true"
          >
            <ng-icon name="lucideSparkles" size="24" />
          </span>
          <span class="flex min-w-0 flex-1 flex-col gap-1">
            <span class="text-sm font-semibold">{{ 'settings.whatsNew.title' | transloco }}</span>
            <span class="text-xs text-muted-foreground">
              {{ 'settings.whatsNew.text' | transloco }}
            </span>
          </span>
          <ng-icon name="lucideChevronRight" size="20" aria-hidden="true" />
        </a>
      </section>

      <p class="pt-1 text-center text-xs text-muted-foreground">Grynd {{ version }}</p>
    </div>

    <app-import-sheet [(open)]="importOpen" />
  `,
})
export class SettingsPage {
  protected readonly service = inject(SettingsService);
  private readonly transloco = inject(TranslocoService);
  /** Emits once the translation file is loaded and on every language change. */
  private readonly translation = toSignal(this.transloco.selectTranslation());

  private readonly backups = inject(BackupService);

  protected readonly settings = this.service.settings;
  protected readonly busy = signal(false);
  protected readonly importOpen = signal(false);
  protected readonly version = displayVersion();

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

  protected async exportBackup(): Promise<void> {
    this.busy.set(true);
    try {
      if ((await this.backups.export()) !== 'cancelled') {
        toast.success(this.transloco.translate('settings.backup.exported'));
      }
    } catch {
      toast.error(this.transloco.translate('settings.backup.exportFailed'));
    } finally {
      this.busy.set(false);
    }
  }

  protected update(patch: Parameters<SettingsService['update']>[0]): void {
    void this.service.update(patch);
  }
}
