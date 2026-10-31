import { ChangeDetectionStrategy, Component, input, model, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon } from '@ng-icons/core';
import { HlmSheetImports } from '@spartan-ng/helm/sheet';
import { NgTemplateOutlet } from '@angular/common';

/** One activity in the start sheet. */
export interface CardioStartItem {
  id: string;
  name: string;
  icon: string;
}

/**
 * Bottom sheet behind «Ausdauer starten» (decision 0024, code only): recently used activities
 * first, then all A–Z. A tap emits `pick` and closes the sheet; the caller starts the workout.
 */
@Component({
  selector: 'app-cardio-start-sheet',
  imports: [HlmSheetImports, NgIcon, NgTemplateOutlet, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <hlm-sheet side="bottom" [state]="open() ? 'open' : 'closed'" (closed)="open.set(false)">
      <hlm-sheet-content *hlmSheetPortal="let ctx" class="max-h-[85dvh]">
        <hlm-sheet-header>
          <h3 hlmSheetTitle>{{ 'cardioStart.title' | transloco }}</h3>
          <p hlmSheetDescription>{{ 'cardioStart.hint' | transloco }}</p>
        </hlm-sheet-header>
        <div class="flex min-h-0 flex-col gap-1 overflow-y-auto px-4 pb-6">
          @if (recent().length) {
            <h4 class="text-sm font-medium text-muted-foreground">
              {{ 'cardioStart.recent' | transloco }}
            </h4>
            @for (item of recent(); track item.id) {
              <ng-container *ngTemplateOutlet="row; context: { $implicit: item }" />
            }
            <h4 class="pt-2 text-sm font-medium text-muted-foreground">
              {{ 'cardioStart.all' | transloco }}
            </h4>
          }
          @for (item of items(); track item.id) {
            <ng-container *ngTemplateOutlet="row; context: { $implicit: item }" />
          }
        </div>
      </hlm-sheet-content>
    </hlm-sheet>

    <ng-template #row let-item>
      <button
        type="button"
        class="flex h-14 w-full shrink-0 items-center gap-3 rounded-lg text-left active:bg-accent"
        [attr.data-activity]="item.id"
        (click)="choose(item.id)"
      >
        <span
          class="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground"
          aria-hidden="true"
        >
          <ng-icon [name]="item.icon" size="20" />
        </span>
        <span class="min-w-0 flex-1 truncate text-sm font-semibold">{{ item.name }}</span>
        <ng-icon class="text-muted-foreground" name="lucidePlay" size="18" aria-hidden="true" />
      </button>
    </ng-template>
  `,
})
export class CardioStartSheet {
  readonly open = model(false);
  /** Every activity, A–Z. */
  readonly items = input<readonly CardioStartItem[]>([]);
  /** Recently used activities, newest first. */
  readonly recent = input<readonly CardioStartItem[]>([]);
  /** The chosen activity's exercise id. */
  readonly pick = output<string>();

  protected choose(id: string): void {
    this.pick.emit(id);
    this.open.set(false);
  }
}
