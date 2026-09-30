import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, UrlTree } from '@angular/router';
import { SetLog } from '../../core/db/models';
import { WorkoutExercise, WorkoutService } from '../../core/workout/workout.service';
import { repTarget } from './exercise-page';
import { exerciseProgress } from './overview-sheet';
import { activeWorkoutGuard } from './workout.routes';

describe('activeWorkoutGuard', () => {
  const setup = (active: boolean) => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: WorkoutService, useValue: { isActive: signal(active) } },
      ],
    });
    return TestBed.runInInjectionContext(() => activeWorkoutGuard());
  };

  it('lets an active workout through', () => {
    expect(setup(true)).toBe(true);
  });

  it('sends users without a workout to the plans', () => {
    const result = setup(false);
    expect(result).toBeInstanceOf(UrlTree);
    expect(String(result)).toBe('/plans');
  });
});

describe('repTarget', () => {
  it('shows a range or a fixed count', () => {
    expect(repTarget(8, 10)).toBe('8–10');
    expect(repTarget(10, 10)).toBe('10');
    expect(repTarget(null, null)).toBe('');
  });
});

describe('exerciseProgress', () => {
  const set = (done: boolean, isExtra = false) =>
    ({ completedAt: done ? '2026-01-01T00:00:00Z' : null, isExtra }) as SetLog;

  it('counts completed sets including extra sets', () => {
    const item = (sets: SetLog[]) => ({ sets }) as WorkoutExercise;
    expect(exerciseProgress(item([]))).toBe(0);
    expect(exerciseProgress(item([set(true), set(false)]))).toBe(0.5);
    expect(exerciseProgress(item([set(true), set(true), set(false, true)]))).toBeCloseTo(2 / 3);
  });
});
