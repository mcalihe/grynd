# 0024 – Übungen hinzufügen: Muskel-Chips, Geräte-Dropdown, schlaue Suche

**Datum:** 2026-10-24 · **Status:** entschieden

## Kontext
Der Picker zeigte drei beschriftete Chip-Zeilen (Muskelgruppe, Bewegung, Equipment). Zusammen mit der Suche belegten sie fast die Hälfte des Bildschirms und scrollten mit der Liste weg; «Filter zurücksetzen» stand als eigener Block dazwischen. Drei Umbauten fielen im Test durch: Dropdown-Chips mit Bottom-Sheet (oben tippen, unten auswählen), alle Chips aller Gruppen in einer Zeile (keine klare Trennung) und Gruppen-Tabs über ein Segmented Control (ungewohnt). Danach Recherche, wie andere Apps und die UX-Forschung das lösen; Prototyp zum Ausprobieren: https://claude.ai/artifact/Dj7gngA4HfAoKmiYibNnmQ

## Recherche
- **Muskel zuerst, Gerät als Zweites.** FitNotes ordnet Übungen in Muskel-Kategorien, Fitbod hat einen Tab «By Muscle», MuscleWiki startet mit einer Körperkarte, Hevy hat unter der Suche «All Muscles» und «All Equipment». Ein Push/Pull-Filter taucht in keiner der Quellen auf.
- **Wichtigsten Filter direkt zeigen** (Baymard, Mobile-Filtering): spart den Weg in eine eigene Filter-Ansicht. Horizontale Filterleisten funktionieren nur mit wenigen Filtertypen; ein am Rand angeschnittener Chip zeigt, dass die Zeile scrollt.
- **Bessere Suche statt mehr Filter-UI** (Apple HIG, Searching).
- Quellen: [Hevy-Anleitung (HotelGyms)](https://www.hotelgyms.com/blog/how-to-use-the-hevy-app), [Fitbod Hilfe](https://help.fitbod.me/hc/en-us/sections/31812780318743-Exercise-Workout-Customization), [FitNotes Review (WhistleOut)](https://www.whistleout.com/CellPhones/Apps/fitnotes-app-review), [MuscleWiki (Google Play)](https://play.google.com/store/apps/details?id=com.musclewiki.macro&hl=en), [Baymard: Promoting Filters](https://baymard.com/blog/promoting-product-filters), [Baymard: Applied Filters](https://baymard.com/blog/how-to-design-applied-filters), [Apple HIG: Searching](https://developer.apple.com/design/human-interface-guidelines/searching). Die Seiten waren aus der Entwicklungsumgebung nur über Suchzusammenfassungen erreichbar.

## Entscheid
- **Fixierter Kopf, nur die Liste scrollt.** Titel, Suche, Muskel-Chips und Geräte-Zeile bleiben stehen; sobald die Liste gescrollt ist, trennt sie eine Linie. Vollbild-Layout wie das Training (`fixed inset-0`, eigener Scroll-Container), damit der Kopf auch unter Notch/Statusleiste korrekt sitzt. Neue Suche oder neuer Filter springt an den Anfang der Liste.
- **Muskeln:** eine Zeile nur mit Muskel-Chips, horizontal scrollbar. Ein Tap filtert, ein zweiter hebt den Filter auf.
- **Geräte:** ein Chip «Alle Geräte ▾» darunter, der ein Dropdown direkt unter sich öffnet (helm Dropdown-Menü mit Checkbox-Einträgen). Mehrfachauswahl, die Liste filtert schon während der Auswahl, das Menü bleibt dafür offen; «Alle Geräte» leert die Auswahl und schliesst es. Der Chip zeigt die Auswahl («Kurzhantel», «Kurzhantel +1») und ist dann `primary`.
- **Push/Pull nicht im Picker.** Die Daten (`force`) und die Filterlogik bleiben, nur die Oberfläche bietet es nicht mehr an.
- **Kein globaler Zurücksetzen-Button.** Jeder Filter wird dort aufgehoben, wo er gesetzt wurde (Chip nochmal tippen, «Alle Geräte»). Rechts in der Geräte-Zeile steht nur die Trefferzahl. Findet sich nichts, setzt «Filter zurücksetzen» im Leerzustand Suche und Filter zurück.
- **Schlaue Suche:** Jedes Suchwort muss im deutschen oder englischen Namen, in der Muskelgruppe oder im Gerät vorkommen. Dafür gibt es pro Muskelgruppe und Gerät ein kleines Vokabular (Deutsch, Englisch, Gym-Wörter wie «bizeps», «lat», «kh»), damit «Brust Kurzhantel» ohne Filter funktioniert. Platzhalter: «Übung, Muskel oder Gerät». Löschen-X im Suchfeld.
- Logik unverändert: innerhalb einer Gruppe ODER, zwischen Gruppen UND.

## Umsetzungshinweise
- `core/exercises/exercise-search.ts`: `MUSCLE_TERMS`, `EQUIPMENT_TERMS` (nur zum Abgleichen, nie angezeigt), `equipmentFilterOf()`; der normalisierte Suchtext wird pro Übung einmal berechnet (`WeakMap`).
- `ExercisePickerPage` (features/plans): Chips und Dropdown direkt im Template, keine eigene Komponente.
- **Figma:** Die Screens 63:12824, 63:13440 und 63:14032 zeigen noch die alten Chip-Zeilen und sind nachzuziehen.
