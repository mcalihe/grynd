import { Directive, input, signal } from '@angular/core';
import { BrnButton } from '@spartan-ng/brain/button';
import { classes } from '@spartan-ng/helm/utils';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ClassValue } from 'clsx';
import { injectBrnButtonConfig } from './hlm-button.token';

// Adapted to Figma "Button" (9:206): heights 44/48/56, radius-lg (16px), semibold 14px, 24px icons,
// pressed = ring/accent with ring border, disabled = muted (no opacity).
export const buttonVariants = cva(
  "focus-visible:border-ring focus-visible:ring-ring/50 data-[matches-spartan-invalid=true]:ring-destructive/20 dark:data-[matches-spartan-invalid=true]:ring-destructive/40 data-[matches-spartan-invalid=true]:border-destructive dark:data-[matches-spartan-invalid=true]:border-destructive/50 group/button inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-transparent bg-clip-padding text-sm font-semibold whitespace-nowrap transition-colors outline-none select-none focus-visible:ring-3 data-disabled:pointer-events-none data-disabled:border-transparent data-disabled:bg-muted data-disabled:text-muted-foreground data-[matches-spartan-invalid=true]:ring-3 [&_ng-icon]:pointer-events-none [&_ng-icon]:shrink-0 [&_ng-icon:not([class*='text-'])]:text-[length:--spacing(6)]",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground active:border-ring active:bg-ring',
        secondary:
          'bg-secondary text-secondary-foreground active:border-ring active:bg-accent active:text-accent-foreground aria-expanded:bg-accent aria-expanded:text-accent-foreground',
        outline:
          'border-border bg-background text-foreground active:border-ring active:bg-accent active:text-accent-foreground aria-expanded:bg-accent aria-expanded:text-accent-foreground',
        ghost:
          'text-foreground active:border-ring active:bg-accent active:text-accent-foreground aria-expanded:bg-accent aria-expanded:text-accent-foreground',
        destructive: 'bg-destructive text-background active:border-ring',
        link: 'text-foreground underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-11 px-3',
        default: 'h-12 px-4',
        lg: 'h-14 px-6',
        icon: 'size-11',
        'icon-lg': 'size-12',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export type ButtonVariants = VariantProps<typeof buttonVariants>;

@Directive({
  selector: 'button[hlmBtn], a[hlmBtn]',
  exportAs: 'hlmBtn',
  hostDirectives: [{ directive: BrnButton, inputs: ['disabled'] }],
  host: { 'data-slot': 'button' },
})
export class HlmButton {
  private readonly _config = injectBrnButtonConfig();

  private readonly _additionalClasses = signal<ClassValue>('');

  public readonly variant = input<ButtonVariants['variant']>(this._config.variant);

  public readonly size = input<ButtonVariants['size']>(this._config.size);

  constructor() {
    classes(() => [
      buttonVariants({ variant: this.variant(), size: this.size() }),
      this._additionalClasses(),
    ]);
  }

  setClass(classes: string): void {
    this._additionalClasses.set(classes);
  }
}
