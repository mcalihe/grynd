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
  catalogEntry('e1', 'row', { nameDe: 'Rudern', muscleGroup: 'back', force: 'pull' }),
  catalogEntry('e2', 'curl', { nameDe: 'Curls', muscleGroup: 'arms', force: 'pull' }),
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

  it('filters per group tab with one tap and resets the chips', async () => {
    const { fixture } = await setup();
    const el: HTMLElement = fixture.nativeElement;
    const names = () => rows(el).map((r) => r.querySelector('.truncate')?.textContent?.trim());
    const chips = () =>
      [...el.querySelectorAll<HTMLButtonElement>('[role=group] button')].map((b) =>
        b.textContent?.trim(),
      );
    const chip = (label: string) =>
      [...el.querySelectorAll<HTMLButtonElement>('[role=group] button')].find(
        (b) => b.textContent?.trim() === label,
      );
    const tab = (label: string) =>
      [...el.querySelectorAll<HTMLButtonElement>('[role=radio]')].find((b) =>
        b.textContent?.includes(label),
      );
    const reset = () =>
      [...el.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
        b.textContent?.includes('picker.reset'),
      );
    expect(chips()).toContain('muscles.chest');
    expect(reset()).toBeUndefined();

    chip('muscles.arms')?.click();
    fixture.detectChanges();

    expect(names()).toEqual(['Curls']);
    expect(el.querySelector('[aria-live]')?.textContent).toContain('picker.countOne');
    expect(tab('picker.groups.muscles')?.textContent).toContain('· 1');

    tab('picker.groups.forces')?.click();
    fixture.detectChanges();
    expect(chips()).toEqual(['forces.push', 'forces.pull']);
    expect(names()).toEqual(['Curls']);

    reset()?.click();
    fixture.detectChanges();

    expect(names()).toEqual(['Bankdrücken', 'Curls', 'Rudern']);
    expect(reset()).toBeUndefined();
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
