# 0016 – Übungen hinzufügen: fixierte Suche, eine Zeile Filter-Chips

**Datum:** 2026-10-03 · **Status:** entschieden

## Kontext
Der Picker zeigte drei beschriftete Chip-Zeilen (Muskelgruppe, Bewegung, Equipment). Zusammen mit der Suche belegten sie fast die Hälfte des Bildschirms und scrollten mit der Liste weg: Wer weiter unten war, musste ganz nach oben, um die Suche zu ändern. «Filter zurücksetzen» stand als eigener Block zwischen Filtern und Liste.

## Entscheid
- **Fixierter Kopf, nur die Liste scrollt.** Titel, Suchfeld, Filterzeile und Ergebniszeile bleiben stehen; sobald die Liste gescrollt ist, trennt sie eine Linie. Die Seite ist ein Vollbild-Layout wie das Training (`fixed inset-0`, eigener Scroll-Container), damit der Kopf auch unter Notch/Statusleiste korrekt sitzt.
- **Eine Zeile Filter-Chips, ein Tap pro Filter** (wie YouTube, Spotify, Google Fotos): Muskelgruppen | Equipment | Push, Pull, durch feine Striche getrennt, horizontal scrollbar (der angeschnittene Chip am Rand zeigt, dass es weitergeht). Ein Tap filtert sofort, nichts öffnet oder schliesst sich. Logik unverändert: innerhalb einer Gruppe ODER, zwischen Gruppen UND.
- **Zurücksetzen als ✕-Chip am Anfang der Zeile** (wie Spotify), nur sichtbar, wenn ein Chip aktiv ist; er leert die Chips, die Suche bleibt. Darunter steht die Trefferzahl («24 Übungen»). Im Leerzustand setzt «Filter zurücksetzen» in der Mitte Suche und Chips zurück.
- **Suchfeld** mit eigenem Löschen-X; neue Suche oder Filter springen an den Anfang der Liste.
- Verworfen: Dropdown-Chips mit Bottom-Sheet (erst umgesetzt: oben tippen, unten auswählen fühlt sich falsch an und braucht zwei Taps), Dropdown-Popover oder Inline-Panel unter den Chips (ebenfalls zwei Taps) und ein einzelner «Filter»-Button für alle Gruppen (Auswahl schlecht sichtbar). Nachteil der gewählten Lösung: Equipment und Push/Pull sind erst nach Wischen sichtbar.

## Umsetzungshinweise
- Alles in `ExercisePickerPage`; die Chip-Gruppen kommen aus `MUSCLE_GROUPS`, `EQUIPMENT` und `FORCES` in `core/exercises/exercise-search.ts`.
- **Figma:** Die Screens 63:12824, 63:13440 und 63:14032 zeigen noch die alten Chip-Zeilen und sind nachzuziehen.
