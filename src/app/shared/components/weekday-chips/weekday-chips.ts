import { ChangeDetectionStrategy, Component, computed, inject, model } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoService } from '@jsverse/transloco';
import { sortWeekdays, WEEK_MONDAY_FIRST, weekdayShort } from '../../utils/weekdays';

/** Toggles `day` in a weekday selection, keeping it sorted Monday-first. */
export function toggleWeekday(days: readonly number[], day: number): number[] {
  return days.includes(day) ? days.filter((d) => d !== day) : sortWeekdays([...days, day]);
}

/**
 * Seven weekday chips, Monday first (Figma «Wochentage» in 37:28125): 32 px pills,
 * primary when selected, secondary otherwise; the tap target is extended to 44 px.
 */
@Component({
  selector: 'app-weekday-chips',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-wrap gap-2', role: 'group' },
  template: `
    @for (day of days(); track day.value) {
      <button
        type="button"
        class="relative h-8 min-w-8 rounded-full px-2 text-sm font-medium after:absolute after:-inset-x-0.5 after:-inset-y-1.5"
        [class]="
          day.selected
            ? 'bg-primary text-primary-foreground'
            : 'bg-secondary text-secondary-foreground'
        "
        [attr.aria-pressed]="day.selected"
        [attr.aria-label]="day.long"
        (click)="toggle(day.value)"
      >
        {{ day.short }}
      </button>
    }
  `,
})
export class WeekdayChips {
  /** Selected days as Date#getDay numbers (0 = Sunday). */
  readonly value = model<readonly number[]>([]);

  private readonly lang = toSignal(inject(TranslocoService).langChanges$, { initialValue: 'de' });

  protected readonly days = computed(() => {
    const lang = this.lang();
    const long = new Intl.DateTimeFormat(lang, { weekday: 'long', timeZone: 'UTC' });
    return WEEK_MONDAY_FIRST.map((value) => ({
      value,
      short: weekdayShort(value, lang),
      long: long.format(new Date(Date.UTC(2024, 0, 1 + ((value + 6) % 7)))),
      selected: this.value().includes(value),
    }));
  });

  protected toggle(day: number): void {
    this.value.set(toggleWeekday(this.value(), day));
  }
}
