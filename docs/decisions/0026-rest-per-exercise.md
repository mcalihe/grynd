# 0025 – Pausendauer pro Übung im Training

**Datum:** 2026-10-27 · **Status:** entschieden (ergänzt [0011](0011-workout-flow.md) und [0022](0022-weight-step.md))

## Kontext
Die Pausendauer wird pro Plan-Übung im Editor gesetzt und beim Start in die Session kopiert. Im Training liess sie sich nur über das Popover der Timer-Leiste ändern, und dort nur für die aktuelle Übung, solange der Timer nicht läuft. Gewünscht ist die Pause als Einstellung pro Übung im Training, wie der Gewichtsschritt.

## Entscheid
- **Übungsmenü (drei Punkte):** «Pausendauer: 1:30» unter «Gewichtsschritt». So lässt sich die Pause jeder Übung ändern, auch einer späteren und auch bei laufendem Timer.
- **Nur für dieses Training:** Die Pause ist Plandaten, und ein Training ist eine Kopie des Plans. Die Änderung schreibt `session_exercise.restSeconds` (wie das Timer-Popover), der Plan bleibt unverändert. Anders als der Gewichtsschritt ([0022](0022-weight-step.md)), der eine Eingabehilfe pro Übung ist.
- **Auswahl als Bottom Sheet** (`RestDurationSheet`): Übungsname als Titel, Hinweis, die Dauern des Timer-Popovers (0:30, 1:00, 1:30, 2:00, 3:00) als Chips mit Radio-Semantik, darunter ein Stepper in 15-s-Schritten von 0 bis 600 s wie im Editor. Ein Chip speichert und schliesst, der Stepper speichert jede Änderung und lässt das Sheet offen.
- **Nicht bei Cardio-Übungen:** Nach einem Cardio-Eintrag startet kein Timer ([0025](0025-cardio-and-calories.md)), darum fehlt dort auch der Menüeintrag, wie der Gewichtsschritt.
- **Ein laufender Timer bleibt, wie er ist:** Die neue Dauer gilt ab dem nächsten Start; für die laufende Pause gibt es −15 / +15.
- **Wortwahl:** «Pausendauer» wie im Timer ([0023](0023-pause-workout.md)), damit es nicht mit «Training pausieren» verwechselt wird.

## Umsetzungshinweise
- `ExercisePage` zeigt den Menüeintrag und meldet `editRest`; `WorkoutPage` hält das Sheet und merkt sich die Session-Übung per `entry.id`, damit ein Verschieben die richtige trifft. Gespeichert wird mit `WorkoutService.setRestSeconds()`.
- `REST_DURATIONS_SEC` und `formatClock()` kommen aus der Timer-Leiste.
- Figma hat keinen Frame dafür (nur Code). Vorschau: `/dev/components`.
