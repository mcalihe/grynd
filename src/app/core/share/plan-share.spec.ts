import {
  buildPlanShare,
  planShareFileName,
  PlanShare,
  uniquePlanName,
  validatePlanShare,
} from './plan-share';

const ts = '2026-10-14T10:00:00.000Z';
const catalog = new Set(['e1', 'e2']);
const draft = {
  name: 'Oberkörper',
  weekdays: [4, 1],
  exercises: [
    {
      planExerciseId: 'pe1',
      exerciseId: 'e1',
      targetSets: 3,
      repMin: 8,
      repMax: 12,
      restSeconds: 90,
      targetDurationSec: null,
    },
    {
      planExerciseId: 'pe2',
      exerciseId: 'e2',
      targetSets: 4,
      repMin: 5,
      repMax: 5,
      restSeconds: 180,
      // A cardio exercise: 20 minutes (decision 0025).
      targetDurationSec: 1200,
    },
  ],
};

function sample(): PlanShare {
  return buildPlanShare(
    [draft],
    ts,
    [{ exerciseId: 'e1', text: 'Bank flach', images: [btoa('jpeg')] }],
    [{ exerciseId: 'e2', kg: 5, lb: null }],
  );
}

const validate = (raw: unknown) => validatePlanShare(JSON.parse(JSON.stringify(raw)), catalog);

describe('buildPlanShare', () => {
  it('keeps what to train and leaves out the ids of the sender', () => {
    const share = sample();
    expect(share.plans[0]).toEqual({
      name: 'Oberkörper',
      weekdays: [4, 1],
      exercises: [
        {
          exerciseId: 'e1',
          targetSets: 3,
          repMin: 8,
          repMax: 12,
          restSeconds: 90,
          targetDurationSec: null,
        },
        {
          exerciseId: 'e2',
          targetSets: 4,
          repMin: 5,
          repMax: 5,
          restSeconds: 180,
          targetDurationSec: 1200,
        },
      ],
    });
    expect(JSON.stringify(share)).not.toContain('pe1');
  });
});

describe('validatePlanShare', () => {
  it('accepts a share it built itself, sorting weekdays', () => {
    const result = validate(sample());
    expect(result.ok).toBe(true);
    expect(result.ok && result.share.plans[0].weekdays).toEqual([1, 4]);
    expect(result.ok && result.share.notes).toEqual(sample().notes);
  });

  it('reads shares from before cardio targets as strength exercises', () => {
    const old = JSON.parse(JSON.stringify(sample())) as PlanShare;
    old.plans[0].exercises.forEach((e) => delete (e as Partial<typeof e>).targetDurationSec);
    const result = validate(old);
    expect(result.ok && result.share.plans[0].exercises.map((e) => e.targetDurationSec)).toEqual([
      null,
      null,
    ]);
  });

  it('accepts a share without the optional lists', () => {
    const share = sample() as Partial<PlanShare>;
    delete share.notes;
    delete share.weightSteps;
    const result = validate(share);
    expect(result.ok && result.share.notes).toEqual([]);
  });

  it('rejects other files and newer versions', () => {
    expect(validate({ app: 'grynd', schemaVersion: 4, data: {} })).toEqual({
      ok: false,
      error: 'format',
    });
    expect(validate({ ...sample(), version: 2 })).toEqual({ ok: false, error: 'newerVersion' });
    expect(validate({ ...sample(), plans: [] })).toEqual({ ok: false, error: 'format' });
  });

  it('rejects values the plan editor does not allow', () => {
    const cases: ((share: PlanShare) => void)[] = [
      (s) => (s.plans[0].name = '  '),
      (s) => (s.plans[0].name = 'x'.repeat(61)),
      (s) => (s.plans[0].weekdays = [7]),
      (s) => (s.plans[0].weekdays = [1, 1]),
      (s) => (s.plans[0].exercises = []),
      (s) => (s.plans[0].exercises[0].targetSets = 21),
      (s) => (s.plans[0].exercises[0].repMin = 13),
      (s) => (s.plans[0].exercises[0].restSeconds = 601),
      (s) => (s.plans[0].exercises[0].repMax = 2.5),
      (s) => (s.plans[0].exercises[1].targetDurationSec = 0),
      (s) => (s.plans[0].exercises[1].targetDurationSec = 86_400),
      (s) => (s.notes[0].text = 'x'.repeat(501)),
      (s) => (s.notes[0].images = ['not base64!']),
      (s) => (s.notes = [s.notes[0], s.notes[0]]),
      (s) => (s.weightSteps[0].kg = 3),
      (s) => (s.weightSteps[0] = { exerciseId: 'e2', kg: null, lb: null }),
    ];
    for (const change of cases) {
      const share = sample();
      change(share);
      expect(validate(share), String(change)).toEqual({ ok: false, error: 'invalid' });
    }
  });

  it('rejects exercises this catalog does not have', () => {
    const share = sample();
    share.plans[0].exercises[1].exerciseId = 'newer';
    expect(validate(share)).toEqual({ ok: false, error: 'unknownExercise' });

    const note = sample();
    note.notes[0].exerciseId = 'newer';
    expect(validate(note)).toEqual({ ok: false, error: 'unknownExercise' });
  });
});

describe('uniquePlanName', () => {
  it('numbers names that are taken, ignoring case', () => {
    expect(uniquePlanName('Push', ['Pull'])).toBe('Push');
    expect(uniquePlanName('Push', ['push'])).toBe('Push (2)');
    expect(uniquePlanName('Push', ['Push', 'Push (2)'])).toBe('Push (3)');
  });

  it('stays within the name length', () => {
    const long = 'x'.repeat(60);
    expect(uniquePlanName(long, [long])).toBe(`${'x'.repeat(56)} (2)`);
  });
});

describe('planShareFileName', () => {
  it('uses the plan name in plain letters', () => {
    expect(planShareFileName('Oberkörper – Tag 1')).toBe('grynd-plan-oberkorper-tag-1.json');
    expect(planShareFileName('💪')).toBe('grynd-plan.json');
  });
});
