# 0010 – Plan-Detail, Editor und Routen

**Datum:** 2026-09-30 · **Status:** entschieden

## Kontext
In Figma sehen Plan-Detail (`37:27708`) und «Plan bearbeiten» (`37:28096`) fast gleich aus. Beide haben Chips, Drag-Handles und Chevrons. Im Detail fehlte ein Einstieg zum Bearbeiten, und nirgends gab es eine Möglichkeit, einen Plan zu löschen.

## Entscheid
- **Plan-Detail ist eine Ansicht.** Wochentage und Reihenfolge werden nur angezeigt, der Chevron klappt die Ziele auf. Oben rechts steht «Bearbeiten», der Primary-Button ist «Training starten».
- **Bearbeiten und Erstellen** nutzen denselben Screen mit «Speichern» bzw. «Plan speichern». Der Button ist deaktiviert, solange Name oder Übungen fehlen. Es gibt keinen Abbrechen-Button.
- **Löschen** geht über das Drei-Punkte-Menü im Bearbeiten-Screen und braucht eine Bestätigung. Es ist ein Soft Delete, vergangene Trainings bleiben erhalten.
- **Routen:** «Übungen hinzufügen» ist eine Kind-Route des Editors: `/plans/new/add-exercises` und `/plans/:id/edit/add-exercises`. Der Entwurf (`PlanEditorStore`, auf Routenebene bereitgestellt) übersteht so den Wechsel, und der Unsaved-Guard am Eltern-Pfad greift nur beim Verlassen des Editors.

## Umsetzungshinweise
- Angular verwendet den Injector von Routen mit `providers` über mehrere Besuche hinweg. Der Guard setzt den Store deshalb beim Verlassen zurück, sonst stünde beim nächsten Öffnen der alte Entwurf da.
- Der Picker initialisiert den Store selbst. So funktionieren auch ein Reload oder ein Deep-Link direkt in den Picker.
- Die Dirty-Erkennung vergleicht den Entwurf mit dem geladenen Snapshot. Wer eine Änderung zurücknimmt, hat nichts Ungespeichertes.
- Der Bestätigungsdialog (`ConfirmDialogHost`) wird per `@defer` nachgeladen. Sonst läge das CDK-Overlay im Initial-Bundle.
