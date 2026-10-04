# 0013 – Einstellungen, Einheiten, Wischen auf Zahlenfeldern, Backup

**Datum:** 2026-10-01 · **Status:** entschieden

## Kontext
M7 macht die Einstellungen aus Figma (`84:2796`) wirksam. Offen waren: wo die Einstellungen gespeichert werden, wie lb angezeigt und eingegeben wird, was ein Import mit vorhandenen Daten macht und wie das Backup-Format aussieht. Zusätzlich gewünscht: Werte durch Wischen über das Zahlenfeld ändern.

## Entscheid
- **Speicherung** mit `@capacitor/preferences` als ein JSON-Wert `grynd.settings` (Theme, Einheit, Sprache, Timer-Autostart). Geladen wird per App-Initializer vor dem ersten Render. Der alte localStorage-Key `grynd.theme` wird einmalig übernommen. Unbekannte Werte fallen auf den Standard zurück.
- **Sprache:** Deutsch/English, Namen in ihrer eigenen Sprache. Bis zur ersten Wahl gilt die Gerätesprache.
- **lb nur zur Anzeige:** gespeichert wird immer kg. lb werden auf 0,1 gerundet angezeigt (60 kg → 132,3 lb), der Schritt beträgt in beiden Einheiten 2,5. Eingaben in lb werden mit 6 Nachkommastellen in kg umgerechnet, damit 135 lb wieder als 135 erscheint. Das gilt für Set-Rows, Verlauf und Volumen.
- **Wischen auf Zahlenfeldern** (jeder NumberStepper, ersetzt durch [0018](0018-value-scrubber.md)): waagrecht über den Wert ziehen, rechts erhöht, links verringert. Die Schrittweite in Pixeln sinkt mit der Geschwindigkeit (24 px langsam bis 4 px schnell). Erst nach 8 px gilt die Geste als Wischen, ein Tap öffnet weiterhin die Eingabe. Senkrechte Bewegungen bleiben Scrollen. Das Feld hat `touch-action: pan-y`, damit der Trainings-Pager dort nicht mitwischt, und der Long-Press der Satzzeile bricht ab, sobald sich der Finger bewegt.
- **Timer-Autostart** (Standard an): ist er aus, startet das Abhaken eines Satzes keinen Timer.
- **Backup-Format:** `{ app: 'grynd', schemaVersion, exportedAt, data: { plan, plan_exercise, workout_session, session_exercise, exercise_interval, set_log } }` mit allen Zeilen, auch soft-gelöschten. Der Übungskatalog ist gebündelt und wird nicht exportiert.
- **Import ersetzt alles:** Die Datei wird zuerst geprüft (App, Schema-Version ≤ aktuell, Tabellen, Pflichtwerte und Typen, Referenzen inklusive Übungen im Katalog). Danach folgt ein Bestätigungsdialog. Ersetzt wird in einer Transaktion; schlägt sie fehl, bleibt alles wie vorher.
- **Export:** im Browser als Download `grynd-backup-YYYY-MM-DD.json`, in der App über `@capacitor/filesystem` (Cache) und `@capacitor/share`. **Import** über `<input type="file">`.
- **Rückmeldung** per Toast (helm Sonner, oben mittig, folgt dem Theme).
- **Version** `0.1.0` aus `APP_VERSION`; ein Test hält sie gleich mit `package.json`.

## Umsetzungshinweise
- Der Placeholder-Screen ist entfernt, alle Routen haben jetzt echte Screens.
- Ein Import während eines laufenden Trainings ist nicht möglich: `/workout` hat keine Navigation. Nach dem Import lädt `WorkoutService.restore()` eine eventuell enthaltene aktive Session.
- Haptik pro Wisch-Schritt folgt in M8.
