import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

export interface SegmentedOption<T> {
  value: T;
  label: string;
}

/**
 * Single choice out of 2–3 options (Figma Grynd/Segmented Control 84:2788), e.g. theme,
 * units and language in the settings. Behaves like a radio group.
 */
@Component({
  selector: 'app-segmented-control',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'bg-muted flex h-13 items-center rounded-lg border p-1', role: 'radiogroup' },
  template: `
    @for (option of options(); track option.value) {
      <button
        type="button"
        role="radio"
        class="h-11 min-w-0 flex-1 truncate rounded-lg px-2 text-sm font-medium"
        [class]="
          option.value === value() ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground'
        "
        [attr.aria-checked]="option.value === value()"
        (click)="value.set(option.value)"
      >
        {{ option.label }}
      </button>
    }
  `,
})
export class SegmentedControl<T> {
  readonly options = input.required<readonly SegmentedOption<T>[]>();
  readonly value = model.required<T>();
}
