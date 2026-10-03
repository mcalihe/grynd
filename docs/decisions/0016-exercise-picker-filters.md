# 0016 – Übungen hinzufügen: fixierte Suche, Filter als Dropdown-Chips

**Datum:** 2026-10-03 · **Status:** entschieden

## Kontext
Der Picker zeigte drei beschriftete Chip-Zeilen (Muskelgruppe, Bewegung, Equipment). Zusammen mit der Suche belegten sie fast die Hälfte des Bildschirms und scrollten mit der Liste weg: Wer weiter unten war, musste ganz nach oben, um die Suche zu ändern. «Filter zurücksetzen» stand als eigener Block zwischen Filtern und Liste.

## Entscheid
- **Fixierter Kopf, nur die Liste scrollt.** Titel, Suchfeld, Filterzeile und Ergebniszeile bleiben stehen; sobald die Liste gescrollt ist, trennt sie eine Linie. Die Seite ist ein Vollbild-Layout wie das Training (`fixed inset-0`, eigener Scroll-Container), damit der Kopf auch unter Notch/Statusleiste korrekt sitzt.
- **Filter als Dropdown-Chips:** eine Zeile mit «Muskelgruppe ▾», «Bewegung ▾», «Equipment ▾». Tippen öffnet ein Bottom-Sheet mit den Optionen dieser Gruppe (Mehrfachauswahl, wirkt sofort, die Liste dahinter filtert live). Hat eine Gruppe eine Auswahl, wird der Chip `primary` und zeigt sie («Brust», «Brust +1»). Logik unverändert: innerhalb einer Gruppe ODER, zwischen Gruppen UND.
- **Ergebniszeile:** «24 Übungen» links, «Zurücksetzen» (Ghost) rechts, nur wenn Suche oder Filter aktiv sind. Im Leerzustand bleibt der Button «Filter zurücksetzen» in der Mitte (dann ohne zweiten Reset oben).
- **Suchfeld** mit eigenem Löschen-X; neue Suche oder Filter springen an den Anfang der Liste.
- Verworfen: alle Chips in einer horizontal scrollbaren Zeile (Equipment erst nach Wischen sichtbar) und ein einzelner «Filter»-Button mit Sheet für alle Gruppen (Auswahl weniger sichtbar).

## Umsetzungshinweise
- `shared/components/filter-chip` (`app-filter-chip`, im Showcase), `features/plans/exercise-filter-sheet.ts` (helm Sheet, unten), Chip-Text über `filterChipLabel()` in `core/exercises/exercise-search.ts`.
- **Figma:** Die Screens 63:12824, 63:13440 und 63:14032 zeigen noch die alten Chip-Zeilen und sind nachzuziehen.
