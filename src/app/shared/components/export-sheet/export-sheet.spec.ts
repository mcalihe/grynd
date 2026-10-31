import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { ExportSelection } from '../../../core/backup/backup';
import { PlansService } from '../../../core/plans/plans.service';
import { ExportService } from '../../../core/share/export.service';
import { ShareService } from '../../../core/share/share.service';
import { ExportSheet } from './export-sheet';

describe('ExportSheet', () => {
  let build: ReturnType<typeof vi.fn<(selection: ExportSelection) => Promise<unknown>>>;
  let copy: ReturnType<typeof vi.fn>;
  let file: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    build = vi.fn(async (selection: ExportSelection) => ({
      json: JSON.stringify(selection),
      fileName: 'grynd.json',
      code: selection.photos ? null : `GRYND1:${selection.history ? 'mitVerlauf' : 'vorlage'}`,
    }));
    copy = vi.fn().mockResolvedValue(true);
    file = vi.fn().mockResolvedValue('downloaded');
    const plans = signal([
      { plan: { id: 'p1', name: 'Push' }, exerciseCount: 1 },
      { plan: { id: 'p2', name: 'Beine' }, exerciseCount: 1 },
    ]);
    TestBed.configureTestingModule({
      imports: [TranslocoTestingModule.forRoot({ langs: { de: {} } })],
      providers: [
        { provide: PlansService, useValue: { plans, load: vi.fn() } },
        { provide: ExportService, useValue: { build } },
        { provide: ShareService, useValue: { copy, file } },
      ],
    });
  });

  afterEach(() =>
    document.body.querySelectorAll('.cdk-overlay-container').forEach((e) => e.remove()),
  );

  async function open(planId: string | null) {
    const fixture = TestBed.createComponent(ExportSheet);
    fixture.componentRef.setInput('planId', planId);
    fixture.componentInstance.open.set(true);
    const settle = async () => {
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
    };
    await settle();
    const body = document.body;
    const button = (action: string) =>
      body.querySelector<HTMLButtonElement>(`[data-action="export-${action}"]`)!;
    const code = () => body.querySelector<HTMLTextAreaElement>('[data-field="code"]')!;
    const toggle = async (option: string) => {
      body.querySelector<HTMLButtonElement>(`[data-option="${option}"] hlm-switch button`)!.click();
      await settle();
    };
    const checkboxes = () => [
      ...body.querySelectorAll<HTMLElement>('[data-list="plans"] [role="checkbox"]'),
    ];
    return { fixture, button, code, toggle, checkboxes, settle, body };
  }

  it('starts from a plan with that plan as a template', async () => {
    const { code, checkboxes } = await open('p1');

    expect(build).toHaveBeenLastCalledWith({
      plans: ['p1'],
      history: false,
      notes: true,
      photos: false,
      weightSteps: true,
    });
    expect(checkboxes().map((c) => c.getAttribute('aria-checked'))).toEqual(['true', 'false']);
    expect(code().value).toBe('GRYND1:vorlage');
  });

  it('starts from the settings with everything, which only works as a file', async () => {
    const { button } = await open(null);

    expect(build).toHaveBeenLastCalledWith({
      plans: 'all',
      history: true,
      notes: true,
      photos: true,
      weightSteps: true,
    });
    expect(button('code').disabled).toBe(true);
    expect(button('file').disabled).toBe(false);
  });

  it('builds a new code when the selection changes and copies it', async () => {
    const { button, code, toggle } = await open(null);
    await toggle('photos');
    await toggle('weightSteps');

    expect(build).toHaveBeenLastCalledWith(
      expect.objectContaining({ photos: false, weightSteps: false }),
    );
    expect(code().value).toBe('GRYND1:mitVerlauf');
    button('code').click();
    expect(copy).toHaveBeenCalledWith('GRYND1:mitVerlauf');

    button('file').click();
    await Promise.resolve();
    expect(file).toHaveBeenCalledWith('grynd.json', expect.any(String));
  });

  it('needs at least one plan', async () => {
    const { button, checkboxes, settle } = await open('p1');
    checkboxes()[0].click();
    await settle();

    expect(button('code').disabled).toBe(true);
    expect(button('file').disabled).toBe(true);
  });
});
