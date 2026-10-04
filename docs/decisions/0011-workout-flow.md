# 0011 – Trainingsablauf: Beenden, Abschliessen, Fortsetzen

**Datum:** 2026-09-30 · **Status:** entschieden

## Kontext
Figma zeigt «Beenden» als Ghost-Button im Trainingskopf und «Training abschliessen» auf der letzten Übung. Offen war, was «Beenden» mit einem halb fertigen Training macht, wohin «Abschliessen» führt und was passiert, wenn man einen zweiten Plan startet, während ein Training läuft.

## Entscheid
- **«Beenden»** öffnet «Training beenden?» mit drei Wegen:
  - «Beenden und speichern»: Status `finished`, die abgehakten Sätze landen im Verlauf.
  - «Training verwerfen» (destructive): Status `aborted`, erscheint nicht im Verlauf und zählt nicht für Vorbefüllung und Rekorde.
  - «Weiter trainieren».
- **«Training abschliessen»** speichert und führt direkt zum Verlaufs-Detail `/history/:id`. Das Detail baut M6, bis dahin ist es ein Platzhalter.
- **Läuft schon ein Training,** fragt «Training starten» in einem anderen Plan «Laufendes Training fortsetzen?» und führt dorthin. Es gibt höchstens eine aktive Session (DB-Index aus M2).
- **Nicht abgehakte Sätze** bleiben ohne `completedAt` und zählen im Verlauf nicht mit.
- **Rekord braucht eine Basis:** Ohne frühere abgehakte Sätze der Übung gibt es kein «PR». Gleich gute Sätze sind kein Rekord.
- **Android-Zurück** öffnet im Training denselben Dialog, statt die Seite zu verlassen.

**Nachtrag 2026-10-04:** Der Ghost-Button «× Beenden» wirkte neben der Übersicht-Pill unausgewogen, und das × liest sich wie «verwerfen». «Beenden» ist jetzt die Trainingsuhr (`WorkoutClock`): eine Pill mit der laufenden Trainingsdauer und einem Stopp-Symbol. Sie öffnet denselben Dialog.

## Später
- Vibration, Ton und lokale Benachrichtigung beim Timer-Ende kommen mit den nativen Plugins in M8. Bis dahin nutzt der Timer `navigator.vibrate`, falls vorhanden.
- Der Timer-Autostart ist immer an; die Einstellung folgt in M7.

## Umsetzungshinweise
- `ConfirmService.choose()` liefert `'confirm' | 'alternative' | 'cancel'`; `confirm()` bleibt die Ja/Nein-Variante.
- Screens können den Android-Zurück-Button über `BackButtonService.setHandler()` übernehmen und müssen ihn beim Zerstören wieder freigeben.
- `@capacitor-community/keep-awake` hält den Bildschirm an, solange `/workout` offen ist (im Browser über die Wake Lock API, falls vorhanden).
- Duplizierte Sätze werden direkt nach dem Original eingefügt und sind Extra-Sätze. Das Label «Extra» steht über dem ersten Extra-Satz einer Folge.
