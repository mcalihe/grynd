import { TestBed } from '@angular/core/testing';
import { ConfirmOptions, ConfirmService } from './confirm.service';

const options: ConfirmOptions = { title: 't', confirm: 'yes', cancel: 'no', alternative: 'other' };

describe('ConfirmService', () => {
  let service: ConfirmService;

  beforeEach(() => {
    service = TestBed.inject(ConfirmService);
  });

  it('resolves confirm() with true only for the confirm button', async () => {
    const yes = service.confirm(options);
    service.answer('confirm');
    expect(await yes).toBe(true);

    const other = service.confirm(options);
    service.answer('alternative');
    expect(await other).toBe(false);
    expect(service.current()).toBeNull();
  });

  it('reports which of three actions was chosen', async () => {
    const choice = service.choose(options);
    expect(service.current()?.alternative).toBe('other');
    service.answer('alternative');
    expect(await choice).toBe('alternative');
  });

  it('cancels an open dialog when a new one is requested', async () => {
    const first = service.choose(options);
    const second = service.choose(options);
    expect(await first).toBe('cancel');
    service.answer('confirm');
    expect(await second).toBe('confirm');
  });
});
