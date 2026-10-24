import { Location } from '@angular/common';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { WhatsNewService } from '../whats-new/whats-new.service';
import { BackButtonService } from './back-button.service';
import { ImageViewerService } from './image-viewer.service';

describe('BackButtonService', () => {
  function setup(path: string, pending = 1) {
    const location = { path: () => path, back: vi.fn() };
    const whatsNew = {
      pending: signal(Array.from({ length: pending }, () => ({ version: '0.7.0', items: [] }))),
      dismiss: vi.fn(async () => undefined),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: Location, useValue: location },
        { provide: WhatsNewService, useValue: whatsNew },
      ],
    });
    return { service: TestBed.inject(BackButtonService), location, whatsNew };
  }

  it('closes the «What’s new» popup on a tab screen', () => {
    const { service, whatsNew } = setup('/history?view=stats');
    service.handle();
    expect(whatsNew.dismiss).toHaveBeenCalled();
  });

  it('navigates back where the popup is not shown', () => {
    const { service, location, whatsNew } = setup('/plans/some-plan');
    service.handle();
    expect(whatsNew.dismiss).not.toHaveBeenCalled();
    expect(location.back).toHaveBeenCalled();
  });

  it('navigates back when there is no news', () => {
    const { service, location, whatsNew } = setup('/settings/whats-new', 0);
    service.handle();
    expect(whatsNew.dismiss).not.toHaveBeenCalled();
    expect(location.back).toHaveBeenCalled();
  });

  it('closes the image viewer before anything else', () => {
    const { service, location } = setup('/plans/some-plan', 0);
    const viewer = TestBed.inject(ImageViewerService);
    viewer.open({ images: [{ id: 'i', src: 'data:image/jpeg;base64,AAAA' }], index: 0 });

    service.handle();

    expect(viewer.current()).toBeNull();
    expect(location.back).not.toHaveBeenCalled();
  });
});
