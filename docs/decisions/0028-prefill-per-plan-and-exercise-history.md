# 0028 – Vorbefüllung pro Plan und Übungsverlauf

**Datum:** 2026-11-18 · **Status:** Vorbefüllung entschieden, Übungsverlauf in Arbeit (ändert die Vorbefüllung aus plan.md §7 und den Vergleich pro Übung aus [0016](0016-history-statistics.md))

## Kontext
Dieselbe Übung steht oft in mehreren Plänen, z.B. Bankdrücken in «Oberkörper» und «Ganzkörper». Die Vorbefüllung nahm die Sätze vom letzten Training mit dieser Übung, egal in welchem Plan. Je nach Plan (und Tag) schafft man aber mehr oder weniger: Wer in einem Plan reduzierte, bekam die tieferen Werte auch im anderen vorgeschlagen und umgekehrt. Dazu fehlt eine Ansicht, die zeigt, wie sich eine Übung entwickelt, über alle Pläne und pro Plan.

## Entscheid
- **Vorbefüllung pro Plan, aus dem Verlauf abgeleitet** (mit dem Nutzer entschieden): Die Werte kommen vom letzten abgeschlossenen Training *desselben Plans* mit dieser Übung. Hat der Plan die Übung noch nie trainiert (neuer Plan, neue Übung im Plan), gelten die Werte vom letzten Mal in irgendeinem Plan. Pro Satzposition und mit dem Plan-Minimum ohne Verlauf wie bisher.
- **Keine gespeicherten Werte:** Es gibt keine neue Tabelle und nichts zu verwalten; Backup, Zusammenführen und Teilen bleiben unverändert. Ein Training gehört schon heute zu seinem Plan (`workout_session.planId`).
- **Verworfen: Datensets pro Übung** (benannte Varianten wie «Schwer» und «Leicht», auf die Plan-Übungen zeigen). Am flexibelsten, aber man müsste Sets anlegen, benennen und im Editor wie im Training wählen; der Plan ist schon der Zusammenhang, in dem man trainiert. Ebenfalls verworfen: Werte pro Plan-Übung speichern, weil sie sich mit dem Verlauf doppeln würden.
- **Nur Trainings mit abgehakten Sätzen zählen:** Ein Training, in dem die Übung übersprungen wurde, liefert keine Werte; dann gilt das Training davor. Verworfene und gelöschte Trainings zählen wie bisher nicht.
- **Ohne Plan** (Ausdauer, [0025](0025-cardio-and-calories.md)): «derselbe Plan» heisst eine Ausdauer ohne Plan; sonst gilt dieselbe Aktivität in einem Plan.
- **Übung zweimal im Plan:** Der Picker lässt das nicht zu, ein importierter Plan könnte es aber enthalten. Der n-te Eintrag der Übung bekommt dann die Werte des n-ten Eintrags vom letzten Mal (dieselbe Zuordnung wie in [0026](0026-rest-per-exercise.md)), sonst die des letzten.
- **«Letztes Mal» im Verlauf-Detail gleich wie die Vorbefüllung:** Das Volumen pro Übung vergleicht mit dem letzten früheren Training desselben Plans, sonst mit dem letzten in irgendeinem Plan (vorher: egal in welchem Plan, 0016).
- **Rekorde bleiben pro Übung über alle Pläne:** Ein Rekord ist ein Rekord, egal in welchem Plan.
- **Übungsverlauf:** neuer Screen mit Filter «Alle Pläne» / pro Plan, erreichbar aus Verlauf-Detail, den Kraft-Listen (Planverlauf, Statistik), Plan-Detail und dem Übungsmenü im Training. Zuerst ein Entwurf in Figma ([0005](0005-missing-screens.md)); Details folgen hier nach der Freigabe.

## Umsetzungshinweise
- `WorkoutService.previousSets(exerciseId, planId, occurrence)` wählt das Training mit `ORDER BY (ws.planId IS ?) DESC, ws.startedAt DESC` und verlangt mindestens einen abgehakten Satz der Übung. `previousForOccurrence()` (`core/workout/prefill.ts`) gruppiert die Sätze nach Session-Übung (UUIDv7, also in Erstellungsreihenfolge) und wählt den Eintrag. `prefillSets` und `prefillCardio` sind unverändert.
- `HistorySetFact` hat dafür `planId`; `exerciseComparison()` nimmt zuerst Fakten desselben Plans.
