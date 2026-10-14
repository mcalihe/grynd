import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { PlanShareSheet } from './plan-share-sheet';

describe('PlanShareSheet', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TranslocoTestingModule.forRoot({ langs: { de: {} } })],
    });
  });

  afterEach(() =>
    document.body.querySelectorAll('.cdk-overlay-container').forEach((e) => e.remove()),
  );

  async function open(extras: { notes: boolean; photos: boolean; weightSteps: boolean }) {
    const fixture = TestBed.createComponent(PlanShareSheet);
    const share = vi.fn();
    fixture.componentInstance.share.subscribe(share);
    fixture.componentRef.setInput('hasNotes', extras.notes);
    fixture.componentRef.setInput('hasPhotos', extras.photos);
    fixture.componentRef.setInput('hasWeightSteps', extras.weightSteps);
    fixture.componentInstance.open.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    const body = document.body;
    const button = (action: string) =>
      body.querySelector<HTMLButtonElement>(`[data-action="share-${action}"]`)!;
    const toggle = async (option: string) => {
      body.querySelector<HTMLButtonElement>(`[data-option="${option}"] hlm-switch button`)!.click();
      fixture.detectChanges();
      await fixture.whenStable();
    };
    const options = () =>
      [...body.querySelectorAll('[data-option]')].map((o) => o.getAttribute('data-option'));
    return { fixture, share, button, toggle, options };
  }

  it('offers only the extras the plan has and sends notes and steps by default', async () => {
    const { share, button, options } = await open({
      notes: true,
      photos: false,
      weightSteps: true,
    });

    expect(options()).toEqual(['notes', 'weightSteps']);
    button('code').click();
    expect(share).toHaveBeenCalledWith({
      format: 'code',
      options: { notes: true, photos: false, weightSteps: true },
    });
  });

  it('shows photos only with notes, and photos allow only a file', async () => {
    const { share, button, toggle, options } = await open({
      notes: true,
      photos: true,
      weightSteps: false,
    });
    expect(options()).toEqual(['notes', 'photos']);

    await toggle('photos');
    expect(button('code').disabled).toBe(true);
    button('file').click();
    expect(share).toHaveBeenLastCalledWith({
      format: 'file',
      options: { notes: true, photos: true, weightSteps: false },
    });

    await toggle('notes');
    expect(options()).toEqual(['notes']);
    expect(button('code').disabled).toBe(false);
  });

  it('shares the bare plan when it has no extras', async () => {
    const { share, button, options } = await open({
      notes: false,
      photos: false,
      weightSteps: false,
    });
    expect(options()).toEqual([]);
    button('file').click();
    expect(share).toHaveBeenCalledWith({
      format: 'file',
      options: { notes: false, photos: false, weightSteps: false },
    });
  });
});
