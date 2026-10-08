import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
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
  });

  describe('ExerciseNoteSheet', () => {
    async function open(note: string) {
      const fixture = TestBed.createComponent(ExerciseNoteSheet);
      const save = vi.fn();
      fixture.componentInstance.save.subscribe(save);
      fixture.componentRef.setInput('title', 'Beinpresse');
      fixture.componentRef.setInput('note', note);
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
  });
});
