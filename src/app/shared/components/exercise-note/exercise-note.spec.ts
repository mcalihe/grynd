import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { NoteImage } from '../../../core/exercises/exercise-notes.service';
import { NOTE_MAX_IMAGES } from '../../../core/exercises/note-image';
import { ImageViewerService } from '../../../core/services/image-viewer.service';
import { ExerciseNote } from './exercise-note';
import { ExerciseNoteSheet } from './exercise-note-sheet';

describe('exercise note', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TranslocoTestingModule.forRoot({ langs: { de: {} } })],
    });
  });

  afterEach(() =>
    document.body.querySelectorAll('.cdk-overlay-container').forEach((e) => e.remove()),
  );

  const photos = (count: number): NoteImage[] =>
    Array.from({ length: count }, (_, i) => ({ id: `i${i}`, src: `data:image/jpeg;base64,${i}` }));

  describe('ExerciseNote', () => {
    it('shows the note and asks to edit it on tap', () => {
      const fixture = TestBed.createComponent(ExerciseNote);
      const edit = vi.fn();
      fixture.componentInstance.edit.subscribe(edit);
      fixture.componentRef.setInput('text', 'Sitz Stufe 4\nFüsse hoch');
      fixture.detectChanges();

      const button: HTMLButtonElement = fixture.nativeElement.querySelector('button');
      expect(button.textContent).toContain('Sitz Stufe 4\nFüsse hoch');
      button.click();
      expect(edit).toHaveBeenCalledOnce();
    });

    it('shows the photos and opens the viewer at the tapped one', () => {
      const fixture = TestBed.createComponent(ExerciseNote);
      const open = vi.spyOn(TestBed.inject(ImageViewerService), 'open');
      const images = photos(3);
      fixture.componentRef.setInput('text', 'Sitz Stufe 4');
      fixture.componentRef.setInput('images', images);
      fixture.detectChanges();

      const thumbnails = fixture.nativeElement.querySelectorAll('li button');
      expect(thumbnails).toHaveLength(3);
      thumbnails[1].click();

      expect(open).toHaveBeenCalledExactlyOnceWith({ images, index: 1 });
    });

    it('names a note of photos only and still opens the editor', () => {
      const fixture = TestBed.createComponent(ExerciseNote);
      const edit = vi.fn();
      fixture.componentInstance.edit.subscribe(edit);
      fixture.componentRef.setInput('images', photos(1));
      fixture.detectChanges();

      const button: HTMLButtonElement = fixture.nativeElement.querySelector('button');
      expect(button.textContent).toContain('exerciseNote.images');
      button.click();
      expect(edit).toHaveBeenCalledOnce();
    });
  });

  describe('ExerciseNoteSheet', () => {
    async function open(note: string, images: NoteImage[] = [], pending = 0) {
      const fixture = TestBed.createComponent(ExerciseNoteSheet);
      const save = vi.fn();
      fixture.componentInstance.save.subscribe(save);
      fixture.componentRef.setInput('title', 'Beinpresse');
      fixture.componentRef.setInput('note', note);
      fixture.componentRef.setInput('images', images);
      fixture.componentRef.setInput('pending', pending);
      fixture.componentInstance.open.set(true);
      fixture.detectChanges();
      await fixture.whenStable();
      const textarea = document.body.querySelector('textarea')!;
      const done = [...document.body.querySelectorAll('button')].find((b) =>
        b.textContent?.includes('exerciseNote.done'),
      )!;
      return { fixture, save, textarea, done };
    }

    function type(textarea: HTMLTextAreaElement, value: string): void {
      textarea.value = value;
      textarea.dispatchEvent(new Event('input'));
    }

    it('starts with the saved note and saves the changed text once when closing', async () => {
      const { fixture, save, textarea, done } = await open('Sitz Stufe 4');
      expect(textarea.value).toBe('Sitz Stufe 4');

      type(textarea, 'Sitz Stufe 5');
      done.click();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(save).toHaveBeenCalledExactlyOnceWith('Sitz Stufe 5');
      expect(fixture.componentInstance.open()).toBe(false);
    });

    it('saves nothing when only whitespace changed', async () => {
      const { fixture, save, textarea, done } = await open('Griff eng');

      type(textarea, ' Griff eng \n');
      done.click();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(save).not.toHaveBeenCalled();
    });

    it('passes an emptied note on, so it can be deleted', async () => {
      const { fixture, save, textarea, done } = await open('Griff eng');

      type(textarea, '');
      done.click();
      fixture.detectChanges();

      expect(save).toHaveBeenCalledExactlyOnceWith('');
    });

    const button = (label: string) =>
      [...document.body.querySelectorAll('button')].find((b) => b.textContent?.includes(label));

    it('offers no camera button on a desktop browser', async () => {
      await open('');
      expect(button('exerciseNote.takePhoto')).toBeUndefined();
    });

    it('offers the camera on touch devices', async () => {
      // jsdom has no matchMedia: pretend to be a phone (coarse pointer).
      window.matchMedia = vi.fn(() => ({ matches: true })) as never;
      try {
        await open('');
        expect(button('exerciseNote.takePhoto')).toBeDefined();
        expect(document.body.querySelector('input[capture=environment]')).not.toBeNull();
      } finally {
        delete (window as Partial<Window>).matchMedia;
      }
    });

    it('passes picked image files on and resets the picker', async () => {
      const { fixture } = await open('');
      const addImages = vi.fn();
      fixture.componentInstance.addImages.subscribe(addImages);
      const input = document.body.querySelector<HTMLInputElement>('input[type=file][multiple]')!;
      const file = new File(['x'], 'sitz.jpg', { type: 'image/jpeg' });
      Object.defineProperty(input, 'files', { value: [file], configurable: true });

      input.dispatchEvent(new Event('change'));

      expect(addImages).toHaveBeenCalledExactlyOnceWith([file]);
      expect(input.value).toBe('');
      expect(button('exerciseNote.chooseImages')).toBeDefined();
    });

    it('shows photos and placeholders, and hides the pickers at the limit', async () => {
      await open('', photos(NOTE_MAX_IMAGES - 1), 1);

      expect(document.body.querySelectorAll('li img')).toHaveLength(NOTE_MAX_IMAGES - 1);
      expect(document.body.querySelectorAll('li[role=status]')).toHaveLength(1);
      expect(document.body.textContent).toContain(`${NOTE_MAX_IMAGES} / ${NOTE_MAX_IMAGES}`);
      expect(button('exerciseNote.chooseImages')).toBeUndefined();
    });

    it('opens a photo in the viewer, where deleting it is passed on', async () => {
      const images = photos(2);
      const { fixture } = await open('', images);
      const removeImage = vi.fn();
      fixture.componentInstance.removeImage.subscribe(removeImage);
      const viewer = TestBed.inject(ImageViewerService);

      document.body.querySelectorAll<HTMLButtonElement>('li button')[1].click();

      const request = viewer.current()!;
      expect(request.images).toEqual(images);
      expect(request.index).toBe(1);
      request.onDelete!(images[1]);
      expect(removeImage).toHaveBeenCalledExactlyOnceWith('i1');
    });
  });
});
