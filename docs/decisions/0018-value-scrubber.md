# 0018 – Wert-Scrubber: Lineal beim Ziehen über Zahlenfelder

**Datum:** 2026-10-04 · **Status:** entschieden (ersetzt den Abschnitt «Wischen auf Zahlenfeldern» in [0013](0013-settings-units-swipe-backup.md))

## Kontext
Seit 0013 ändert waagrechtes Wischen über den Wert eines NumberSteppers den Wert. Das Wischen war unsichtbar: Ausser der kleinen Zahl sah man nicht, was passiert. Die Schrittweite hing von der Geschwindigkeit ab (24 px langsam bis 4 px schnell), dadurch waren die Schritte nicht vorhersehbar. Das KG-Feld liegt links in der Satz-Zeile (x ≈ 47–168 bei 393 px), nach links blieb kaum Platz. Ausserdem war der Wert für Screenreader nur ein Button mit der Zahl, ohne Bezeichnung.

## Entscheid
- **Ziehen irgendwo auf dem Stepper** (Wert, − oder +). Nach 8 px waagrechter Bewegung erscheint ein **Lineal über den ganzen Bildschirm** (`ValueScrubber`). Ein Tap auf − oder + und ein Tap auf den Wert (Eingabefeld) funktionieren wie bisher. Der Klick nach dem Ziehen wird verschluckt.
- **Richtung wie der Stepper:** − links, + rechts, also erhöht Ziehen nach rechts. Das Lineal steht still, eine `primary`-Nadel mit Ring folgt dem Finger und rastet auf den Strichen ein (Haptik pro Schritt wie bisher). Ein Punkt markiert den Startwert.
- **Feste Schrittweite:** 16 px pro Schritt, unabhängig von der Geschwindigkeit. Ein Strich ist ein Schritt. Beschriftet ist jeder 4., 5. oder 10. Strich, je nachdem welcher auf eine runde Zahl fällt (2,5 kg → alle 10 kg, 1 Wdh. → alle 5, 15 s → jede Minute). Werte rasten auf Vielfache des Schritts ein. Ein Wert neben dem Raster (82,25) bleibt, bis sich der Finger einen halben Schritt bewegt hat.
- **Nie zu wenig Platz:** An jedem Rand liegt eine 56 px breite Zone mit ‹ bzw. ›. Bleibt der Finger dort, scrollt das Lineal weiter, mit 3 Schritten/s am inneren Rand der Zone bis 12 Schritte/s am Bildschirmrand. Zurück aus der Zone hält es an, an min/max stoppt es. Die Geschwindigkeit wird aus Zeitstempeln berechnet, nicht pro Frame gezählt. Kein Schwung nach dem Loslassen, denn der Wert beim Loslassen soll genau der angezeigte sein.
- **Anzeige:** grosse Zahl (60 px) mit Label und Änderung seit dem Start («+7,5») über dem Lineal. Das Lineal liegt über dem Finger, weil der Daumen darunter alles verdeckt. Fehlt oben der Platz, rutscht die Zahl unter den Finger, ganz oben auch das Lineal. Ziffern ohne Rollanimation, denn bei vielen Wechseln pro Sekunde verschmieren sie.
- **Loslassen** übernimmt den Wert: das Lineal blendet aus, die Zahl im Feld federt kurz. **Esc** (Maus) und `pointercancel` stellen den Startwert wieder her.
- **Barrierefreiheit:** Der Wert ist ein `role="spinbutton"` mit `aria-label`, `aria-valuenow/min/max` und `aria-valuetext` (lokal formatiert). Tasten: ↑/→ und ↓/← ±1 Schritt, Bild↑/↓ ±1 beschriftetes Intervall, Pos1/Ende min/max, Enter/Leertaste öffnen das Eingabefeld. − und + bleiben die Alternative zum Ziehen (WCAG 2.5.1). Das Lineal ist `aria-hidden`. Mit `prefers-reduced-motion` gibt es kein Ein- und Ausblenden und keine Nadel-Transition.
- **Nicht umgesetzt:** Gedrückthalten von −/+ zum Wiederholen. Das kollidiert mit dem Long-Press der Satz-Zeile (500 ms, Satzmenü).

## Umsetzungshinweise
- Reine Logik in `number-stepper.logic.ts` (`scrubValue`, `rulerTicks`, `edgeSpeed`, `edgeScroll`, `majorEvery`), getestet.
- Das Lineal wird über CDK Overlay auf Body-Ebene gerendert, damit Pager, `cdkDrag`-Zeilen und Sticky-Leisten es nicht abschneiden oder überdecken. Die Eingaben sind über `inputBinding` beim Erzeugen gebunden, damit schon der erste Frame stimmt.
- Während des Ziehens verhindert ein nicht-passiver `touchmove`-Listener das Scrollen der Seite. Der ganze Stepper hat `touch-action: pan-y`, also startet der Trainings-Pager auf − und + nicht mehr.
- Figma hat noch keinen Frame für das Lineal (nur Code). Vorschau: `/dev/components`.
