import { catalogEntry } from '../../../testing/catalog';
import { Exercise } from '../db/models';
import {
  EMPTY_FILTER,
  equipmentFilterOf,
  filterExercises,
  isFilterActive,
  matchesQuery,
  normalize,
  toggle,
} from './exercise-search';

const base = { createdAt: '', updatedAt: '', deletedAt: null };
const ex = (id: string, overrides: Partial<Exercise>): Exercise =>
  ({ ...catalogEntry(id, id), ...base, ...overrides }) as Exercise;

const bench = ex('bench', {
  nameDe: 'Bankdrücken',
  nameEn: 'Bench Press',
  muscleGroup: 'chest',
  force: 'push',
  equipment: 'barbell',
});
const row = ex('row', {
  nameDe: 'Rudern am Kabel',
  nameEn: 'Seated Cable Rows',
  muscleGroup: 'back',
  force: 'pull',
  equipment: 'cable',
});
const pullup = ex('pullup', {
  nameDe: 'Klimmzüge',
  nameEn: 'Pullups',
  muscleGroup: 'back',
  force: 'pull',
  equipment: 'body only',
});
const curl = ex('curl', {
  nameDe: 'SZ-Curls',
  nameEn: 'EZ-Bar Curl',
  muscleGroup: 'arms',
  force: 'pull',
  equipment: 'e-z curl bar',
});
const all = [bench, row, pullup, curl];

describe('exercise search', () => {
  it('normalizes umlauts, ß and case', () => {
    expect(normalize('Bankdrücken')).toBe(normalize('bankdrucken'));
    expect(normalize('Bankdrücken')).toBe(normalize('BANKDRUECKEN'));
    expect(normalize('Große')).toBe('grosse');
  });

  it('matches every word in German or English names', () => {
    expect(matchesQuery(bench, 'bankdr')).toBe(true);
    expect(matchesQuery(bench, 'bench press')).toBe(true);
    expect(matchesQuery(row, 'rudern kabel')).toBe(true);
    expect(matchesQuery(row, 'rudern hantel')).toBe(false);
    expect(matchesQuery(pullup, 'klimmzuge')).toBe(true);
    expect(matchesQuery(bench, '   ')).toBe(true);
  });

  it('also finds muscle and equipment words in both languages', () => {
    expect(matchesQuery(bench, 'brust langhantel')).toBe(true);
    expect(matchesQuery(bench, 'chest barbell')).toBe(true);
    expect(matchesQuery(curl, 'bizeps')).toBe(true);
    expect(matchesQuery(curl, 'langhantel')).toBe(true);
    expect(matchesQuery(pullup, 'rücken körpergewicht')).toBe(true);
    expect(matchesQuery(row, 'rucken kabelzug')).toBe(true);
    expect(matchesQuery(row, 'brust')).toBe(false);
    expect(matchesQuery(bench, 'kurzhantel')).toBe(false);
  });

  it('maps catalog equipment values to equipment filters', () => {
    expect(equipmentFilterOf('e-z curl bar')).toBe('barbell');
    expect(equipmentFilterOf('body only')).toBe('bodyweight');
    expect(equipmentFilterOf('kettlebells')).toBeNull();
    expect(equipmentFilterOf(null)).toBeNull();
  });

  it('ORs within a group and ANDs between groups', () => {
    const chestOrBack = filterExercises(all, { ...EMPTY_FILTER, muscles: ['chest', 'back'] });
    expect(chestOrBack.map((e) => e.id)).toEqual(['bench', 'row', 'pullup']);

    const backAndPullAndCable = filterExercises(all, {
      ...EMPTY_FILTER,
      muscles: ['back'],
      forces: ['pull'],
      equipment: ['cable'],
    });
    expect(backAndPullAndCable.map((e) => e.id)).toEqual(['row']);
  });

  it('maps equipment chips to catalog values', () => {
    expect(
      filterExercises(all, { ...EMPTY_FILTER, equipment: ['barbell'] }).map((e) => e.id),
    ).toEqual(['bench', 'curl']);
    expect(
      filterExercises(all, { ...EMPTY_FILTER, equipment: ['bodyweight'] }).map((e) => e.id),
    ).toEqual(['pullup']);
  });

  describe('cardio (decision 0025)', () => {
    const run = ex('run', {
      nameDe: 'Laufen',
      nameEn: 'Running',
      category: 'cardio',
      muscleGroup: 'legs',
      equipment: 'body only',
    });
    const treadmill = ex('tread', {
      nameDe: 'Laufen auf dem Laufband',
      nameEn: 'Running, Treadmill',
      category: 'cardio',
      muscleGroup: 'legs',
      equipment: 'machine',
    });
    const squat = ex('squat', { nameDe: 'Kniebeugen', nameEn: 'Squat', muscleGroup: 'legs' });
    const withCardio = [...all, squat, run, treadmill];
    const ids = (filter: Partial<typeof EMPTY_FILTER>) =>
      filterExercises(withCardio, { ...EMPTY_FILTER, ...filter }).map((e) => e.id);

    it('shows cardio with the «Ausdauer» chip and not under a muscle', () => {
      expect(ids({ cardio: true })).toEqual(['run', 'tread']);
      expect(ids({ muscles: ['legs'] })).toEqual(['squat']);
      expect(ids({ muscles: ['legs'], cardio: true })).toEqual(['squat', 'run', 'tread']);
      expect(isFilterActive({ ...EMPTY_FILTER, cardio: true })).toBe(true);
    });

    it('still combines the chip with equipment', () => {
      expect(ids({ cardio: true, equipment: ['machine'] })).toEqual(['tread']);
    });

    it('finds cardio by «ausdauer» or «cardio», not by its muscle words', () => {
      expect(ids({ query: 'ausdauer' })).toEqual(['run', 'tread']);
      expect(ids({ query: 'cardio maschine' })).toEqual(['tread']);
      expect(matchesQuery(run, 'beine')).toBe(false);
      expect(matchesQuery(squat, 'beine')).toBe(true);
    });
  });

  it('combines filters with the query', () => {
    expect(
      filterExercises(all, { ...EMPTY_FILTER, forces: ['pull'], query: 'curl' }).map((e) => e.id),
    ).toEqual(['curl']);
  });

  it('knows when a filter is active and toggles chips', () => {
    expect(isFilterActive(EMPTY_FILTER)).toBe(false);
    expect(isFilterActive({ ...EMPTY_FILTER, query: ' x ' })).toBe(true);
    expect(toggle(['a'], 'b')).toEqual(['a', 'b']);
    expect(toggle(['a', 'b'], 'a')).toEqual(['b']);
  });
});
