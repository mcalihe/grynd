import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
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
import { HistoryRow } from '../../shared/components/history-row/history-row';
import { PlanCard } from '../../shared/components/plan-card/plan-card';
import { ProgressRing } from '../../shared/components/progress-ring/progress-ring';
import { WeekChart, WeekChartBar } from '../../shared/components/week-chart/week-chart';
import { BarChart, BarChartBar } from '../../shared/components/bar-chart/bar-chart';
import { DonutChart, DonutSegment } from '../../shared/components/donut-chart/donut-chart';
import { KeyFigure, KeyFigures } from '../../shared/components/key-figures/key-figures';
import { MonthCalendar } from '../../shared/components/month-calendar/month-calendar';
import { PeriodPager } from '../../shared/components/period-pager/period-pager';
import { Sparkline } from '../../shared/components/sparkline/sparkline';
import { calendarMonth } from '../../core/history/history-insights';
import { SegmentProgress } from '../../shared/components/segment-progress/segment-progress';
import { SegmentedControl } from '../../shared/components/segmented-control/segmented-control';
import { SetRow, SetRowState } from '../../shared/components/set-row/set-row';
import { StickyAction } from '../../shared/components/sticky-action/sticky-action';
import { TimerBar } from '../../shared/components/timer-bar/timer-bar';
import { WeekdayChips } from '../../shared/components/weekday-chips/weekday-chips';
import { CelebrationService } from '../../shared/motion/celebration.service';
import { ExerciseCelebration } from '../workout/exercise-celebration';

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
    WeekChart,
    BarChart,
    KeyFigures,
    PeriodPager,
    MonthCalendar,
    DonutChart,
    Sparkline,
    HistoryRow,
    StickyAction,
    WeekdayChips,
    SegmentedControl,
    ExerciseCelebration,
    RouterLink,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './components-showcase.html',
})
export class ComponentsShowcase {
  protected readonly weekBars: WeekChartBar[] = [
    { label: 'Mo', trained: false, value: 0 },
    { label: 'Di', trained: true, value: 0.8 },
    { label: 'Mi', trained: false, value: 0 },
    { label: 'Do', trained: true, value: 0.9 },
    { label: 'Fr', trained: false, value: 0 },
    { label: 'Sa', trained: true, value: 1 },
    { label: 'So', trained: false, value: 0 },
  ];

  // Statistics (Verlauf · Statistik, Kalender, Plan-Verlauf)
  protected readonly figures: KeyFigure[] = [
    { label: 'Trainings', value: '12', delta: '+2', tone: 'up' },
    { label: 'Dauer', value: '11 Std.', delta: '+1 Std. 5 Min.', tone: 'neutral' },
    { label: 'Volumen', value: '103 040 kg', delta: '+8 320 kg', tone: 'up' },
    { label: 'Sätze', value: '214', delta: '−4', tone: 'down' },
  ];
  protected readonly figure = signal(2);
  protected readonly monthBars: BarChartBar[] = Array.from({ length: 30 }, (_, i) => {
    const trained = [0, 2, 4, 7, 9, 11, 14, 16, 18, 21, 23, 28].includes(i);
    return {
      value: trained ? 0.8 + ((i * 7) % 5) / 25 : 0,
      filled: trained,
      label: i % 7 === 0 ? String(i + 1) : '',
      description: `${i + 1}. September`,
    };
  });
  protected readonly today = new Date(2026, 8, 30);
  protected readonly calendarDay = signal<Date | null>(new Date(2026, 8, 29));
  protected readonly calendar = calendarMonth(
    this.today,
    [1, 3, 5, 8, 10, 12, 15, 17, 19, 22, 24, 29].map((day) => ({
      id: `d${day}`,
      planId: 'p1',
      planName: 'Oberkörper',
      startedAt: new Date(2026, 8, day, 18).toISOString(),
      finishedAt: new Date(2026, 8, day, 19).toISOString(),
      exerciseCount: 6,
      setCount: 18,
      volumeKg: 8420,
    })),
  );
  protected readonly muscles: DonutSegment[] = (
    [
      ['chest', 'Brust', 48],
      ['back', 'Rücken', 44],
      ['shoulders', 'Schultern', 30],
      ['legs', 'Beine', 41],
      ['glutes', 'Po', 0],
      ['arms', 'Arme', 27],
      ['core', 'Core', 12],
    ] as const
  ).map(([key, label, value]) => ({ key, label, value, color: `var(--muscle-${key})` }));

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
  /** Live demo of the rolling clock: counts down from 0:15 and restarts. */
  protected readonly demoRemainingMs = signal(15_000);
  private readonly demoTick = setInterval(
    () => this.demoRemainingMs.update((ms) => (ms <= 0 ? 15_000 : ms - 1000)),
    1000,
  );
  private readonly demoCleanup = inject(DestroyRef).onDestroy(() => clearInterval(this.demoTick));
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

  // Celebrations (decision 0015): replay each moment.
  protected readonly celebration = inject(CelebrationService);
  protected readonly demoState = signal<SetRowState>('open');
  protected readonly demoSegments = signal([
    { done: 3, total: 3 },
    { done: 2, total: 3 },
    { done: 0, total: 3 },
  ]);
  protected readonly demoMoment = signal<DOMRect | null | undefined>(undefined);
  private readonly demoProgress = viewChild<SegmentProgress>('demoProgress');
  private stopFinale?: () => void;

  /** Set rows only celebrate transitions: go back to open first. */
  protected replaySet(state: 'completed' | 'record'): void {
    this.demoState.set('open');
    setTimeout(() => this.demoState.set(state), 50);
  }

  protected replayExercise(): void {
    this.demoSegments.update(([a, , c]) => [a, { done: 3, total: 3 }, c]);
    this.demoMoment.set(this.demoProgress()?.segmentRect(1) ?? null);
  }

  protected demoLanded(): void {
    void this.demoProgress()?.flash(1);
    this.celebration.collect(this.demoProgress()?.segmentRect(1));
    setTimeout(() => this.demoSegments.update(([a, , c]) => [a, { done: 2, total: 3 }, c]), 1500);
  }

  protected replayFinale(): void {
    this.stopFinale?.();
    this.stopFinale = this.celebration.finale();
  }
  protected readonly badgeVariants = [
    'default',
    'secondary',
    'success',
    'warning',
    'destructive',
  ] as const;
}
