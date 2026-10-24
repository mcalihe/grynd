# 0022 – Gewichtsschritt pro Übung

**Datum:** 2026-10-12 · **Status:** entschieden (ersetzt den festen Schritt aus [0013](0013-settings-units-swipe-backup.md); ergänzt das Backup-Format)

## Kontext
Der ±-Schritt und die Skala des Wert-Scrubbers ([0018](0018-value-scrubber.md)) waren für das Gewicht fest 2,5 (kg bzw. lb). Das passt nicht zu jedem Gerät: Kurzhanteln gibt es oft in 2-kg-Stufen, Maschinen in 5 kg, mit Mikroscheiben geht es in 0,5 kg. Gewünscht ist ein Schritt pro Übung, der sich auch im Training ändern lässt.

## Entscheid
- **Ein Schritt pro Übung, gültig in allen Plänen** (mit dem Nutzer entschieden), wie die Notiz ([0019](0019-exercise-notes.md)). Der Schritt hängt am Gerät, also an der Übung, nicht am Plan.
- **Eingabehilfe, keine Plan- oder Logdaten:** Er ändert nur ± und die Scrubber-Skala, nie gespeicherte Gewichte. Darum gilt «Training = Kopie des Plans» nicht für ihn: Sessions kopieren ihn nicht, eine Änderung im Training gilt sofort und auch in späteren Trainings.
- **kg und lb getrennt** (`weightStepKg`, `weightStepLb`): Umgerechnete Schritte wären krumm (2,5 kg ≈ 5,51 lb). Gewählt wird in der angezeigten Einheit, die andere bleibt unberührt. Ohne Wahl gilt 2,5.
- **Feste Liste** (mit dem Nutzer entschieden), passend zu den angezeigten Nachkommastellen: kg 0,25 · 0,5 · 1 · 1,25 · 2 · 2,5 · 5 · 10; lb 0,5 · 1 · 2,5 · 5 · 10. Kein freier Wert, das wäre mehr UI für einen seltenen Fall.
- **± rastet nicht ein:** 82,5 kg mit Schritt 2 wird zu 84,5 kg. Beim Scrubben rastet der Wert wie bisher auf Vielfache des Schritts.
- **Tabelle `exercise_setting`** (`exerciseId`, `weightStepKg`, `weightStepLb`, plus `id`/`createdAt`/`updatedAt`/`deletedAt`, Migration 4), bewusst allgemein benannt für spätere Einstellungen pro Übung. Ein partieller Unique-Index erlaubt eine lebende Zeile pro Übung. Der Standard wird als `null` gespeichert; bleibt keine Einstellung übrig, wird die Zeile per Soft Delete entfernt.
- **Training:** «Gewichtsschritt: 2,5 kg» im Übungsmenü (drei Punkte), unter dem Notiz-Eintrag. **Plan-Detail:** Im aufgeklappten Eintrag unter der Pause «Gewichtsschritt 2,5 kg» als Button. Der Editor zeigt nichts, weil er den Entwurf erst beim Speichern schreibt.
- **Auswahl als Bottom Sheet** (`WeightStepSheet`): Übungsname als Titel, Hinweis, die Schritte als Chips (gewählt in `primary`, wie die Wochentage), Radio-Semantik. Ein Tap speichert und schliesst.
- **Backup:** `exercise_setting` gehört ab Schema 4 dazu. Ältere Backups haben die Tabelle nicht und werden ohne Einstellungen importiert (`since` in `BACKUP_TABLES`).

## Umsetzungshinweise
- `WEIGHT_STEPS` und `weightStepLabel()` in `core/units/weight.ts`; `WEIGHT_STEP` (2,5) bleibt der Standard.
- `ExerciseSettingsService` (core/exercises) hält die Einstellungen als Signal-Map, lädt einmal und schreibt sofort. Nach einem Import lädt `BackupService.restore()` sie neu.
- `SetRow` hat das Input `weightStep`; `ExercisePage` gibt den Schritt der Übung hinein. `WorkoutPage` und Plan-Detail halten je ein Sheet.
- Figma hat keinen Frame dafür (nur Code). Vorschau: `/dev/components`.
