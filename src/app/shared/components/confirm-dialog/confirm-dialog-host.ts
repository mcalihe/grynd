import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmAlertDialogImports } from '@spartan-ng/helm/alert-dialog';
import { HlmButton } from '@spartan-ng/helm/button';
import { ConfirmService } from '../../../core/services/confirm.service';

/** Renders ConfirmService requests (Figma «Änderungen verwerfen Dialog» 66:1123). Lives in the app shell. */
@Component({
  selector: 'app-confirm-dialog-host',
  imports: [HlmAlertDialogImports, HlmButton, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <hlm-alert-dialog [state]="state()" (closed)="confirm.answer('cancel')">
      <hlm-alert-dialog-content *hlmAlertDialogPortal="let ctx">
        @if (confirm.current(); as request) {
          <hlm-alert-dialog-header>
            <h2 hlmAlertDialogTitle>{{ request.title | transloco }}</h2>
            @if (request.message) {
              <p hlmAlertDialogDescription>{{ request.message | transloco }}</p>
            }
          </hlm-alert-dialog-header>
          <div class="flex flex-col gap-2">
            <button
              hlmBtn
              size="lg"
              [variant]="request.destructive ? 'destructive' : 'default'"
              (click)="confirm.answer('confirm')"
            >
              {{ request.confirm | transloco }}
            </button>
            @if (request.alternative; as alternative) {
              <button
                hlmBtn
                size="lg"
                [variant]="request.alternativeDestructive ? 'destructive' : 'secondary'"
                (click)="confirm.answer('alternative')"
              >
                {{ alternative | transloco }}
              </button>
            }
            <button hlmBtn size="lg" variant="secondary" (click)="confirm.answer('cancel')">
              {{ request.cancel | transloco }}
            </button>
          </div>
        }
      </hlm-alert-dialog-content>
    </hlm-alert-dialog>
  `,
})
export class ConfirmDialogHost {
  protected readonly confirm = inject(ConfirmService);
  protected readonly state = computed(() => (this.confirm.current() ? 'open' : 'closed'));
}
