import { Directive, input } from '@angular/core';
import { classes } from '@spartan-ng/helm/utils';
import { type VariantProps, cva } from 'class-variance-authority';

const badgeVariants = cva(
  'h-8 gap-1 rounded-full border border-transparent px-2 py-1 text-sm font-medium transition-all has-data-[icon=inline-end]:pe-1.5 has-data-[icon=inline-start]:ps-1.5 [&>ng-icon]:text-[length:--spacing(4)] group/badge focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 inline-flex w-fit shrink-0 items-center justify-center overflow-hidden whitespace-nowrap focus-visible:ring-[3px] [&>ng-icon]:pointer-events-none',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground [a]:hover:bg-primary/80',
        secondary: 'bg-secondary text-secondary-foreground [a]:hover:bg-secondary/80',
        // Figma Badge (9:265): status colors use the background color for text.
        success: 'bg-success text-background',
        warning: 'bg-warning text-background',
        destructive: 'bg-destructive text-background',
        outline: 'border-border text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground',
        ghost: 'hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50',
        link: 'text-primary underline-offset-4 hover:underline',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export type BadgeVariants = VariantProps<typeof badgeVariants>;

@Directive({
  selector: '[hlmBadge],hlm-badge',
  host: {
    'data-slot': 'badge',
    '[attr.data-variant]': 'variant()',
  },
})
export class HlmBadge {
  public readonly variant = input<BadgeVariants['variant']>('default');

  constructor() {
    classes(() => badgeVariants({ variant: this.variant() }));
  }
}
