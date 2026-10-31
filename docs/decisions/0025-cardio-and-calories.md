# 0025 – Ausdauertraining und Kalorien

**Datum:** 2026-10-31 · **Status:** entschieden (ergänzt [0011](0011-workout-flow.md), [0016](0016-history-statistics.md) und [0023](0023-pause-workout.md); erweitert das Backup-Format)

## Kontext
Grynd kannte nur Krafttraining: Jeder Satz war kg × Wdh. Der Katalog hatte zwar 14 Cardio-Übungen (Laufband, Ergometer, Rudergerät, …), sie liessen sich aber nur mit kg × Wdh. loggen und zählten in der Statistik als «Beine». Kalorien und Körpergewicht gab es nirgends. Gewünscht sind Ausdauertraining (Dauer, Distanz, Stufe, kcal vom Gerät, Puls) und eine Kalorienanzeige für alle Trainings. Figma hat keinen Entwurf dafür (nur Code).

## Entscheid
- **Ausdauer auf beiden Wegen** (mit dem Nutzer entschieden): Cardio-Übungen gehören in jeden Plan (z.B. 10 min Laufband nach dem Krafttraining), und auf dem Pläne-Screen startet «Ausdauer starten» ein Training ohne Plan. Ein Training nachträglich erfassen gibt es nicht.
- **Cardio erkennen:** `exercise.category = 'cardio'`, wie der Katalog es liefert. Es gibt keine eigene Spalte.
- **Eigene Aktivitäten im Katalog** (mit dem Nutzer entschieden): Laufen, Gehen, Wandern, Schwimmen, Inline-Skaten, Nordic Walking, mit Schlüsseln `Grynd_*` aus `scripts/data/cardio-activities.json`, ohne Bilder (Icon statt Foto).
- **Felder pro Eintrag:** Dauer (immer), Distanz, Stufe, kcal vom Gerät, Durchschnittspuls. Welche Felder eine Aktivität zeigt, legt ihr Profil fest; Seilspringen hat z.B. keine Distanz.
  - Die Distanz wird in Metern gespeichert. Angezeigt wird sie in km oder mi, mit einer **eigenen Einstellung**, denn kg + mi und lb + km kommen beide vor.
  - Die Stufe ist eine Zahl mit bis zu einer Nachkommastelle (Widerstand, Steigung 2,5).
- **Ein Eintrag ist eine Zeile in `set_log`:** Dauer und Distanz statt kg × Wdh., abhaken, duplizieren, löschen und «+ Eintrag» wie bei Sätzen. Cardio-Einträge zählen für den Trainingsfortschritt (Segmente, Prozent, Übersicht), sind aber **keine Sätze**: Sie zählen nicht für Sätze, Volumen, Rekorde, Muskelgruppen und die Kraftkarte. Das gilt auch für alte Laufband-«Sätze», die noch als kg × Wdh. geloggt wurden. Cardio-Rekorde gibt es vorerst nicht.
- **Plan:** Das Ziel einer Cardio-Übung ist eine Dauer (Standard 10 Min.) und die Zahl der Einträge (Standard 1). Die Zusammenfassung lautet «10 Min.», bei mehreren Einträgen «2 × 10 Min.», ohne Ziel «Ohne Ziel». Pause und Gewichtsschritt entfallen. Ältere Pläne behalten ihre Satzzahl und haben kein Ziel.
- **Vorbefüllung:** Die Dauer kommt aus dem Plan-Ziel, sonst aus dem letzten abgeschlossenen Training mit der Übung. Distanz und Stufe kommen aus dem letzten Training (wie Gewicht und Wdh.). kcal und Puls werden nie vorbefüllt, sie sind Messwerte des Tages.
- **Im Training mit Plan:** Nach dem Abhaken eines Eintrags startet der Timer nicht automatisch. Die Leiste bleibt sichtbar, damit die Höhe beim Wischen gleich bleibt.
- **Training ohne Plan** (mit dem Nutzer entschieden): Ein Sheet listet die Aktivitäten, zuletzt verwendete zuerst. Das Training hat `planId = null`, eine Übung und einen offenen Eintrag.
  - Der Screen zeigt den Aktivitätsnamen, die Pause, den Stopp (Beenden-Dialog), eine grosse Uhr und die Felder des Profils, dazu das Tempo, sobald eine Distanz eingetragen ist. Primary ist immer «Training abschliessen».
  - Beim Abschliessen wird der Eintrag mit der aktiven Dauer (ohne Pausen) und `finishedAt` abgehakt, in derselben Transaktion.
  - **Abweichung von 0023:** Pausiert steht nur die Uhr still. Die Felder bleiben bearbeitbar, weil man die Werte des Geräts meist nach dem Stoppen abliest.
  - Trainings ohne Plan heissen in Verlauf, Feier-Screen und Leiste «Pausiert» wie die Aktivität und tragen ihr Icon. Differenzen vergleichen mit dem letzten Training derselben Aktivität.
- **Körpergewicht** (mit dem Nutzer entschieden): ein optionaler Wert in den Einstellungen («Training»). Jedes Training speichert ihn beim Start (`workout_session.bodyWeightKg`), damit sich spätere Änderungen nicht auf alte Trainings auswirken. Trainings ohne gespeicherten Wert (etwa alle von vor diesem Update) rechnen mit dem aktuellen Wert. Die Einstellung liegt in Preferences und ist nicht im Backup; der Wert pro Training schon.
- **Kalorien geschätzt, vom Gerät überschreibbar** (mit dem Nutzer entschieden), für alle Trainings:
  - **Cardio-Eintrag:** die kcal vom Gerät, wenn eingetragen, sonst MET × Körpergewicht (kg) × Dauer (h).
  - **Kraftanteil:** Hat das Training abgehakte Kraftsätze, kommt die übrige aktive Zeit dazu: max(0, aktive Dauer − Σ Cardio-Dauer) × 3,5 MET × kg.
  - **Alles oder nichts:** Braucht ein Teil eine Schätzung und fehlt das Körpergewicht, gibt es für das Training keine Kalorien, sondern einen Hinweis auf die Einstellungen. Teilsummen wären irreführend.
  - Geschätzte Werte stehen mit «≈» da. Puls und Stufe fliessen nicht ein: Die Pulsformeln bräuchten Alter und Geschlecht, die Stufe ist je nach Gerät anders.
- **MET-Werte** aus dem Compendium of Physical Activities (Ainsworth et al., 2011). Sie sind beim nächsten Update mit dem 2024 Adult Compendium (pacompendium.com) abzugleichen, das aus der Entwicklungsumgebung nicht erreichbar war.

  | Aktivität | MET | mit Tempo |
  | --- | --- | --- |
  | Gehen (draussen, Laufband) | 3,5 | ACSM-Gehformel bei 2–8 km/h |
  | Nordic Walking | 4,8 | – |
  | Wandern, Trailrunning/Wandern | 6,0 | – |
  | Joggen (Laufband) | 7,0 | ACSM-Laufformel bei 5–25 km/h |
  | Laufen (draussen, Laufband) | 9,8 | ACSM-Laufformel bei 5–25 km/h |
  | Radfahren draussen | 7,5 | Stufen 4,0 / 6,8 / 8,0 / 10,0 / 12,0 / 15,8 (< 16, < 19,3, < 22,5, < 25,7, < 32,2, ab 32,2 km/h) |
  | Ergometer | 6,8 | – |
  | Liegeergometer | 4,8 | – |
  | Crosstrainer | 5,0 | – |
  | Rudergerät | 7,0 | – |
  | Stepper, Treppensteiger | 9,0 | – |
  | Seilspringen | 11,8 | – |
  | Prowler-Sprint, Eisschnelllauf-Sprünge | 8,0 | – |
  | Schwimmen | 6,0 | – |
  | Inline-Skaten | 7,5 | – |
  | Krafttraining (übrige aktive Zeit) | 3,5 | – |

  ACSM: Gehen VO₂ = 0,1 · v + 3,5, Laufen VO₂ = 0,2 · v + 3,5 (v in m/min, ml/kg/min); MET = VO₂ / 3,5. Ausserhalb der genannten Tempi gilt der feste Wert, das fängt auch Tippfehler ab.
- **Tempo:** Laufen, Gehen und Wandern zeigen min/km (bzw. min/mi), Rudern /500 m, Schwimmen /100 m, alles andere km/h (bzw. mph).
- **Anzeige:**
  - **Feier-Screen:** Dauer (volle Breite), dann je nach Training Volumen und Sätze, Distanz und Ø Tempo (eine Aktivität ohne Kraft), Kalorien, Rekorde (volle Breite). Die Karten dazwischen stehen paarweise; bleibt eine allein, nimmt sie die volle Breite ein. Ohne Körpergewicht fehlt die Kalorien-Karte, ein Hinweis steht darunter.
  - **Kennzahlen** (`KeyFigures`) mit zwei Spalten: Eine ungerade letzte Kennzahl nimmt die volle Breite ein.
  - **Verlauf-Detail:** Kennzahl «Kalorien» mit Differenz, pro Cardio-Eintrag eine Zeile wie «25:00 · 5,2 km · 4:48 /km · Stufe 8 · 142 bpm · ≈ 310 kcal».
  - **Statistik:** Kachel «Kalorien» immer, Kachel «Distanz», sobald es Distanzen gibt; beide lassen sich als Diagramm wählen.
- **Picker** (mit dem Nutzer entschieden, passend zu [0024](0024-exercise-picker-filters.md)): keine eigene Filterzeile, sondern ein Chip «Ausdauer» am Ende der Muskel-Zeile. Er gehört zur selben Gruppe: Muskeln wählen Kraftübungen, «Ausdauer» die Cardio-Übungen (die im Katalog sonst als «Beine» gelten), beides zusammen zeigt beides; Geräte filtern wie gewohnt dazu. Die Suche findet Cardio über «ausdauer» und «cardio» statt über Muskelwörter. In der Liste steht «Ausdauer · Maschine», ohne Bild das Icon der Aktivität.
- **Backup:** Die neuen Spalten gehören ab Schema 6 dazu. Ältere Backups haben sie nicht und werden mit leeren Werten importiert.

## Umsetzungshinweise
- **Migration 6** (`006-cardio.ts`): nur `ALTER TABLE … ADD COLUMN`, alles nullable.
  - `set_log`: `durationSec`, `distanceM`, `level`, `kcal`, `heartRate`
  - `plan_exercise` und `session_exercise`: `targetDurationSec`
  - `workout_session`: `bodyWeightKg`
- **Reine Logik:**
  - `core/energy/activities.ts`: Profile pro Übungsschlüssel, `isCardio()`. Ein Test prüft, dass jede Cardio-Übung des Katalogs ein Profil hat.
  - `core/energy/energy.ts`: MET, `entryKcal()`, `sessionEnergy()`.
  - `core/units/distance.ts`: Umrechnung, Tempo.
- **Stepper:** `NumberStepper` und `ValueScrubber` nehmen ein `format` (Zahl oder Dauer m:ss) und einen `origin` (Startwert für ein leeres Feld).
- **Komponenten:** `CardioRow` (`app-cardio-row`), `CardioStartSheet`, `CardioSession`. Long-Press und Haken-Animation teilen sich `SetRow` und `CardioRow` (`LongPress`, `celebrateCheck`).
- **Training:** `WorkoutService.startCardio()` startet ohne Plan, `standalone` und `ActiveWorkout.activity` kennzeichnen es; `end()` schreibt die aktive Dauer in den Eintrag. `WorkoutLauncher` fragt bei laufendem Training nach (Plan-Detail und Pläne-Screen).
- **Verlauf:** `HistoryService.summaries` ist ein `computed`, das die Kalorien mit `sessionEnergy()` und dem Körpergewicht (Training, sonst Einstellung) rechnet. `loadFacts()` lädt nur noch Kraftsätze; Cardio-Einträge kommen aus einer eigenen Abfrage. `previousSessionOf()` vergleicht nach Plan oder Aktivität.
- Vorschau unter `/dev/components` und `/dev/celebration/cardio`.
