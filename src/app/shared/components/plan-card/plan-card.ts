import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon } from '@ng-icons/core';
import { HlmBadge } from '@spartan-ng/helm/badge';
import { sortWeekdays, weekdayShort } from '../../utils/weekdays';

/**
 * One plan in the list (Figma «Planzeile» 37:27450, decision 0001): name, exercise count,
 * weekday chips, arrow. The whole row opens the plan; the arrow is primary for today's plans.
 */
@Component({
  selector: 'app-plan-card',
  imports: [NgIcon, HlmBadge, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block border-b' },
  template: `
    <button
      type="button"
      class="flex w-full items-center gap-3 py-2 text-left"
      (click)="open.emit()"
    >
      <span class="flex min-w-0 flex-1 flex-col gap-1">
        <span class="truncate text-sm font-semibold">{{ name() }}</span>
        <span class="text-xs text-muted-foreground">
          {{
            (exerciseCount() === 1 ? 'plans.exerciseCountOne' : 'plans.exerciseCount')
              | transloco: { count: exerciseCount() }
          }}
        </span>
        @if (dayLabels().length) {
          <span class="flex gap-1">
            @for (day of dayLabels(); track day) {
              <span hlmBadge variant="secondary">{{ day }}</span>
            }
          </span>
        }
      </span>
      <span
        class="flex size-11 shrink-0 items-center justify-center rounded-lg"
        [class]="
          today() ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
        "
        aria-hidden="true"
      >
        <ng-icon name="lucideArrowRight" size="24" />
      </span>
    </button>
  `,
})
export class PlanCard {
  readonly name = input.required<string>();
  readonly exerciseCount = input(0);
  /** Date#getDay numbers (0 = Sunday). */
  readonly weekdays = input<readonly number[]>([]);
  readonly today = input(false);

  readonly open = output<void>();

  private readonly lang = toSignal(inject(TranslocoService).langChanges$, { initialValue: 'de' });
  protected readonly dayLabels = computed(() =>
    sortWeekdays(this.weekdays()).map((day) => weekdayShort(day, this.lang())),
  );
}
