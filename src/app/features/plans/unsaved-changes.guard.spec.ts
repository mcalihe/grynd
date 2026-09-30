import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { ConfirmService } from '../../core/services/confirm.service';
import { PlanEditorStore } from './plan-editor.store';
import { unsavedChangesGuard } from './unsaved-changes.guard';

describe('unsavedChangesGuard', () => {
  const dirty = signal(false);
  const reset = vi.fn();
  const confirm = vi.fn();

  beforeEach(() => {
    dirty.set(false);
    reset.mockReset();
    confirm.mockReset();
    TestBed.configureTestingModule({
      providers: [
        { provide: PlanEditorStore, useValue: { dirty, reset } },
        { provide: ConfirmService, useValue: { confirm } },
      ],
    });
  });

  const run = () =>
    TestBed.runInInjectionContext(() =>
      unsavedChangesGuard(
        null,
        {} as ActivatedRouteSnapshot,
        {} as RouterStateSnapshot,
        {} as RouterStateSnapshot,
      ),
    );

  it('lets a clean editor go without asking and resets the draft', async () => {
    expect(await run()).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
    expect(reset).toHaveBeenCalledOnce();
  });

  it('asks when dirty and leaves on «Verwerfen»', async () => {
    dirty.set(true);
    confirm.mockResolvedValue(true);

    expect(await run()).toBe(true);
    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ destructive: true }));
    expect(reset).toHaveBeenCalledOnce();
  });

  it('stays and keeps the draft on «Weiter bearbeiten»', async () => {
    dirty.set(true);
    confirm.mockResolvedValue(false);

    expect(await run()).toBe(false);
    expect(reset).not.toHaveBeenCalled();
  });
});
