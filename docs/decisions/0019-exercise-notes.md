# 0019 – Notizen pro Übung

**Datum:** 2026-10-08 · **Status:** entschieden (ergänzt das Backup-Format aus [0013](0013-settings-units-swipe-backup.md))

## Kontext
Gewünscht ist ein freies Textfeld pro Übung: Einstellungen am Gerät («Sitz auf Stufe 4»), besondere Ausführung («halbe Wiederholungen», «2 s Pause unten») oder Technik-Tipps. Offen war, ob die Notiz zur Übung gehört oder zum Eintrag im Plan, und wo man sie bearbeitet.

## Entscheid
- **Eine Notiz pro Übung, gültig in allen Plänen** (mit dem Nutzer entschieden). Geräteeinstellungen und Technik hängen an der Übung, nicht am Plan. Wer in zwei Plänen Beinpresse trainiert, will dieselbe Sitzposition sehen.
- **Kein Plan-Inhalt:** Die Notiz ist Benutzerwissen über eine Katalog-Übung, wie eine Einstellung. Darum gilt die Regel «Training = Kopie des Plans» nicht für sie: Sessions kopieren sie nicht, und man darf sie mitten im Training ändern. Der Verlauf zeigt keine Notizen, denn eine Notiz ist ein aktueller Stand und kein Protokoll.
- **Tabelle `exercise_note`** (`exerciseId`, `text`, plus `id`/`createdAt`/`updatedAt`/`deletedAt`, Migration 2). Ein partieller Unique-Index erlaubt höchstens eine lebende Notiz pro Übung. Eine geleerte Notiz wird per Soft Delete entfernt, eine neue bekommt eine neue Zeile.
- **Text:** getrimmt, höchstens 500 Zeichen (Erinnerung, kein Trainingstagebuch), Zeilenumbrüche bleiben. Notizen bleiben privat auf dem Gerät. Sollten Pläne später geteilt werden, gehen Notizen nicht mit; das Prinzip «kein geteilter Freitext» (plan.md §1) bleibt erhalten.
- **Training:** Die Notiz steht als Karte (`bg-muted`, höchstens 3 Zeilen) unter der Zielzeile, über den Sätzen, also im Blick beim Loggen. «Notiz hinzufügen» bzw. «Notiz bearbeiten» steht als erster Eintrag im Übungsmenü (drei Punkte), getrennt von den Verschiebe-Einträgen. Auch ein Tap auf die Karte öffnet den Editor. Ohne Notiz zeigt die Seite nichts zusätzlich.
- **Plan-Detail:** Ein Notiz-Symbol neben «3 × 8–12» markiert Übungen mit Notiz, auch im Editor. Der aufgeklappte Eintrag im Detail zeigt die Notiz oder «Notiz hinzufügen». Im Editor bleibt es beim Symbol, weil er den Entwurf erst beim Speichern schreibt und Notizen sofort gespeichert werden.
- **Editor als Bottom Sheet** (`ExerciseNoteSheet`): Übungsname als Titel, Hinweis «Gilt für diese Übung in allen Plänen.», Textfeld (wächst mit dem Inhalt) und «Fertig». **Kein Verwerfen:** Wie das Sheet auch schliesst («Fertig», X, Tap daneben), eine geänderte Notiz wird gespeichert. Nur Leerraum zu ändern zählt nicht als Änderung.
- **Backup:** `exercise_note` ist Teil des Backups (Schema 2). Backups mit Schema 1 haben die Tabelle nicht und werden ohne Notizen importiert (`since` in `BACKUP_TABLES`). Ein Import ersetzt wie bisher alles, also auch die Notizen.

## Umsetzungshinweise
- `ExerciseNotesService` (core/exercises) hält die Notizen als Signal-Map, lädt einmal und schreibt beim Speichern sofort. Nach einem Import lädt `BackupService.restore()` sie neu.
- `ExerciseNote` und `ExerciseNoteSheet` (shared/components/exercise-note) sind rein darstellend. Das Training (`WorkoutPage`) und das Plan-Detail halten je ein Sheet.
- Neues helm-Element `hlmTextarea`, im Stil an `hlmInput` angeglichen (`bg-surface-elevated`, Radius 16).
- Figma hat keinen Frame dafür (nur Code). Vorschau: `/dev/components`.
