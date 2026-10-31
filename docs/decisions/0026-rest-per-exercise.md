# 0026 – Pausendauer pro Übung im Training

**Datum:** 2026-10-27, geändert 2026-10-31 · **Status:** entschieden (ergänzt [0011](0011-workout-flow.md) und [0022](0022-weight-step.md); Ausnahme von «Training = Kopie des Plans»)

## Kontext
Die Pausendauer wird pro Plan-Übung im Editor gesetzt und beim Start in die Session kopiert. Im Training liess sie sich nur über das Popover der Timer-Leiste ändern, und dort nur für die aktuelle Übung, solange der Timer nicht läuft. Gewünscht ist die Pause als Einstellung pro Übung im Training, wie der Gewichtsschritt.

## Entscheid
- **Übungsmenü (drei Punkte):** «Pausendauer: 1:30» unter «Gewichtsschritt». So lässt sich die Pause jeder Übung ändern, auch einer späteren und auch bei laufendem Timer.
- **Gilt auch für den Plan** (mit dem Nutzer entschieden, zuerst war es nur für dieses Training): Eine geänderte Pause schreibt `session_exercise.restSeconds` und die Plan-Übung, aus der die Session-Übung kopiert wurde. Wer die Pause im Training anpasst, will sie auch beim nächsten Mal. Das ist die einzige Ausnahme von «Änderungen im Training ändern den Plan nie»; Sätze, Ziele und Reihenfolge bleiben Kopie. Das gilt auch für das Timer-Popover, damit es keine zwei Bedeutungen von «Pause ändern» gibt.
- **Zuordnung ohne Migration:** Session-Übungen speichern keinen Verweis auf die Plan-Zeile. Sie werden aber in Planreihenfolge kopiert, und ihre UUIDv7-IDs wachsen mit der Erstellung. Die n-te Session-Übung einer Übung (nach ID) gehört darum zur n-ten Plan-Zeile dieser Übung (nach Position), auch wenn im Training umsortiert wurde. Wurde der Plan seither geändert und fehlt die n-te Zeile, passt noch eine einzelne Zeile derselben Übung; sonst und ohne Plan ändert sich nur die Session.
- **Auswahl als Bottom Sheet** (`RestDurationSheet`): Übungsname als Titel, Hinweis, die Dauern des Timer-Popovers (0:30, 1:00, 1:30, 2:00, 3:00) als Chips mit Radio-Semantik, darunter ein Stepper in 15-s-Schritten von 0 bis 600 s wie im Editor. Ein Chip speichert und schliesst, der Stepper speichert jede Änderung und lässt das Sheet offen.
- **Nicht bei Cardio-Übungen:** Nach einem Cardio-Eintrag startet kein Timer ([0025](0025-cardio-and-calories.md)), darum fehlt dort auch der Menüeintrag, wie der Gewichtsschritt.
- **Ein laufender Timer bleibt, wie er ist:** Die neue Dauer gilt ab dem nächsten Start; für die laufende Pause gibt es −15 / +15.
- **Wortwahl:** «Pausendauer» wie im Timer ([0023](0023-pause-workout.md)), damit es nicht mit «Training pausieren» verwechselt wird.

## Umsetzungshinweise
- `ExercisePage` zeigt den Menüeintrag und meldet `editRest`; `WorkoutPage` hält das Sheet und merkt sich die Session-Übung per `entry.id`, damit ein Verschieben die richtige trifft. Gespeichert wird mit `WorkoutService.setRestSeconds()` in einer Transaktion mit `PlansService.setRestSeconds()`; die Zuordnung macht `planExerciseFor()` (`core/workout/plan-link.ts`).
- `REST_DURATIONS_SEC` und `formatClock()` kommen aus der Timer-Leiste.
- Figma hat keinen Frame dafür (nur Code). Vorschau: `/dev/components`.
