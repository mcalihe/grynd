import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon } from '@ng-icons/core';
import { toast } from '@spartan-ng/brain/sonner';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmCheckbox } from '@spartan-ng/helm/checkbox';
import { HlmSheetImports } from '@spartan-ng/helm/sheet';
import { HlmSwitch } from '@spartan-ng/helm/switch';
import { HlmTextarea } from '@spartan-ng/helm/textarea';
import { ExportSelection } from '../../../core/backup/backup';
import { PlansService } from '../../../core/plans/plans.service';
import { ExportResult, ExportService } from '../../../core/share/export.service';
import { ShareService } from '../../../core/share/share.service';
import { SegmentedControl, SegmentedOption } from '../segmented-control/segmented-control';

type Scope = 'all' | 'pick';
type Extra = 'history' | 'notes' | 'photos' | 'weightSteps';

/**
 * Bottom sheet to export (decision 0027), the counterpart of the import sheet: choose the plans
 * (all or some) and what comes along, then copy the code or save the file. The code is built as
 * soon as the selection changes, so «Code kopieren» can write it during the tap (iOS allows the
 * clipboard only there). Opened from a plan, that plan is preselected as a template without
 * workouts; from the settings, everything is.
 */
@Component({
  selector: 'app-export-sheet',
  imports: [
    HlmSheetImports,
    HlmButton,
    HlmCheckbox,
    HlmSwitch,
    HlmTextarea,
    NgIcon,
    SegmentedControl,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <hlm-sheet side="bottom" [state]="open() ? 'open' : 'closed'" (closed)="open.set(false)">
      <hlm-sheet-content *hlmSheetPortal="let ctx" class="max-h-[90dvh]">
        <hlm-sheet-header>
          <h3 hlmSheetTitle class="pr-8">{{ 'export.title' | transloco }}</h3>
          <p hlmSheetDescription>{{ 'export.hint' | transloco }}</p>
        </hlm-sheet-header>
        <div class="flex min-h-0 flex-col gap-4 overflow-y-auto px-4 pb-6">
          <section class="flex flex-col gap-2">
            <h4 class="text-sm font-medium text-muted-foreground">
              {{ 'export.plans' | transloco }}
            </h4>
            <app-segmented-control [options]="scopeOptions()" [(value)]="scope" />
            @if (scope() === 'pick') {
              <div class="flex flex-col divide-y rounded-xl border bg-card" data-list="plans">
                @for (item of planList(); track item.id) {
                  <label
                    class="flex min-h-12 items-center gap-3 px-4 py-3"
                    [for]="'export-plan-' + item.id"
                  >
                    <hlm-checkbox
                      [inputId]="'export-plan-' + item.id"
                      [checked]="picked().has(item.id)"
                      [aria-label]="item.name"
                      (checkedChange)="pick(item.id, $event)"
                    />
                    <span class="min-w-0 flex-1 truncate text-sm font-medium">{{ item.name }}</span>
                  </label>
                } @empty {
                  <p class="p-4 text-sm text-muted-foreground">
                    {{ 'export.noPlans' | transloco }}
                  </p>
                }
              </div>
            }
          </section>

          <section class="flex flex-col gap-2">
            <h4 class="text-sm font-medium text-muted-foreground">
              {{ 'export.include' | transloco }}
            </h4>
            <div class="flex flex-col divide-y rounded-xl border bg-card">
              @for (extra of visibleExtras(); track extra) {
                <div class="flex items-center gap-3 p-4" [attr.data-option]="extra">
                  <span class="flex min-w-0 flex-1 flex-col gap-1">
                    <span class="text-sm font-semibold">
                      {{ 'export.extras.' + extra + '.title' | transloco }}
                    </span>
                    <span class="text-xs text-muted-foreground">
                      {{ 'export.extras.' + extra + '.text' | transloco }}
                    </span>
                  </span>
                  <hlm-switch
                    [checked]="extras()[extra]"
                    [aria-label]="'export.extras.' + extra + '.title' | transloco"
                    (checkedChange)="setExtra(extra, $event)"
                  />
                </div>
              }
            </div>
          </section>

          <section class="flex flex-col gap-2">
            <textarea
              #codeField
              hlmTextarea
              readonly
              class="max-h-[20dvh] min-h-20 shrink-0 resize-none font-mono text-xs break-all"
              data-field="code"
              [attr.aria-label]="'export.code' | transloco"
              [placeholder]="codeHint() | transloco"
              [value]="result()?.code ?? ''"
              (focus)="codeField.select()"
            ></textarea>
            <button
              hlmBtn
              variant="secondary"
              size="lg"
              data-action="export-code"
              [disabled]="!result()?.code"
              (click)="copy()"
            >
              <ng-icon name="lucideCopy" />{{ 'export.copy' | transloco }}
            </button>
            <button
              hlmBtn
              variant="secondary"
              size="lg"
              data-action="export-file"
              [disabled]="!result() || saving()"
              (click)="save()"
            >
              <ng-icon name="lucideDownload" />{{ 'export.save' | transloco }}
            </button>
          </section>
        </div>
      </hlm-sheet-content>
    </hlm-sheet>
  `,
})
export class ExportSheet {
  private readonly plans = inject(PlansService);
  private readonly exports = inject(ExportService);
  private readonly share = inject(ShareService);
  private readonly transloco = inject(TranslocoService);
  private readonly translation = toSignal(this.transloco.selectTranslation());

  readonly open = model(false);
  /** Opened from a plan: that plan alone, as a template. */
  readonly planId = input<string | null>(null);

  protected readonly scope = signal<Scope>('all');
  protected readonly picked = signal<ReadonlySet<string>>(new Set());
  protected readonly extras = signal<Record<Extra, boolean>>({
    history: true,
    notes: true,
    photos: true,
    weightSteps: true,
  });
  protected readonly result = signal<ExportResult | null>(null);
  protected readonly building = signal(false);
  protected readonly saving = signal(false);
  private request = 0;

  protected readonly scopeOptions = computed<SegmentedOption<Scope>[]>(() => {
    this.translation();
    return (['all', 'pick'] as const).map((value) => ({
      value,
      label: this.transloco.translate(`export.scope.${value}`),
    }));
  });

  protected readonly planList = computed(() =>
    (this.plans.plans() ?? []).map(({ plan }) => ({ id: plan.id, name: plan.name })),
  );

  /** Photos belong to notes, so their switch only shows with notes on. */
  protected readonly visibleExtras = computed<Extra[]>(() =>
    this.extras().notes
      ? ['history', 'notes', 'photos', 'weightSteps']
      : ['history', 'notes', 'weightSteps'],
  );

  /** What is exported right now; null without any plan picked. */
  private readonly selection = computed<ExportSelection | null>(() => {
    const plans = this.scope() === 'all' ? 'all' : [...this.picked()];
    if (plans !== 'all' && !plans.length) {
      return null;
    }
    const { history, notes, photos, weightSteps } = this.extras();
    return { plans, history, notes, photos: notes && photos, weightSteps };
  });

  /** Placeholder of the code field while there is no code. */
  protected readonly codeHint = computed(() => {
    const selection = this.selection();
    if (!selection) {
      return 'export.nothingSelected';
    }
    if (selection.photos) {
      return 'export.photosFileOnly';
    }
    return this.building() ? 'export.building' : 'export.code';
  });

  constructor() {
    // Each time the sheet opens: fresh plan list and the defaults for where it was opened.
    effect(() => {
      if (!this.open()) {
        return;
      }
      const planId = this.planId();
      untracked(() => {
        void this.plans.load();
        this.scope.set(planId ? 'pick' : 'all');
        this.picked.set(new Set(planId ? [planId] : []));
        this.extras.set({
          history: !planId,
          notes: true,
          photos: !planId,
          weightSteps: true,
        });
      });
    });
    effect(() => {
      const selection = this.open() ? this.selection() : null;
      untracked(() => this.build(selection));
    });
  }

  protected pick(id: string, checked: boolean): void {
    this.picked.update((picked) => {
      const next = new Set(picked);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }

  protected setExtra(extra: Extra, value: boolean): void {
    this.extras.update((extras) => ({ ...extras, [extra]: value }));
  }

  /** Synchronous up to the clipboard call: the code is ready before the tap. */
  protected copy(): void {
    const code = this.result()?.code;
    if (!code) {
      return;
    }
    void this.share
      .copy(code)
      .then((copied) =>
        copied
          ? toast.success(this.transloco.translate('export.copied'))
          : toast.error(this.transloco.translate('export.copyFailed')),
      );
  }

  protected async save(): Promise<void> {
    const result = this.result();
    if (!result) {
      return;
    }
    this.saving.set(true);
    try {
      const outcome = await this.share.file(result.fileName, result.json);
      if (outcome === 'downloaded') {
        toast.success(this.transloco.translate('export.saved'));
      }
    } catch {
      toast.error(this.transloco.translate('export.failed'));
    } finally {
      this.saving.set(false);
    }
  }

  /** Builds the export for a selection; an older build that finishes late is dropped. */
  private build(selection: ExportSelection | null): void {
    const request = ++this.request;
    this.result.set(null);
    if (!selection) {
      this.building.set(false);
      return;
    }
    this.building.set(true);
    this.exports.build(selection).then(
      (result) => {
        if (request === this.request) {
          this.result.set(result);
          this.building.set(false);
        }
      },
      () => {
        if (request === this.request) {
          this.building.set(false);
          toast.error(this.transloco.translate('export.failed'));
        }
      },
    );
  }
}
