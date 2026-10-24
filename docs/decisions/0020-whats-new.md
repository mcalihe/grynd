# 0020 – Neuigkeiten nach einem Update

**Datum:** 2026-10-12 · **Status:** entschieden (ergänzt die Releases aus [0016](0016-release-please.md))

## Kontext
Nach einem Update merkt niemand, was neu ist. Gewünscht: einmal ein kleines Popup mit der neuen Version und ihren Neuerungen, verständlich für alle und in Deutsch und Englisch, dazu ein Changelog in den Einstellungen. Der `CHANGELOG.md` von release-please taugt dafür nicht: Er besteht aus englischen Commit-Titeln mit PR-Links und ist für Entwickler geschrieben.

## Entscheid
- **Release Notes von Hand statt aus Commits.** `RELEASE_NOTES` (`core/whats-new/release-notes.ts`) listet pro Version die Neuerungen als `{ id, icon }`, neueste zuerst. Titel und Text stehen in Transloco unter `releaseNotes.<id>.title` / `.text` (de und en). Nur was Nutzer merken und was ihnen etwas bringt; keine Fachbegriffe, keine Refactorings, kein Kleinkram (z.B. rollende Timer-Ziffern). Ein Icon pro Eintrag (Lucide, in `APP_ICONS`).
- **Geschrieben im Feature-PR.** Wer einen `feat` oder `fix` macht, den Nutzer merken, ergänzt den Eintrag der nächsten Version: `feat` → nächste Minor, nur `fix` → nächste Patch, genau wie release-please zählt. Gibt es den Eintrag schon, kommt der Text dazu; kommt nach einem `fix` ein `feat`, wird aus `0.7.1` eben `0.8.0`. So entstehen die Texte, solange das Feature frisch ist, und der Release braucht meist keinen Extra-Schritt.
- **CI erzwingt es beim Release.** Ein Test verlangt einen Eintrag für `APP_VERSION`. Im Release-PR erhöht release-please die Version; fehlt der Eintrag oder wurde die Version falsch geraten, wird der Release-PR rot. Dann folgt ein kleiner `chore`-PR («release notes for X.Y.Z») auf `main`, und der Release-PR aktualisiert sich. Ein Release ohne Erwähnenswertes bekommt `items: []`: kein Popup, keine Zeile im Changelog. Weitere Checks: gültige, eindeutige, absteigende Versionen; höchstens ein Eintrag neuer als `APP_VERSION`; jede `id` mit Titel und Text in beiden Sprachen; nur registrierte Icons.
- **Zur Laufzeit zählen nur Versionen ≤ `APP_VERSION`.** Staging und PR-Previews zeigen den vorbereiteten Eintrag der nächsten Version also nicht.
- **Einmal pro Update.** Gespeichert wird die zuletzt gesehene Version (`grynd.lastSeenVersion`, Capacitor Preferences wie die Einstellungen). Beim Start zeigt das Popup alle Versionen nach dieser bis `APP_VERSION`, also auch übersprungene Updates. Schliessen (Button, Escape, Android-Zurück) speichert `APP_VERSION`. Ein älterer Build (Previews teilen sich den Speicher) ändert nichts.
- **Neuinstallation ohne Popup.** Fehlt der Wert und es gibt keine Pläne und keine Trainings, wird still `APP_VERSION` gespeichert: Wer die App neu hat, braucht keine Neuigkeiten. Fehlt der Wert, aber es gibt Daten, hat jemand vor dieser Funktion installiert; er sieht die Neuigkeiten der laufenden Version.
- **Nur auf den Tab-Screens** (Pläne, Verlauf, Einstellungen), nie im Training oder in einem Editor. Wird beim Start ein Training fortgesetzt, wartet das Popup, bis man wieder auf einem Tab ist.
- **UI:** Popup im Stil des bestehenden Dialogs (helm `hlm-alert-dialog`, Figma «Dialog» 9:303), deshalb keine neue helm-Komponente. Kopf mit Sparkles-Symbol in `primary`, Titel «Neu in Grynd {{version}}», darunter die Einträge (Icon, Titel, Text), die gestaffelt erscheinen (`enter()`, respektiert reduzierte Bewegung), und ein Button «Los geht’s». Viele Einträge scrollen im Dialog.
- **Einstellungen:** Abschnitt «App» mit der Zeile «Neuigkeiten» → `/settings/whats-new`: jede veröffentlichte Version mit ihren Einträgen, die laufende mit Badge «Aktuell».
- **Rückwirkend** gibt es Texte für 0.1.0 bis 0.6.0, damit der Changelog von Anfang an vollständig ist.

## Umsetzungshinweise
- `WhatsNewService` (core/whats-new) entscheidet beim App-Start (`App`-Konstruktor), `pending` hält die anzuzeigenden Versionen. `App.showWhatsNew` öffnet das Popup nur bei sichtbarer Bottom-Navigation; `BackButtonService` schliesst es auf denselben Screens.
- `RELEASE_INFO` (Version und Notes) ist ein Token, damit Tests feste Werte nutzen. «Daten vorhanden» prüft `count()` aus `BaseRepository`.
- `ReleaseNotesList` und `WhatsNewDialog` (shared/components/whats-new) sind rein darstellend. Figma hat keinen Frame dafür (nur Code). Vorschau: `/dev/components`.
- `scripts/readme-screenshots.mjs` setzt die gesehene Version, damit das Popup nie auf einem Screenshot landet. Die E2E-Tests starten mit leerer Datenbank, also ohne Popup.
