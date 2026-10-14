import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon } from '@ng-icons/core';
import { toast } from '@spartan-ng/brain/sonner';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmSheetImports } from '@spartan-ng/helm/sheet';
import { HlmTextarea } from '@spartan-ng/helm/textarea';
import { ImportContent, ImportError, ImportReader } from '../../../core/share/import-reader';
import { ImportFlow } from './import-flow';

/**
 * Bottom sheet to import a shared plan or a backup (decision 0023): pick a file, or paste a code
 * or JSON. What it is shows up only after reading it; problems appear right under the field, so
 * a wrong paste can be fixed without starting over.
 */
@Component({
  selector: 'app-import-sheet',
  imports: [HlmSheetImports, HlmTextarea, HlmButton, NgIcon, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <hlm-sheet side="bottom" [state]="open() ? 'open' : 'closed'" (closed)="close()">
      <hlm-sheet-content *hlmSheetPortal="let ctx" class="max-h-[85dvh]">
        <hlm-sheet-header>
          <h3 hlmSheetTitle class="pr-8">{{ title() | transloco }}</h3>
          <p hlmSheetDescription>{{ 'import.hint' | transloco }}</p>
        </hlm-sheet-header>
        <div class="flex min-h-0 flex-col gap-4 overflow-y-auto px-4 pb-6">
          <button
            hlmBtn
            variant="secondary"
            size="lg"
            data-action="import-file"
            [disabled]="busy()"
            (click)="file.click()"
          >
            <ng-icon name="lucideFileUp" />{{ 'import.chooseFile' | transloco }}
          </button>
          <input #file type="file" accept="application/json,.json" hidden (change)="picked(file)" />

          <div class="flex flex-col gap-2">
            <textarea
              hlmTextarea
              class="max-h-[30dvh] min-h-24 shrink-0 resize-none font-mono text-xs break-all"
              autocapitalize="off"
              autocomplete="off"
              spellcheck="false"
              [attr.aria-label]="'import.paste' | transloco"
              [attr.aria-invalid]="error() ? true : null"
              [attr.aria-describedby]="error() ? 'import-error' : null"
              [placeholder]="'import.placeholder' | transloco"
              [value]="text()"
              (input)="edit($any($event.target).value)"
            ></textarea>
            @if (error(); as error) {
              <p id="import-error" class="text-xs text-destructive" role="alert">
                {{ 'import.errors.' + error | transloco }}
              </p>
            }
          </div>

          <button
            hlmBtn
            size="lg"
            class="shrink-0"
            data-action="import-text"
            [disabled]="busy() || !text().trim()"
            (click)="submit()"
          >
            {{ 'import.action' | transloco }}
          </button>
        </div>
      </hlm-sheet-content>
    </hlm-sheet>
  `,
})
export class ImportSheet {
  private readonly reader = inject(ImportReader);
  private readonly flow = inject(ImportFlow);
  private readonly transloco = inject(TranslocoService);

  readonly open = model(false);
  /** Translation key of the title, e.g. «Plan importieren» on the plans screen. */
  readonly title = input('import.title');
  /** After something was imported. */
  readonly imported = output<ImportContent['kind']>();

  protected readonly text = signal('');
  protected readonly error = signal<ImportError | null>(null);
  protected readonly busy = signal(false);

  protected edit(value: string): void {
    this.text.set(value);
    this.error.set(null);
  }

  protected async picked(input: HTMLInputElement): Promise<void> {
    const file = input.files?.[0];
    input.value = ''; // picking the same file again must fire «change» again
    if (file) {
      await this.run(() => this.reader.readFile(file));
    }
  }

  protected submit(): Promise<void> {
    return this.run(() => this.reader.read(this.text()));
  }

  protected close(): void {
    this.open.set(false);
    this.error.set(null);
  }

  private async run(read: () => Promise<ImportContent>): Promise<void> {
    this.busy.set(true);
    try {
      const content = await read();
      if (content.kind === 'error') {
        this.error.set(content.error);
        return;
      }
      // The sheet makes way for the confirmation dialog.
      this.close();
      const done =
        content.kind === 'plan'
          ? await this.flow.importPlans(content.share)
          : await this.flow.importBackup(content.backup);
      if (done) {
        this.text.set('');
        this.imported.emit(content.kind);
      }
    } catch {
      toast.error(this.transloco.translate('import.failed'));
    } finally {
      this.busy.set(false);
    }
  }
}
