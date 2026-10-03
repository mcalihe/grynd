import { catalogEntry } from '../../../testing/catalog';
import { Exercise } from '../db/models';
import {
  EMPTY_FILTER,
  filterChipLabel,
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

  it('labels a filter chip by its selection', () => {
    expect(filterChipLabel([], 'Muskelgruppe')).toBe('Muskelgruppe');
    expect(filterChipLabel(['Brust'], 'Muskelgruppe')).toBe('Brust');
    expect(filterChipLabel(['Brust', 'Beine', 'Po'], 'Muskelgruppe')).toBe('Brust +2');
  });
});
