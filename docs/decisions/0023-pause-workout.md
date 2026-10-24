# 0023 – Training pausieren

**Datum:** 2026-10-15 · **Status:** entschieden (ergänzt [0011](0011-workout-flow.md) und [0006](0006-navigation-without-training-tab.md))

## Kontext
Ein laufendes Training war ein Vollbild ohne Navigation, das man nur über «Training abschliessen» oder den Beenden-Dialog verlassen konnte. Die Trainingsuhr zählte immer ab `startedAt`. Gewünscht ist eine Pause, etwa für einen Anruf, eine Unterbrechung oder einen kurzen Blick in den Verlauf, ohne dass diese Zeit zum Training zählt. Weiterhin gibt es nur ein laufendes Training.

## Entscheid
- **Pausieren im Training, verlassen aus der Pause** (mit dem Nutzer entschieden). Verworfen wurden zwei Alternativen: «Pause führt direkt zu den Plänen» (Pause würde zugleich navigieren) und «jederzeit verlassen, Pause separat» (zwei Konzepte, mehr Knöpfe).
- **Pause-Button** im Trainingskopf: rund, 44 px, `secondary`, links neben der Trainingsuhr. Pausiert zeigt er Play («Training fortsetzen»). Die Uhr bleibt der Weg zum Beenden-Dialog, auch während der Pause.
- **Pausiert:** Trainingsuhr und Timer stehen still; der Timer wird gestoppt, samt Benachrichtigung. Das Intervall der aktuellen Übung wird geschlossen. Satzseiten und Timer sind abgedunkelt und nicht bedienbar (`inert`), die Übersicht-Pill ist deaktiviert. Ein Overlay zeigt «Training pausiert», die eingefrorene Zeit, einen Hinweis und «Zu den Plänen» (Secondary). Der eine Primary-Button unten wird zu «Weiter trainieren».
- **Verlassen:** «Zu den Plänen» oder Android-Zurück führt zu `/plans`. Das Training bleibt pausiert. Auf den Tab-Screens zeigt eine Leiste über der Navigation den Plannamen und «Pausiert · 23:14». Ein Tap öffnet das Training, weiterhin pausiert: Fortsetzen ist immer ein eigener Schritt. Läuft das Training, öffnet Android-Zurück wie bisher den Beenden-Dialog.
- **App-Start:** Ein laufendes Training öffnet die App wie bisher wieder. Ein pausiertes bleibt im Hintergrund, die App startet normal mit der Leiste.
- **Weiterhin höchstens ein aktives Training.** «Training starten» in einem anderen Plan fragt wie bisher «Laufendes Training fortsetzen?» und führt zum Training, auch zu einem pausierten.
- **Dauer ohne Pausen:** Trainingsuhr, Verlauf, Wochenübersicht, Statistik, Planverlauf, Plan-Detail und Feier-Screen rechnen mit `sessionDurationMs()` = Ende − Start − Pausen. Die Zeit pro Übung schliesst Pausen schon aus, weil die Intervalle beim Pausieren enden. Wer pausiert abschliesst oder verwirft, beendet die Pause mit `finishedAt`.
- **Tabelle `workout_pause`** (`sessionId`, `pausedAt`, `resumedAt`, Migration 5): Pausen als Zeitstempel, nicht als Zähler. Ein partieller Unique-Index erlaubt eine offene Pause pro Session. Im Backup ab Schema 5; ältere Backups werden ohne Pausen importiert.
- **Bildschirm:** Keep-Awake gilt nur, solange das Training läuft; pausiert darf das Gerät den Bildschirm ausschalten.
- **Wortwahl:** Auf Deutsch heisst die Satzpause schon «Pause» («Pausendauer»). Darum steht immer «Training pausieren» bzw. «Training pausiert», und der Satztimer heisst «Timer».

## Umsetzungshinweise
- `pausedMs()` und `activeDurationMs()` in `core/workout/pauses.ts`. `WorkoutService` hat `paused`, `pause()`, `resume()` und `elapsedMs(now)`. `setCurrent()` öffnet während der Pause kein Intervall; `resume()` öffnet eines für die aktuelle Übung.
- `HistorySummary.pausedMs` rechnet SQL aus den Zeitstempeln (`julianday`). Eine offene Pause zählt bis `finishedAt`.
- `PausedWorkoutBar` (`app-paused-workout-bar`) sitzt in der App-Shell im Sticky-Bereich über der `BottomNavigation`, nur auf den Tab-Screens (wie «Neuigkeiten»). `formatElapsed()` liegt in einer eigenen Datei, damit die Trainingsuhr nicht ins Start-Bundle kommt.
- Figma hat keinen Frame dafür (nur Code). Vorschau der Leiste: `/dev/components`.
