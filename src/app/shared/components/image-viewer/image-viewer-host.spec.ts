import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { ConfirmService } from '../../../core/services/confirm.service';
import { ImageViewerService, ViewerImage } from '../../../core/services/image-viewer.service';
import { ImageViewerHost } from './image-viewer-host';

describe('ImageViewerHost', () => {
  const images: ViewerImage[] = ['a', 'b', 'c'].map((id) => ({
    id,
    src: `data:image/jpeg;base64,${id}`,
  }));

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TranslocoTestingModule.forRoot({ langs: { de: {} } })],
    });
  });

  afterEach(() =>
    document.body.querySelectorAll('.cdk-overlay-container').forEach((e) => e.remove()),
  );

  async function show(onDelete?: (image: ViewerImage) => void) {
    const fixture = TestBed.createComponent(ImageViewerHost);
    const viewer = TestBed.inject(ImageViewerService);
    viewer.open({ images, index: 1, onDelete });
    fixture.detectChanges();
    await fixture.whenStable();
    return { fixture, viewer };
  }

  const deleteButton = () =>
    document.body.querySelector<HTMLButtonElement>('[aria-label$="imageViewer.delete"]');

  it('shows every image full screen, read-only unless deleting is allowed', async () => {
    const { fixture, viewer } = await show();

    expect(document.body.querySelectorAll('img')).toHaveLength(3);
    expect(document.body.querySelector('h2')?.textContent).toContain('imageViewer.position');
    expect(deleteButton()).toBeNull();

    document.body.querySelector<HTMLButtonElement>('[aria-label$="common.close"]')!.click();
    fixture.detectChanges();
    expect(viewer.current()).toBeNull();
  });

  it('deletes the shown image after confirming and keeps the others', async () => {
    const onDelete = vi.fn();
    const confirm = vi.spyOn(TestBed.inject(ConfirmService), 'confirm');
    confirm.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const { fixture, viewer } = await show(onDelete);

    deleteButton()!.click();
    await fixture.whenStable();
    expect(onDelete).not.toHaveBeenCalled();

    deleteButton()!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(confirm).toHaveBeenLastCalledWith(expect.objectContaining({ destructive: true }));
    expect(onDelete).toHaveBeenCalledExactlyOnceWith(images[1]);
    expect(document.body.querySelectorAll('img')).toHaveLength(2);
    expect(viewer.current()).not.toBeNull();
  });

  it('closes once the last image is deleted', async () => {
    vi.spyOn(TestBed.inject(ConfirmService), 'confirm').mockResolvedValue(true);
    const fixture = TestBed.createComponent(ImageViewerHost);
    const viewer = TestBed.inject(ImageViewerService);
    const onDelete = vi.fn();
    viewer.open({ images: [images[0]], index: 0, onDelete });
    fixture.detectChanges();
    await fixture.whenStable();

    deleteButton()!.click();
    await fixture.whenStable();

    expect(onDelete).toHaveBeenCalledOnce();
    expect(viewer.current()).toBeNull();
  });
});
