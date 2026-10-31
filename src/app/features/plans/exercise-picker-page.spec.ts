import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { catalogEntry } from '../../../testing/catalog';
import { Exercise } from '../../core/db/models';
import { SessionExerciseRepository } from '../../core/db/repositories/workout.repository';
import { ExerciseCatalogService } from '../../core/exercises/exercise-catalog.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { ExercisePickerPage } from './exercise-picker-page';
import { PlanEditorStore } from './plan-editor.store';

const exercises = [
  catalogEntry('e0', 'bench', { nameDe: 'Bankdrücken', muscleGroup: 'chest' }),
  catalogEntry('e1', 'row', {
    nameDe: 'Rudern',
    muscleGroup: 'back',
    force: 'pull',
    equipment: 'cable',
  }),
  catalogEntry('e2', 'curl', {
    nameDe: 'Curls',
    muscleGroup: 'arms',
    force: 'pull',
    equipment: 'dumbbell',
  }),
].map((e) => ({ ...e, createdAt: '', updatedAt: '', deletedAt: null }) as Exercise);

describe('ExercisePickerPage', () => {
  const add = vi.fn();
  const confirm = vi.fn();

  async function setup() {
    add.mockReset();
    confirm.mockReset();
    const list = signal(exercises);
    TestBed.configureTestingModule({
      imports: [
        ExercisePickerPage,
        TranslocoTestingModule.forRoot({
          langs: { de: {} },
          translocoConfig: { availableLangs: ['de'], defaultLang: 'de' },
        }),
      ],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { parent: null } },
        {
          provide: PlanEditorStore,
          useValue: { init: async () => true, exerciseIds: signal(new Set(['e0'])), add },
        },
        {
          provide: ExerciseCatalogService,
          useValue: {
            load: async () => undefined,
            exercises: list,
            byId: computed(() => new Map(list().map((e) => [e.id, e]))),
            name: (e: Exercise) => e.nameDe,
          },
        },
        {
          provide: SessionExerciseRepository,
          useValue: { findRecentExerciseIds: async () => [] },
        },
        { provide: ConfirmService, useValue: { confirm } },
      ],
    });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(ExercisePickerPage);
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();
    return { fixture, navigate };
  }

  const rows = (el: HTMLElement) =>
    [...el.querySelectorAll<HTMLButtonElement>('button[aria-pressed], button[disabled]')].filter(
      (b) => b.querySelector('.truncate'),
    );
  const names = (el: HTMLElement) =>
    rows(el).map((r) => r.querySelector('.truncate')?.textContent?.trim());

  it('dims exercises already in the plan and adds the selection', async () => {
    const { fixture, navigate } = await setup();
    const el: HTMLElement = fixture.nativeElement;

    const bench = rows(el).find((r) => r.textContent?.includes('Bankdrücken'));
    expect(bench?.disabled).toBe(true);
    expect(bench?.textContent).toContain('picker.inPlan');

    rows(el)
      .find((r) => r.textContent?.includes('Rudern'))
      ?.click();
    fixture.detectChanges();
    const addButton = el.querySelector<HTMLButtonElement>('app-sticky-action button');
    expect(addButton?.disabled).toBe(false);
    addButton?.click();

    expect(add).toHaveBeenCalledWith(['e1']);
    expect(navigate).toHaveBeenCalledWith(['..'], expect.anything());
  });

  it('asks before closing with a selection and stays on «Weiter auswählen»', async () => {
    const { fixture, navigate } = await setup();
    const el: HTMLElement = fixture.nativeElement;
    rows(el)
      .find((r) => r.textContent?.includes('Curls'))
      ?.click();
    confirm.mockResolvedValue(false);

    el.querySelector<HTMLButtonElement>('header button')?.click();
    await new Promise((resolve) => setTimeout(resolve));

    expect(confirm).toHaveBeenCalledOnce();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('filters by muscle with one tap per chip', async () => {
    const { fixture } = await setup();
    const el: HTMLElement = fixture.nativeElement;
    const chip = (label: string) =>
      [...el.querySelectorAll<HTMLButtonElement>('[role=group] button')].find(
        (b) => b.textContent?.trim() === label,
      );
    expect(chip('forces.push')).toBeUndefined();

    chip('muscles.arms')?.click();
    fixture.detectChanges();
    expect(names(el)).toEqual(['Curls']);
    expect(chip('muscles.arms')?.getAttribute('aria-pressed')).toBe('true');
    expect(el.querySelector('[aria-live]')?.textContent).toContain('picker.countOne');

    chip('muscles.arms')?.click();
    fixture.detectChanges();
    expect(names(el)).toEqual(['Bankdrücken', 'Curls', 'Rudern']);
  });

  it('filters by equipment from a dropdown that stays open while picking', async () => {
    const { fixture } = await setup();
    const el: HTMLElement = fixture.nativeElement;
    const trigger = () =>
      [...el.querySelectorAll<HTMLButtonElement>('button[aria-haspopup]')].find((b) =>
        b.textContent?.match(/picker\.allEquipment|equipment\./),
      );
    const item = (label: string) =>
      [...document.querySelectorAll<HTMLButtonElement>('[role=menuitemcheckbox]')].find(
        (b) => b.textContent?.trim() === label,
      );

    trigger()?.click();
    fixture.detectChanges();
    item('equipment.cable')?.click();
    fixture.detectChanges();

    expect(names(el)).toEqual(['Rudern']);
    expect(trigger()?.textContent).toContain('equipment.cable');
    expect(item('equipment.dumbbell')).toBeDefined();

    item('equipment.dumbbell')?.click();
    fixture.detectChanges();
    expect(names(el)).toEqual(['Curls', 'Rudern']);
    expect(trigger()?.textContent).toContain('+1');

    item('picker.allEquipment')?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(names(el)).toEqual(['Bankdrücken', 'Curls', 'Rudern']);
    expect(trigger()?.textContent).toContain('picker.allEquipment');
  });

  it('clears muscle and equipment filters at once and keeps the search', async () => {
    const { fixture } = await setup();
    const el: HTMLElement = fixture.nativeElement;
    const clearAll = () =>
      [...el.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
        b.textContent?.includes('picker.clearFilters'),
      );
    const chip = (label: string) =>
      [...el.querySelectorAll<HTMLButtonElement>('[role=group] button')].find(
        (b) => b.textContent?.trim() === label,
      );
    const input = el.querySelector<HTMLInputElement>('input[type=search]')!;
    expect(clearAll()).toBeUndefined();

    input.value = 'rud';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(clearAll()).toBeUndefined();
    expect(el.querySelector('section h2')?.textContent).toContain('picker.countOne');

    chip('muscles.arms')?.click();
    fixture.detectChanges();
    expect(names(el)).toEqual([]);

    clearAll()?.click();
    fixture.detectChanges();
    expect(clearAll()).toBeUndefined();
    expect(chip('muscles.arms')?.getAttribute('aria-pressed')).toBe('false');
    expect(input.value).toBe('rud');
    expect(names(el)).toEqual(['Rudern']);
  });

  it('finds exercises by muscle and equipment words', async () => {
    const { fixture } = await setup();
    const el: HTMLElement = fixture.nativeElement;
    const input = el.querySelector<HTMLInputElement>('input[type=search]')!;
    input.value = 'bizeps kurzhantel';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(names(el)).toEqual(['Curls']);
  });

  it('clears the search with its button', async () => {
    const { fixture } = await setup();
    const el: HTMLElement = fixture.nativeElement;
    const input = el.querySelector<HTMLInputElement>('input[type=search]')!;
    const clear = () => el.querySelector<HTMLButtonElement>('[aria-label="picker.clearSearch"]');
    expect(clear()).toBeNull();

    input.value = 'rud';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(rows(el)).toHaveLength(1);

    clear()?.click();
    fixture.detectChanges();
    expect(input.value).toBe('');
    expect(rows(el)).toHaveLength(3);
  });
});
