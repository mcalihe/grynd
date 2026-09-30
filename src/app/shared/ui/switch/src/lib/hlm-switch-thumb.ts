import { Directive } from '@angular/core';
import { BrnSwitchThumb } from '@spartan-ng/brain/switch';
import { classes } from '@spartan-ng/helm/utils';

@Directive({
  selector: '[hlmSwitchThumb],hlm-switch-thumb',
  hostDirectives: [BrnSwitchThumb],
  host: { 'data-slot': 'switch-thumb' },
})
export class HlmSwitchThumb {
  constructor() {
    classes(
      () =>
        'bg-card rounded-full shadow-sm group-data-[size=default]/switch:size-6 group-data-[size=sm]/switch:size-[18px] data-unchecked:translate-x-0 data-checked:ltr:translate-x-5 data-checked:rtl:-translate-x-5 pointer-events-none block ring-0 transition-transform',
    );
  }
}
