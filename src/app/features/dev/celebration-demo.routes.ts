import { Routes } from '@angular/router';
import { HistoryDetail, HistoryService } from '../../core/history/history.service';

const noCardio = { durationSec: null, distanceM: null, level: null, kcal: null, heartRate: null };

/** Fixed workout for previewing the celebration screen (dev only, not translated). */
const DEMO: HistoryDetail = {
  summary: {
    id: 'demo',
    planId: null,
    planName: 'Oberkörper',
    startedAt: '2026-10-02T17:00:00.000Z',
    finishedAt: '2026-10-02T18:07:00.000Z',
    pausedMs: 0,
    exerciseCount: 2,
    setCount: 14,
    volumeKg: 8420,
    activityId: null,
    cardioCount: 0,
    distanceM: 0,
    bodyWeightKg: 80,
    energy: { kcal: 313, estimated: true },
  },
  exercises: [
    {
      exerciseId: 'demo',
      exerciseKey: 'demo',
      cardio: false,
      timeMs: 0,
      sets: [
        { id: 'a', weightKg: 85, reps: 8, ...noCardio, isExtra: false, record: true },
        { id: 'b', weightKg: 87.5, reps: 6, ...noCardio, isExtra: false, record: true },
      ],
    },
  ],
};

/** A run without a plan (decision 0024): calories, distance and pace instead of sets. */
const CARDIO: HistoryDetail = {
  summary: {
    ...DEMO.summary,
    id: 'cardio',
    // Named directly: the demo has no catalog to look the activity up in.
    planName: 'Laufen',
    activityId: 'cardio',
    finishedAt: '2026-10-02T17:26:00.000Z',
    exerciseCount: 1,
    setCount: 0,
    volumeKg: 0,
    cardioCount: 1,
    distanceM: 5200,
    bodyWeightKg: 75,
    energy: { kcal: 401, estimated: true },
  },
  exercises: [
    {
      exerciseId: 'cardio',
      exerciseKey: 'Grynd_Running',
      cardio: true,
      timeMs: 0,
      sets: [
        {
          id: 'c',
          weightKg: null,
          reps: null,
          durationSec: 1560,
          distanceM: 5200,
          level: null,
          kcal: null,
          heartRate: 152,
          isExtra: false,
          record: false,
        },
      ],
    },
  ],
};

/**
 * /dev/celebration/demo (strength) and /dev/celebration/cardio: the celebration screen with demo
 * data instead of the database.
 */
export const CELEBRATION_DEMO_ROUTES: Routes = [
  {
    path: ':sessionId',
    providers: [
      {
        provide: HistoryService,
        useValue: { detail: async (id: string) => (id === 'cardio' ? CARDIO : DEMO) },
      },
    ],
    loadComponent: () =>
      import('../workout/workout-complete-page').then((m) => m.WorkoutCompletePage),
  },
];
