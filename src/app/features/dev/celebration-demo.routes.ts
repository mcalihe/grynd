import { Routes } from '@angular/router';
import { HistoryDetail, HistoryService } from '../../core/history/history.service';

/** Fixed workout for previewing the celebration screen (dev only, not translated). */
const DEMO: HistoryDetail = {
  summary: {
    id: 'demo',
    planId: null,
    planName: 'Oberkörper',
    startedAt: '2026-10-02T17:00:00.000Z',
    finishedAt: '2026-10-02T18:07:00.000Z',
    exerciseCount: 2,
    setCount: 14,
    volumeKg: 8420,
  },
  exercises: [
    {
      exerciseId: 'demo',
      timeMs: 0,
      sets: [
        { id: 'a', weightKg: 85, reps: 8, isExtra: false, record: true },
        { id: 'b', weightKg: 87.5, reps: 6, isExtra: false, record: true },
      ],
    },
  ],
};

/** /dev/celebration/demo: the celebration screen with demo data instead of the database. */
export const CELEBRATION_DEMO_ROUTES: Routes = [
  {
    path: ':sessionId',
    providers: [{ provide: HistoryService, useValue: { detail: async () => DEMO } }],
    loadComponent: () =>
      import('../workout/workout-complete-page').then((m) => m.WorkoutCompletePage),
  },
];
