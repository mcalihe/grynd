# 0016 – Übungen hinzufügen: fixierte Suche, Filter-Tabs mit Chips

**Datum:** 2026-10-03 · **Status:** entschieden

## Kontext
Der Picker zeigte drei beschriftete Chip-Zeilen (Muskelgruppe, Bewegung, Equipment). Zusammen mit der Suche belegten sie fast die Hälfte des Bildschirms und scrollten mit der Liste weg: Wer weiter unten war, musste ganz nach oben, um die Suche zu ändern. «Filter zurücksetzen» stand als eigener Block zwischen Filtern und Liste.

## Entscheid
- **Fixierter Kopf, nur die Liste scrollt.** Titel, Suchfeld, Filterzeile und Ergebniszeile bleiben stehen; sobald die Liste gescrollt ist, trennt sie eine Linie. Die Seite ist ein Vollbild-Layout wie das Training (`fixed inset-0`, eigener Scroll-Container), damit der Kopf auch unter Notch/Statusleiste korrekt sitzt.
- **Filter-Tabs mit Chips:** Unter der Suche ein Segmented Control «Muskeln · Equipment · Bewegung», darunter nur die Chips der gewählten Gruppe (horizontal scrollbar). Ein Tap auf einen Chip filtert sofort, ein Tap auf einen Tab wechselt die Gruppe; nichts öffnet oder schliesst sich, und die Gruppen sind klar getrennt. Tabs mit aktiver Auswahl zeigen die Anzahl («Muskeln · 2»), damit Filter anderer Gruppen sichtbar bleiben. Logik unverändert: innerhalb einer Gruppe ODER, zwischen Gruppen UND.
- **Ergebniszeile:** «24 Übungen» links, «✕ Zurücksetzen» (Ghost) rechts, nur wenn ein Chip aktiv ist; es leert alle Chips, die Suche bleibt. Im Leerzustand setzt «Filter zurücksetzen» in der Mitte Suche und Chips zurück.
- **Suchfeld** mit eigenem Löschen-X; neue Suche oder Filter springen an den Anfang der Liste.
- Verworfen (teils erst umgesetzt und im Test durchgefallen): Dropdown-Chips mit Bottom-Sheet (oben tippen, unten auswählen), alle Chips aller Gruppen in einer Zeile (Gruppen vermischt, keine klare Trennung), Dropdown-Menü unter dem Chip (zwei Taps pro Filter, verdeckt die Liste) und ein einzelner «Filter»-Button für alle Gruppen (Auswahl schlecht sichtbar). Preis der gewählten Lösung: eine Zeile mehr Höhe im fixierten Kopf.

## Umsetzungshinweise
- Alles in `ExercisePickerPage` mit dem bestehenden `SegmentedControl` (Figma 84:2788); die Chip-Gruppen kommen aus `MUSCLE_GROUPS`, `EQUIPMENT` und `FORCES` in `core/exercises/exercise-search.ts`.
- **Figma:** Die Screens 63:12824, 63:13440 und 63:14032 zeigen noch die alten Chip-Zeilen und sind nachzuziehen.
