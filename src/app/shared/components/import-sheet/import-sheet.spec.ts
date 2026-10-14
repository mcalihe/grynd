import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { ImportContent, ImportReader } from '../../../core/share/import-reader';
import { PlanShare } from '../../../core/share/plan-share';
import { ImportFlow } from './import-flow';
import { ImportSheet } from './import-sheet';

describe('ImportSheet', () => {
  let read: ReturnType<typeof vi.fn<(text: string) => Promise<ImportContent>>>;
  let importPlans: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    read = vi.fn();
    importPlans = vi.fn().mockResolvedValue(true);
    TestBed.configureTestingModule({
      imports: [TranslocoTestingModule.forRoot({ langs: { de: {} } })],
      providers: [
        { provide: ImportReader, useValue: { read, readFile: vi.fn() } },
        { provide: ImportFlow, useValue: { importPlans, importBackup: vi.fn() } },
      ],
    });
  });

  afterEach(() =>
    document.body.querySelectorAll('.cdk-overlay-container').forEach((e) => e.remove()),
  );

  async function open() {
    const fixture = TestBed.createComponent(ImportSheet);
    const imported = vi.fn();
    fixture.componentInstance.imported.subscribe(imported);
    fixture.componentInstance.open.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    const body = document.body;
    const textarea = body.querySelector('textarea')!;
    const submit = body.querySelector<HTMLButtonElement>('[data-action="import-text"]')!;
    const paste = async (text: string) => {
      textarea.value = text;
      textarea.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      submit.click();
      await fixture.whenStable();
      fixture.detectChanges();
    };
    return { fixture, imported, textarea, submit, paste, body };
  }

  it('can only import once something was pasted', async () => {
    const { submit, textarea, fixture } = await open();
    expect(submit.disabled).toBe(true);
    textarea.value = 'GRYND1:abc';
    textarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(submit.disabled).toBe(false);
  });

  it('shows what is wrong under the field and keeps the sheet open', async () => {
    read.mockResolvedValue({ kind: 'error', error: 'damagedCode' });
    const { fixture, paste, body, textarea } = await open();

    await paste('GRYND1:kaputt');

    expect(body.querySelector('[role="alert"]')?.textContent).toContain(
      'import.errors.damagedCode',
    );
    expect(textarea.getAttribute('aria-invalid')).toBe('true');
    expect(fixture.componentInstance.open()).toBe(true);

    // Editing the text clears the message.
    textarea.value = 'GRYND1:neu';
    textarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(body.querySelector('[role="alert"]')).toBeNull();
  });

  it('closes and hands a shared plan to the import flow', async () => {
    const share = { plans: [] } as unknown as PlanShare;
    read.mockResolvedValue({ kind: 'plan', share });
    const { fixture, paste, imported } = await open();

    await paste('GRYND1:abc');

    expect(read).toHaveBeenCalledWith('GRYND1:abc');
    expect(importPlans).toHaveBeenCalledWith(share);
    expect(fixture.componentInstance.open()).toBe(false);
    expect(imported).toHaveBeenCalledWith('plan');
  });
});
