import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

/** Temporary page used by every route until the real screens land (M4–M7). */
@Component({
  selector: 'app-placeholder-page',
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="flex flex-col gap-4 px-4 pt-6">
      <h1 class="text-2xl font-semibold">{{ titleKey() | transloco }}</h1>
      <p class="text-sm text-muted-foreground">{{ 'common.placeholder' | transloco }}</p>
    </section>
  `,
})
export class PlaceholderPage {
  /** Bound from route data via withComponentInputBinding. */
  readonly titleKey = input.required<string>();
}
