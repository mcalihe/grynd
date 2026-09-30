import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { ExerciseCatalogService } from '../../core/exercises/exercise-catalog.service';
import { PlansService } from '../../core/plans/plans.service';
import { PlanDetailPage } from './plan-detail-page';
import { targetSummary } from './plan-exercise-row';

describe('targetSummary', () => {
  it('shows a range or a fixed rep count', () => {
    expect(targetSummary(3, 8, 12)).toBe('3 × 8–12');
    expect(targetSummary(3, 10, 10)).toBe('3 × 10');
  });
});

describe('PlanDetailPage', () => {
  const draft = {
    id: 'p1',
    name: 'Oberkörper',
    weekdays: [1, 4],
    exercises: [
      {
        planExerciseId: 'pe1',
        exerciseId: 'e1',
        targetSets: 3,
        repMin: 8,
        repMax: 10,
        restSeconds: 90,
      },
    ],
  };

  async function setup(found = true) {
    TestBed.configureTestingModule({
      imports: [PlanDetailPage, TranslocoTestingModule.forRoot({ langs: { de: {} } })],
      providers: [
        provideRouter([]),
        { provide: PlansService, useValue: { getDraft: async () => (found ? draft : undefined) } },
        {
          provide: ExerciseCatalogService,
          useValue: { load: async () => undefined, nameById: () => 'Bankdrücken' },
        },
      ],
    });
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(PlanDetailPage);
    fixture.componentRef.setInput('id', 'p1');
    fixture.detectChanges();
    // ngOnInit is async and not tracked by whenStable: let its promises settle.
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();
    return { fixture, navigate };
  }

  it('shows the plan with its exercises and expands the targets', async () => {
    const { fixture } = await setup();
    const el: HTMLElement = fixture.nativeElement;

    expect(el.querySelector('h1')?.textContent).toContain('Oberkörper');
    expect(el.textContent).toContain('Bankdrücken');
    expect(el.textContent).toContain('3 × 8–10');

    el.querySelector<HTMLButtonElement>('app-plan-exercise-row button')?.click();
    fixture.detectChanges();
    expect(el.textContent).toContain('plans.restSeconds');
  });

  it('opens the editor and returns to the list for unknown plans', async () => {
    const { fixture, navigate } = await setup();
    const edit = [...fixture.nativeElement.querySelectorAll('button')].find((b: HTMLElement) =>
      b.textContent?.includes('plans.editAction'),
    ) as HTMLButtonElement;
    edit.click();
    expect(navigate).toHaveBeenCalledWith(['/plans', 'p1', 'edit']);

    TestBed.resetTestingModule();
    const missing = await setup(false);
    expect(missing.navigate).toHaveBeenCalledWith(['/plans']);
  });
});
