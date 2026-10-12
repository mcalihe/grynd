import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { APP_VERSION } from '../../../core/app-info';
import { ReleaseNotes, releasedNotes } from '../../../core/whats-new/release-notes';
import { WhatsNewPage } from '../../../features/settings/whats-new-page';
import { WhatsNewDialog } from './whats-new-dialog';

const NOTES: ReleaseNotes[] = [
  { version: '0.8.0', items: [{ id: 'charts', icon: 'lucideChartLine' }] },
  {
    version: '0.7.0',
    items: [
      { id: 'notes', icon: 'lucideStickyNote' },
      { id: 'timer', icon: 'lucideTimer' },
    ],
  },
];

describe('what’s new', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        TranslocoTestingModule.forRoot({
          langs: { de: {} },
          translocoConfig: { availableLangs: ['de'], defaultLang: 'de' },
        }),
      ],
      providers: [provideRouter([])],
    });
  });

  afterEach(() =>
    document.body.querySelectorAll('.cdk-overlay-container').forEach((e) => e.remove()),
  );

  describe('WhatsNewDialog', () => {
    async function open() {
      const fixture = TestBed.createComponent(WhatsNewDialog);
      const closed = vi.fn();
      fixture.componentInstance.closed.subscribe(closed);
      fixture.componentRef.setInput('version', '0.8.0');
      fixture.componentRef.setInput('notes', NOTES);
      fixture.componentRef.setInput('open', true);
      fixture.detectChanges();
      await fixture.whenStable();
      return { fixture, closed };
    }

    it('lists the changes of every version it gets', async () => {
      await open();
      const titles = [...document.body.querySelectorAll('[data-release-note]')].map(
        (li) => li.textContent?.trim().split(/\s+/)[0],
      );
      expect(titles).toEqual([
        'releaseNotes.charts.title',
        'releaseNotes.notes.title',
        'releaseNotes.timer.title',
      ]);
      expect(document.body.textContent).toContain('whatsNew.title');
    });

    it('reports closing once', async () => {
      const { fixture, closed } = await open();
      document.body.querySelector<HTMLButtonElement>('[data-action=close-whats-new]')!.click();
      fixture.componentRef.setInput('open', false);
      fixture.componentRef.setInput('notes', []);
      fixture.detectChanges();
      await fixture.whenStable();

      expect(closed).toHaveBeenCalledOnce();
    });
  });

  describe('WhatsNewPage', () => {
    it('lists the released versions, newest first, and marks the running one', () => {
      const fixture = TestBed.createComponent(WhatsNewPage);
      fixture.detectChanges();
      const sections = [
        ...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('[data-version]'),
      ];
      const versions = sections.map((section) => section.dataset['version']);

      expect(versions).toEqual(releasedNotes().map((entry) => entry.version));
      expect(versions.at(-1)).toBe('0.1.0');
      const marked = sections.filter((section) =>
        section.querySelector('[hlmBadge]')?.textContent?.includes('whatsNew.page.current'),
      );
      expect(marked.map((section) => section.dataset['version'])).toEqual(
        versions.includes(APP_VERSION) ? [APP_VERSION] : [],
      );
    });
  });
});
