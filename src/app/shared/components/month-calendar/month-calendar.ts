import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { CalendarDay } from '../../../core/history/history-insights';

function sameDay(a: Date | null, b: Date): boolean {
  return (
    !!a &&
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Month grid (Figma Verlauf · Kalender): training days in chart-1, today with a ring, the selected
 * day filled in the foreground colour. Only training days can be selected.
 */
@Component({
  selector: 'app-month-calendar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-1' },
  template: `
    <div class="grid grid-cols-7 gap-1 pb-1 text-center" aria-hidden="true">
      @for (weekday of weekdays(); track $index) {
        <span class="text-xs text-muted-foreground">{{ weekday }}</span>
      }
    </div>
    @for (week of weeks(); track $index) {
      <div class="grid grid-cols-7 gap-1">
        @for (day of week; track day.date.getTime()) {
          <div class="flex h-11 items-center justify-center">
            @if (day.inMonth) {
              @if (day.sessions.length) {
                <button
                  type="button"
                  class="flex size-9 items-center justify-center rounded-full text-sm font-semibold"
                  [class]="
                    isSelected(day)
                      ? 'bg-foreground text-background'
                      : 'bg-chart-1 text-primary-foreground'
                  "
                  [class.ring-today]="isToday(day)"
                  [attr.aria-label]="dayLabel()(day)"
                  [attr.aria-pressed]="isSelected(day)"
                  [attr.data-trained]="true"
                  (click)="selected.set(day.date)"
                >
                  {{ day.date.getDate() }}
                </button>
              } @else {
                <span
                  class="flex size-9 items-center justify-center rounded-full text-sm"
                  [class.ring-today]="isToday(day)"
                >
                  {{ day.date.getDate() }}
                </span>
              }
            }
          </div>
        }
      </div>
    }
  `,
  styles: `
    .ring-today {
      box-shadow: inset 0 0 0 1.5px var(--foreground);
    }
  `,
})
export class MonthCalendar {
  readonly weeks = input<readonly CalendarDay[][]>([]);
  /** Monday-first short weekday names. */
  readonly weekdays = input<readonly string[]>([]);
  readonly today = input.required<Date>();
  readonly selected = model<Date | null>(null);
  /** Spoken label of a training day, e.g. "Dienstag, 29. September: 1 Training". */
  readonly dayLabel = input<(day: CalendarDay) => string>(() => '');

  protected isToday(day: CalendarDay): boolean {
    return sameDay(this.today(), day.date);
  }

  protected isSelected(day: CalendarDay): boolean {
    return sameDay(this.selected(), day.date);
  }
}
