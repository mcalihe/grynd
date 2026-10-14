import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon } from '@ng-icons/core';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmSheetImports } from '@spartan-ng/helm/sheet';
import { HlmSwitch } from '@spartan-ng/helm/switch';
import { PlanShareOptions } from '../../../core/share/plan-share.service';

export type PlanShareFormat = 'code' | 'file';

export interface PlanShareRequest {
  format: PlanShareFormat;
  options: PlanShareOptions;
}

/**
 * Bottom sheet to share a plan as a template (decision 0027): switches for the extras the plan
 * has (notes, their photos, weight steps), then «as code» for chats or «as file». Photos make
 * the content too long for a code, so with photos only the file is offered.
 */
@Component({
  selector: 'app-plan-share-sheet',
  imports: [HlmSheetImports, HlmSwitch, HlmButton, NgIcon, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <hlm-sheet side="bottom" [state]="open() ? 'open' : 'closed'" (closed)="open.set(false)">
      <hlm-sheet-content *hlmSheetPortal="let ctx" class="max-h-[85dvh]">
        <hlm-sheet-header>
          <h3 hlmSheetTitle class="pr-8">{{ 'plans.share.title' | transloco }}</h3>
          <p hlmSheetDescription>{{ 'plans.share.hint' | transloco }}</p>
        </hlm-sheet-header>
        <div class="flex min-h-0 flex-col gap-4 overflow-y-auto px-4 pb-6">
          @if (hasNotes() || hasWeightSteps()) {
            <div class="flex flex-col divide-y rounded-xl border bg-card">
              @if (hasNotes()) {
                <div class="flex items-center gap-3 p-4" data-option="notes">
                  <span class="flex min-w-0 flex-1 flex-col gap-1">
                    <span class="text-sm font-semibold">{{ 'plans.share.notes' | transloco }}</span>
                    <span class="text-xs text-muted-foreground">
                      {{ 'plans.share.notesHint' | transloco }}
                    </span>
                  </span>
                  <hlm-switch
                    [checked]="notes()"
                    [aria-label]="'plans.share.notes' | transloco"
                    (checkedChange)="notes.set($event)"
                  />
                </div>
                @if (notes() && hasPhotos()) {
                  <div class="flex items-center gap-3 p-4" data-option="photos">
                    <span class="flex min-w-0 flex-1 flex-col gap-1">
                      <span class="text-sm font-semibold">
                        {{ 'plans.share.photos' | transloco }}
                      </span>
                      <span class="text-xs text-muted-foreground">
                        {{ 'plans.share.photosHint' | transloco }}
                      </span>
                    </span>
                    <hlm-switch
                      [checked]="photos()"
                      [aria-label]="'plans.share.photos' | transloco"
                      (checkedChange)="photos.set($event)"
                    />
                  </div>
                }
              }
              @if (hasWeightSteps()) {
                <div class="flex items-center gap-3 p-4" data-option="weightSteps">
                  <span class="flex min-w-0 flex-1 flex-col gap-1">
                    <span class="text-sm font-semibold">
                      {{ 'plans.share.weightSteps' | transloco }}
                    </span>
                    <span class="text-xs text-muted-foreground">
                      {{ 'plans.share.weightStepsHint' | transloco }}
                    </span>
                  </span>
                  <hlm-switch
                    [checked]="weightSteps()"
                    [aria-label]="'plans.share.weightSteps' | transloco"
                    (checkedChange)="weightSteps.set($event)"
                  />
                </div>
              }
            </div>
          }

          <div class="flex flex-col gap-2">
            <button
              hlmBtn
              variant="secondary"
              size="lg"
              data-action="share-code"
              [disabled]="busy() || options().photos"
              (click)="emit('code')"
            >
              <ng-icon name="lucideCopy" />{{ 'plans.share.asCode' | transloco }}
            </button>
            <button
              hlmBtn
              variant="secondary"
              size="lg"
              data-action="share-file"
              [disabled]="busy()"
              (click)="emit('file')"
            >
              <ng-icon name="lucideShare2" />{{ 'plans.share.asFile' | transloco }}
            </button>
            <p class="text-xs text-muted-foreground">
              {{
                (options().photos ? 'plans.share.photosFileOnly' : 'plans.share.codeHint')
                  | transloco
              }}
            </p>
          </div>
        </div>
      </hlm-sheet-content>
    </hlm-sheet>
  `,
})
export class PlanShareSheet {
  readonly open = model(false);
  /** The plan has an exercise with a note (text or photos). */
  readonly hasNotes = input(false);
  /** One of those notes has photos. */
  readonly hasPhotos = input(false);
  /** An exercise of the plan has its own weight step. */
  readonly hasWeightSteps = input(false);
  /** Disables the buttons while a share is being prepared. */
  readonly busy = input(false);
  readonly share = output<PlanShareRequest>();

  protected readonly notes = signal(true);
  protected readonly photos = signal(false);
  protected readonly weightSteps = signal(true);

  /** What is actually sent: only extras the plan has. */
  protected readonly options = computed<PlanShareOptions>(() => {
    const notes = this.hasNotes() && this.notes();
    return {
      notes,
      photos: notes && this.hasPhotos() && this.photos(),
      weightSteps: this.hasWeightSteps() && this.weightSteps(),
    };
  });

  protected emit(format: PlanShareFormat): void {
    this.share.emit({ format, options: this.options() });
  }
}
