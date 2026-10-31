import { planExerciseFor } from './plan-link';

describe('planExerciseFor', () => {
  const plan = [
    { id: 'p1', exerciseId: 'bench' },
    { id: 'p2', exerciseId: 'row' },
    { id: 'p3', exerciseId: 'bench' },
  ];
  // Copied in plan order (ids grow), then reordered in the workout.
  const entries = [
    { id: '03', exerciseId: 'bench' },
    { id: '01', exerciseId: 'bench' },
    { id: '02', exerciseId: 'row' },
  ];

  it('finds the plan row of an exercise', () => {
    expect(planExerciseFor(entries, '02', plan)?.id).toBe('p2');
  });

  it('tells repeated exercises apart by creation order, not by the current order', () => {
    expect(planExerciseFor(entries, '01', plan)?.id).toBe('p1');
    expect(planExerciseFor(entries, '03', plan)?.id).toBe('p3');
  });

  it('falls back to the only row of the exercise when the plan changed', () => {
    const edited = [plan[0], plan[1]];
    expect(planExerciseFor(entries, '03', edited)?.id).toBe('p1');
  });

  it('finds nothing when the exercise is no longer in the plan or ambiguous', () => {
    expect(planExerciseFor(entries, '02', [plan[0]])).toBeNull();
    const twice = [plan[0], plan[2]];
    expect(planExerciseFor([...entries, { id: '04', exerciseId: 'bench' }], '04', twice)).toBe(
      null,
    );
    expect(planExerciseFor(entries, 'unknown', plan)).toBeNull();
  });
});
