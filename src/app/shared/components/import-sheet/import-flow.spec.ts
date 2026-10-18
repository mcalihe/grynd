import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { Backup, BACKUP_TABLE_NAMES, buildBackup } from '../../../core/backup/backup';
import { BackupService } from '../../../core/backup/backup.service';
import { ConfirmChoice, ConfirmService } from '../../../core/services/confirm.service';
import { ImportFlow } from './import-flow';

describe('ImportFlow', () => {
  const backup = buildBackup(
    Object.fromEntries(BACKUP_TABLE_NAMES.map((t) => [t, []])) as unknown as Backup['data'],
    4,
    '2026-10-01T10:00:00.000Z',
  );
  let backups: { import: ReturnType<typeof vi.fn>; restore: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    backups = { import: vi.fn().mockResolvedValue(backup), restore: vi.fn() };
    TestBed.configureTestingModule({
      imports: [TranslocoTestingModule.forRoot({ langs: { de: {} } })],
      providers: [{ provide: BackupService, useValue: backups }],
    });
  });

  async function run(choice: ConfirmChoice, file: Backup = backup) {
    const confirm = TestBed.inject(ConfirmService);
    const done = TestBed.inject(ImportFlow).importBackup(file);
    const request = confirm.current()!;
    confirm.answer(choice);
    return { request, imported: await done };
  }

  it('shows the contents and merges by default', async () => {
    const { request, imported } = await run('confirm');
    expect(request.title).toBe('settings.backup.preview.title');
    expect(request.params).toMatchObject({ plans: 0, workouts: 0, notes: 0, photos: 0 });
    expect(imported).toBe(true);
    expect(backups.import).toHaveBeenCalledWith(backup, 'merge');
  });

  it('replaces everything on the destructive choice', async () => {
    await run('alternative');
    expect(backups.import).toHaveBeenCalledWith(backup, 'replace');
  });

  it('only merges a partial export: replacing would delete what it left out', async () => {
    const { request } = await run('confirm', { ...backup, complete: false });
    expect(request.alternative).toBeUndefined();
    expect(request.message).toBe('settings.backup.preview.textPartial');
    expect(backups.import).toHaveBeenCalledWith({ ...backup, complete: false }, 'merge');
  });

  it('does nothing when cancelled', async () => {
    const { imported } = await run('cancel');
    expect(imported).toBe(false);
    expect(backups.import).not.toHaveBeenCalled();
  });
});
