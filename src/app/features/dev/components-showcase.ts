import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NgIcon } from '@ng-icons/core';
import { HlmAlertDialogImports } from '@spartan-ng/helm/alert-dialog';
import { HlmBadge } from '@spartan-ng/helm/badge';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmDropdownMenuImports } from '@spartan-ng/helm/dropdown-menu';
import { HlmInput } from '@spartan-ng/helm/input';
import { HlmPopoverImports } from '@spartan-ng/helm/popover';
import { HlmSheetImports } from '@spartan-ng/helm/sheet';
import { HlmSwitchImports } from '@spartan-ng/helm/switch';
import { HlmToggleGroupImports } from '@spartan-ng/helm/toggle-group';
import { ThemeMode, ThemeService } from '../../core/services/theme.service';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { PlanCard } from '../../shared/components/plan-card/plan-card';
import { ProgressRing } from '../../shared/components/progress-ring/progress-ring';
import { SegmentProgress } from '../../shared/components/segment-progress/segment-progress';
import { SegmentedControl } from '../../shared/components/segmented-control/segmented-control';
import { SetRow, SetRowState } from '../../shared/components/set-row/set-row';
import { StickyAction } from '../../shared/components/sticky-action/sticky-action';
import { TimerBar } from '../../shared/components/timer-bar/timer-bar';
import { WeekdayChips } from '../../shared/components/weekday-chips/weekday-chips';

/**
 * Dev-only catalogue of every UI building block in all states (route /dev/components, not in
 * production builds). Labels here are developer-facing and intentionally not translated.
 */
@Component({
  selector: 'app-components-showcase',
  imports: [
    NgIcon,
    HlmButton,
    HlmBadge,
    HlmInput,
    HlmSwitchImports,
    HlmToggleGroupImports,
    HlmDropdownMenuImports,
    HlmPopoverImports,
    HlmSheetImports,
    HlmAlertDialogImports,
    SetRow,
    ProgressRing,
    SegmentProgress,
    TimerBar,
    PageHeader,
    PlanCard,
    StickyAction,
    WeekdayChips,
    SegmentedControl,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './components-showcase.html',
})
export class ComponentsShowcase {
  protected readonly theme = inject(ThemeService);
  protected readonly themeModes: ThemeMode[] = ['system', 'light', 'dark'];
  protected readonly buttonVariants = [
    'default',
    'secondary',
    'outline',
    'ghost',
    'destructive',
  ] as const;
  protected readonly setStates: SetRowState[] = ['open', 'completed', 'record', 'menu-open'];
  protected readonly ringValues = [0, 1 / 3, 1 / 2, 2 / 3, 1];
  protected readonly segments = [
    { done: 3, total: 3 },
    { done: 2, total: 3 },
    { done: 1, total: 3 },
    { done: 0, total: 3 },
    { done: 0, total: 4 },
    { done: 0, total: 3 },
  ];
  protected readonly restSeconds = signal(90);
  protected readonly weekdays = signal<readonly number[]>([1, 4]);
  protected readonly themeOptions = [
    { value: 'system' as const, label: 'Automatisch' },
    { value: 'light' as const, label: 'Hell' },
    { value: 'dark' as const, label: 'Dunkel' },
  ];
  protected readonly unit = signal<'kg' | 'lb'>('kg');
  protected readonly unitOptions = [
    { value: 'kg' as const, label: 'kg' },
    { value: 'lb' as const, label: 'lb' },
  ];
  protected readonly buttonSizes = ['sm', 'default', 'lg'] as const;
  protected readonly badgeVariants = [
    'default',
    'secondary',
    'success',
    'warning',
    'destructive',
  ] as const;
}
