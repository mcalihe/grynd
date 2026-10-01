# 0012 – Verlauf: Diagramm, Gruppierung, Rekorde, Löschen

**Datum:** 2026-10-01 · **Status:** entschieden

## Kontext
Figma zeigt den Verlauf mit Wochendiagramm und Liste (`37:29734`) sowie das Detail (`84:3364`). Offen waren: was die Balkenhöhe bedeutet (Figma zeigt auch graue Balken in unterschiedlicher Höhe), wie ältere Wochen heissen, wogegen Rekorde im Verlauf gemessen werden und ob sich ein Training löschen lässt.

## Entscheid
- **Balkenhöhe = Trainingsdauer des Tages**, relativ zum längsten Tag der Woche, in `chart-1`. Tage ohne Training sind gleich niedrige graue Balken (`muted`).
- **Wochen beginnen am Montag** (de und en). Das Diagramm zeigt die laufende Woche. Die Differenz zur Vorwoche steht rechts: positiv in `success`, negativ in `muted-foreground`, bei 0 gar nicht.
- **Gruppen:** «Diese Woche», «Vorwoche», danach der Datumsbereich der Woche. Die Tage heissen «Heute», «Gestern», in den letzten zwei Wochen Wochentag, danach Datum.
- **Zeile:** Tag, Dauer, Anzahl Übungen (mit mindestens einem abgehakten Satz). Das Volumen steht wie in Figma nur im Detail.
- **Rekord im Verlauf:** gemessen an allen früher begonnenen, abgeschlossenen Trainings und den früheren Sätzen desselben Trainings (dieselbe Regel wie im Training). Spätere Trainings ändern einen alten Rekord nicht.
- **Löschen:** Drei-Punkte-Menü im Detail → «Training löschen» mit Bestätigung → Soft Delete. Gelöschte Trainings zählen nicht mehr für Verlauf, Vorbefüllung und Rekorde.
- **Leerer Verlauf** (neu in Figma, `106:1654`): Diagramm mit «0 Trainings» und Empty State ohne Aktion. Gestartet wird ein Training immer über einen Plan.

## Umsetzungshinweise
- Der Planname kommt per Join auf `plan`, auch bei gelöschtem Plan. Wird ein Plan umbenannt, zeigt der Verlauf den neuen Namen.
- Die Baseline-Abfrage für Rekorde (`SetLogRepository.bestOneRepMaxBefore`) nutzen `WorkoutService` und `HistoryService` gemeinsam.
- Dauern werden auf Minuten gerundet; alles über 0 zeigt mindestens «1 Min.».
- Die Gewichtsanzeige ist vorerst kg. Mit der Einheiten-Einstellung in M7 läuft sie über `HistoryFormat.set()`.
