# Grynd – Projektplan

Kostenlose Trainings-App für iOS und Android: Pläne erstellen und Trainings schneller tracken als mit FitNotes – ohne Werbung, Pro-Abo oder Account-Zwang.

Designs und Tokens: [Figma-Datei grynd](https://www.figma.com/design/iCoAOIvfyeCFYFU4Og7rVf/grynd) (Seiten: Foundations, Components, Screens).

---

## 1. Umfang und Leitprinzipien

**Im MVP enthalten:** Pläne erstellen und bearbeiten, ein Training starten und Sätze loggen, Verlauf ansehen, Einstellungen. Alles läuft lokal auf dem Gerät.

**Bewusst nicht im MVP:** Backend, Login, Sync, Pläne teilen und bewerten, Ernährung, Rezepte.

**Leitprinzipien**

- **Loggen muss schneller sein als bei FitNotes:** letzte Werte vorausgefüllt, ein Tap pro Satz, Timer startet automatisch.
- **Offline-first:** Die App funktioniert komplett ohne Netz und ohne Login.
- **Einfachheit vor Features:** Was nicht zwingend nötig ist, kommt weg.
- **Moderationsfrei (für später):** Alles, was geteilt wird, ist strukturiert. Kein geteilter Freitext, keine Uploads.
- **Kosten nahe null:** nur Store-Gebühren.

## 2. Produktkonzept

Ein **Plan ist genau ein Training**: eine feste Abfolge von Übungen mit Sätzen und Wiederholungen pro Übung. Wer einen Split trainiert, legt mehrere Pläne an (z.B. «Oberkörper», «Beine», «Ganzkörper»).

- **Starten:** Die Plan-Karte öffnet den Plan; gestartet wird im Plan-Detail über «Training starten».
- **Wochentage (optional):** Hat ein Plan feste Wochentage, erscheint er an diesen Tagen im Abschnitt «Heute».
- **Reihenfolge:** im Plan per Drag-and-Drop änderbar, im laufenden Training jederzeit flexibel.
- **Bewusst weggelassen:** Trainingstage innerhalb eines Plans, Rhythmus/Rotation, Split-Kategorien, Vorlagen.

## 3. Tech-Stack

| Bereich | Entscheidung | Hinweis |
| --- | --- | --- |
| Framework | Angular (aktuelle Version), standalone, Signals, neue Control-Flow-Syntax | Keine NgModules, kein SSR |
| Native | Capacitor | iOS- und Android-Projekt im Repo |
| UI | Spartan UI (brain + helm) | Helm-Komponenten liegen in `shared/ui` |
| Styling | Tailwind CSS v4 | CSS-first über `@theme`, keine `tailwind.config.js` |
| Icons | Lucide via `ng-icons` | |
| Animation | `motion` (Springs, Stagger, Zahlen), `canvas-confetti` (Partikel) | Nur in Lazy-Chunks; respektiert `prefers-reduced-motion` ([0015](decisions/0015-celebrations.md)) |
| Datenbank | `@capacitor-community/sqlite` (+ `jeep-sqlite` im Browser) | |
| State | Signals in Services | NgRx SignalStore erst bei Bedarf |
| i18n | Transloco, Deutsch und Englisch | Keine hart codierten Texte |
| Package Manager | pnpm | |
| Tests | Vitest (Unit), Playwright (E2E im Browser) | |
| Qualität | angular-eslint, Prettier + `prettier-plugin-tailwindcss` | |
| CI | GitHub Actions | iOS-Builds in der Cloud (kein Mac vorhanden), Tests via TestFlight |

**App-Identität:** Name `Grynd` (Arbeitstitel), `appId: com.michaelisler.grynd`.

**Capacitor-Plugins:** `@capacitor/haptics`, `@capacitor/local-notifications`, `@capacitor-community/keep-awake`, `@capacitor/status-bar`, `@capacitor/splash-screen`, `@capacitor/filesystem`, `@capacitor/share`, `@capacitor/app`, `@capacitor/preferences`.

## 4. Konventionen

- Code, Kommentare und Commits auf Englisch; Commits nach Conventional Commits.
- Ordnerstruktur nach Features: `core/` (DB, Services), `features/plans`, `features/workout`, `features/history`, `features/settings`, `shared/ui` (Spartan-Helm), `shared/components` (eigene Komponenten).
- IDs als UUIDv7, von der App erzeugt. Jeder Datensatz hat `createdAt`, `updatedAt`, `deletedAt` (Soft Delete), damit ein späterer Sync ohne Migration klappt.
- Nie Farben, Abstände oder Radien hart im Code: nur Tokens bzw. Tailwind-Klassen, die auf Tokens zeigen.
- Komponentennamen im Code entsprechen den Figma-Namen (z.B. Figma `Grynd/Set Row` mit `State=open|completed|record|menu-open` → `SetRow` (`app-set-row`) mit `state: 'open' | 'completed' | 'record' | 'menu-open'`). Zuordnung in `docs/design/component-map.md`.

## 5. Design-System

Figma ist die Quelle für Tokens. Die Variablen tragen bereits ihren CSS-Namen als Code-Syntax (`var(--primary)` usw.) und können über den Figma-MCP-Server ausgelesen werden.

- **Markenfarbe:** Volt Lime (Skala `brand/50–950`), dazu `neutral/50–950` sowie Statusfarben `green`, `amber`, `red`.
- **Semantische Tokens** (Light und Dark, Namen wie shadcn/Spartan): `background`, `foreground`, `card`, `card-foreground`, `popover`, `popover-foreground`, `primary`, `primary-foreground`, `secondary`, `secondary-foreground`, `muted`, `muted-foreground`, `accent`, `accent-foreground`, `destructive`, `border`, `input`, `ring`, `chart-1` bis `chart-5` sowie eigene: `success`, `warning`, `highlight`, `surface-elevated`, `muscle-chest` … `muscle-core` (feste Farbe pro Muskelgruppe für Diagramme, [0016](decisions/0016-history-statistics.md)). Radien: `--radius` (12), `--radius-lg` (16), `--radius-xl` (20), `--radius-full` (Pill).
- **Farbregeln:** Fortschritt immer in `primary`. `success` nur für Status-Meldungen (Badges, Toasts, Trends). Icons übernehmen die Vordergrundfarbe ihrer Fläche (auf `primary` → `primary-foreground`).
- **Theme:** Automatisch (`prefers-color-scheme`, reagiert live), Hell oder Dunkel; Wahl in den Einstellungen gespeichert. Ein `ThemeService` setzt `.dark` am `html`-Element (Tailwind v4: `@custom-variant dark`) und passt die Statusleiste an. Light und Dark zeigen nur auf verschiedene Stufen derselben Palette.
- **Schrift:** Inter (Platzhalter, finale Wahl offen), lokal gebündelt, Tabellenziffern für alle Zahlen.
- **Layout:** 4er-Raster, Touch-Ziele mindestens 44 px, Kontrast für Text mindestens 4,5:1.

## 6. Datenmodell (lokal, SQLite)

Alle Tabellen haben `id` (UUIDv7), `createdAt`, `updatedAt`, `deletedAt`. Dazu kommt eine kleine `meta`-Tabelle (key/value, z.B. `catalogVersion`). Umsetzung und Details: [0008](decisions/0008-data-layer.md).

| Tabelle | Felder | Hinweis |
| --- | --- | --- |
| `exercise` | key, nameDe, nameEn, primaryMuscles, secondaryMuscles, muscleGroup, force (push / pull / static), equipment, level, category, images | Katalog aus free-exercise-db (gemeinfrei), mit der App ausgeliefert, nur lesbar; deutsche Namen per AI übersetzt |
| `plan` | name, weekdays (Liste 0–6, optional) | Ein Plan = ein Training |
| `plan_exercise` | planId, exerciseId, position, targetSets, repMin, repMax, restSeconds | Feste Reihenfolge über `position`; Standard 3 × 8–12, 90 s |
| `workout_session` | planId (optional), startedAt, finishedAt, status (active / finished / aborted) | Maximal eine aktive Session |
| `session_exercise` | sessionId, exerciseId, position, status (open / done), repMin, repMax, restSeconds | Kopie der Plan-Übungen inkl. Ziele beim Start |
| `exercise_interval` | sessionExerciseId, enteredAt, leftAt | Zeiträume, in denen die Übung angezeigt wurde; beliebig viele |
| `set_log` | sessionExerciseId, position, weightKg, reps, completedAt, isExtra | Gewicht immer in kg |

## 7. Geschäftsregeln

- **Session als Kopie:** Beim Start werden Übungen und Soll-Sätze des Plans in `session_exercise` und `set_log` kopiert. Änderungen im Training (Reihenfolge, Extra-Sätze, Sätze löschen/duplizieren) betreffen nur die Session, nie den Plan.
- **Vorbefüllung:** Gewicht und Wiederholungen pro Satzposition aus der letzten abgeschlossenen Session mit derselben Übung; fehlt eine Position, gelten die Werte des letzten Vorsatzes; sonst Gewicht leer und Wdh. = Plan-Minimum. Verworfene Trainings zählen nicht.
- **Extra-Satz:** «+ Satz» übernimmt die Werte des letzten Satzes und setzt `isExtra = true`.
- **Heute:** alle Pläne, deren `weekdays` den aktuellen Wochentag enthalten (mehrere möglich).
- **Fortsetzen:** Eine aktive Session überlebt App-Neustarts; die App öffnet sie beim Start wieder.
- **Rekord:** Ein Satz ist ein PR, wenn sein geschätztes 1RM (Epley: kg × (1 + reps / 30)) über allen bisherigen abgehakten Sätzen dieser Übung liegt (abgeschlossene Sessions und frühere Sätze der laufenden). Ohne Basis und bei Gleichstand kein PR. Wird zur Laufzeit berechnet, nicht gespeichert.
- **Beenden/Abschliessen:** siehe [0011](decisions/0011-workout-flow.md). «Beenden und speichern» → `finished`, «Training verwerfen» → `aborted` (nicht im Verlauf).
- **Einheiten:** intern kg, Umrechnung in lb nur für die Anzeige (auf 0,1 gerundet, Schritt 2,5 lb; eingegebene lb bleiben exakt erhalten).
- **Zeiterfassung:**
  - Training: `startedAt` beim Start, `finishedAt` bei «Training abschliessen».
  - Übung: Jedes Mal, wenn eine Übung zur aktuellen Seite wird, beginnt ein Intervall (`enteredAt`); beim Wegwischen oder Abschliessen wird es geschlossen (`leftAt`). Zeit pro Übung = Summe der Intervalle.
  - Intervalle unter ca. 3 Sekunden werden nicht gespeichert.
  - Wird die App beendet, schliesst sie offene Intervalle beim nächsten Start mit dem Zeitpunkt des letzten abgehakten Satzes.
  - Satz: `completedAt` beim Abhaken.
  - Alle Zeiten als UTC speichern, in Lokalzeit anzeigen; Dauern immer aus Zeitstempeln berechnen, nie hochzählen.

## 8. Screens

### Pläne (`/plans`)
- Abschnitt «Heute» nur, wenn ein Plan für heute geplant ist. Heutige Plan-Karte sieht aus wie alle anderen.
- Plan-Karte: Name, Anzahl Übungen, Wochentage als Chips, rechts Pfeil-Button (44 px). Karte und Pfeil öffnen den Plan; gestartet wird im Plan-Detail. Pfeil beim heutigen Plan in `primary`, sonst `secondary`.
- Kein Primary-Button unten. «Neuer Plan» als Secondary-Button in der Liste.
- Bottom-Navigation: Pläne, Verlauf, Einstellungen. Ein laufendes Training ist ein Vollbild ohne Navigation und wird über den Plan gestartet (kein Training-Tab).

### Plan-Detail, Plan bearbeiten, Plan erstellen (`/plans/:id`, `/plans/:id/edit`, `/plans/new`)
- **Plan-Detail ist eine Ansicht** ([0010](decisions/0010-plan-detail-and-editor.md)): Wochentage und Reihenfolge nur angezeigt, Chevron klappt die Ziele auf; «Bearbeiten» oben rechts, «Training starten» als Primary.
- **Bearbeiten/Erstellen:** Ziele pro Übung (Sätze, Wdh. min/max, Pause) im aufgeklappten Eintrag; «Plan löschen» im Drei-Punkte-Menü mit Bestätigung (Soft Delete).
- Planname, «Wochentage (optional)» als 7 Chips, Übungsliste mit Drag-Handle, Name, «3 × 8–10», Menü.
- «Plan erstellen» = gleicher Screen wie Bearbeiten, Titel «Neuer Plan», Empty State; «Plan speichern» deaktiviert, solange Name oder Übungen fehlen.
- Kein Abbrechen-Button, verlassen über den Zurück-Pfeil.
- **Unsaved Changes Guard:** Bei ungespeicherten Änderungen Dialog «Änderungen verwerfen?» mit «Verwerfen» (destructive) und «Weiter bearbeiten». Umsetzung als `CanDeactivateFn`; greift auch beim Android-Zurück-Button (`App`-Listener `backButton`, Navigation über den Router). Rückgängig gemachte Änderungen zählen nicht als dirty.

### Übungen hinzufügen (`/plans/new/add-exercises`, `/plans/:id/edit/add-exercises`)
- Vollbild mit X, Suchfeld (tolerant bei Umlauten und Gross-/Kleinschreibung), Filter-Chips: Muskelgruppe (Brust, Rücken, Schultern, Beine, Po, Arme, Core), Bewegung (Push, Pull), Equipment (Langhantel, Kurzhantel, Kabel, Maschine, Körpergewicht). Innerhalb einer Gruppe ODER, zwischen Gruppen UND.
- «Zuletzt verwendet» (3 Übungen aus `session_exercise`), dann alphabetische Liste mit Vorschaubild, Muskelgruppe und Equipment.
- Mehrfachauswahl, Primary-Button «3 Übungen hinzufügen». Übungen, die schon im Plan sind: gedimmt, «Im Plan», nicht auswählbar.
- Neue Übungen am Ende des Plans mit Standard 3 × 8–12. Schliessen mit Auswahl → Guard-Dialog.

### Training (`/workout`)
- **Eine Übung pro Seite,** horizontales Wischen per CSS Scroll-Snap (`scroll-snap-type: x mandatory`). Kopfbereich und Weiter-Button bewegen sich nicht mit.
- **Segment-Indikator oben:** ein Segment pro Übung (Session-Reihenfolge), füllt sich anteilig zu den erledigten Sätzen (inkl. Extra-Sätze), aktuelles Segment hervorgehoben, ohne Zahlen.
- **Übersicht:** Pill «2 / 6» mit Listen-Icon und Chevron öffnet ein Sheet mit allen Übungen. Umsortieren per Angular CDK Drag and Drop, alle Zeilen immer verschiebbar. Status als Fortschrittsring in `primary` (voll = Haken), aktuelle Übung über Hintergrund und Rahmen markiert, kein Text. Tippen springt zur Übung.
- **Übungsmenü (drei Punkte):** «1 nach hinten verschieben», «Ans Ende verschieben».
- **Satz-Zeile** (80 px): Nummer, Vorwert, Stepper für kg und Wdh., Haken. Werte lassen sich auch durch waagrechtes Wischen über das Zahlenfeld ändern (schneller = grössere Sprünge). Zustände: offen, erledigt, Rekord, Menü offen. Kein «aktiv»-Zustand.
- **Satz-Kontextmenü:** Long-Press (ca. 500 ms, mit Haptik) oder kleines Drei-Punkte-Icon; «Satz duplizieren», «Satz löschen». Kein Swipe-to-Delete.
- **«+ Satz»** unter den Sätzen; Extra-Sätze mit Label «Extra».
- **Timer:** neutraler Timer als feste Leiste über dem Weiter-Button (kein Sheet). Bereit: Standarddauer + Chevron + Play. Läuft: Restzeit, Fortschrittslinie, −15 / +15, Stopp. Letzte 10 s in `warning`. Tippen auf die Zeit öffnet ein Popover mit 0:30, 1:00, 1:30, 2:00, 3:00. Startet automatisch nach dem Abhaken eines Satzes (abschaltbar). Speichert die Endzeit, nicht einen Zähler. Bei Ablauf: Haptik und eine lokale Benachrichtigung mit Standardton (auch im Hintergrund, [0014](decisions/0014-native-polish.md)).
- **Weiter-Button:** «Weiter zu {Übungsname}», einzeilig mit Ellipsis; bei der letzten Übung «Training abschliessen».
- **Beenden:** Trainingsuhr rechts im Kopf, gleich wie die Übersicht-Pill: laufende Trainingsdauer (aus `startedAt`, h:mm:ss ab einer Stunde) mit Stopp-Symbol. Tippen öffnet den Dialog «Training beenden?» mit «Beenden und speichern», «Training verwerfen» (destructive), «Weiter trainieren». Android-Zurück öffnet denselben Dialog ([0011](decisions/0011-workout-flow.md)).
- **Belohnungen** ([0015](decisions/0015-celebrations.md)): Satz abhaken = Haken federt auf mit Funken; Rekord = Sterne und «PR»-Badge; Übung fertig = Badge mit Lob und Konfetti, das ins Fortschrittssegment fliegt (einmal pro Übung); alle Übungen erledigt = «Training abschliessen» pulsiert. Nie blockierend, ohne Ton.
- **Abschliessen** (auch «Beenden und speichern») führt zum Feier-Screen `/workout/done/:id` (Pokal, Konfetti, Kennzahlen zählen hoch) und mit «Weiter» zum Verlaufs-Detail `/history/:id`.
- «Training starten» bei laufendem Training fragt «Laufendes Training fortsetzen?» und führt zu `/workout`.
- Bildschirm bleibt an, solange `/workout` offen ist (`@capacitor-community/keep-awake`).

### Verlauf (`/history`, `/history/:sessionId`, `/history/plans/:planId`)
- Drei Ansichten über ein Segmented Control: **Liste** (Standard, wie unten), **Kalender** (Monat mit Trainingstagen, Monatszahlen, Serie) und **Statistik** (Woche/Monat/Jahr mit Kennzahlen und Diagramm, Kraft, Muskelgruppen als Ring, Konstanz, Pläne). Details in [0016](decisions/0016-history-statistics.md).
- Wochenübersicht der laufenden Woche (Montag bis Sonntag) als einfarbiges Balkendiagramm (`chart-1`): Höhe = Trainingsdauer des Tages relativ zum längsten Tag, Tage ohne Training als niedrige graue Balken. Kopf mit Anzahl Trainings, Gesamtdauer und Differenz zur Vorwoche (positiv in `success`).
- Liste vergangener Trainings, gruppiert nach Woche («Diese Woche», «Vorwoche», danach Datumsbereich): Planname, Tag, Dauer, Anzahl Übungen. Nur abgeschlossene, nicht gelöschte Trainings; verworfene erscheinen nie.
- Leerer Verlauf: Diagramm mit «0 Trainings» und Empty State «Noch keine Trainings».
- **Detail:** Planname, Tag und Startzeit; Kennzahlen Dauer, Volumen (Σ kg × Wdh. abgehakter Sätze, Körpergewicht zählt 0), Sätze und Rekorde, jeweils mit Differenz zum letzten Training desselben Plans; Link «Alle Trainings mit {Plan}»; pro Übung Zeit (Summe der Intervalle), Volumen mit Differenz zum letzten Mal und die abgehakten Sätze mit Badges «Rekord» (`success`) und «Extra». Rekorde zählen gegen früher begonnene Trainings.
- **Planverlauf:** alle Trainings eines Plans mit Durchschnitten, Diagramm der letzten 12 Trainings und geschätztem 1RM pro Übung als Sparkline; erreichbar aus Detail, Statistik und Plan-Detail.
- **Löschen** über das Drei-Punkte-Menü im Detail mit Bestätigung (Soft Delete); gelöschte Trainings zählen nicht mehr für Vorbefüllung und Rekorde ([0012](decisions/0012-history.md)).

### Einstellungen (`/settings`)
- Letzter Tab der Bottom-Navigation (Zahnrad).
- Theme (Automatisch/Hell/Dunkel), Einheiten (kg/lb), Sprache (Deutsch/English, bis zur Wahl die Gerätesprache), Timer-Autostart, JSON-Export/Import als Backup, Version.
- Gespeichert mit `@capacitor/preferences`, wirksam sofort ([0013](decisions/0013-settings-units-swipe-backup.md)).
- **Import ersetzt alle Pläne und Trainings** nach Prüfung der Datei und Bestätigung; Export als Download bzw. über das Teilen-Menü.

## 9. UI-Regeln

- Maximal ein Primary-Button pro Screen, fixiert unten über die volle Breite, oberhalb von Safe Area bzw. Navigation. Ausnahme: Pläne-Screen ohne Button unten.
- Safe Areas: `viewport-fit=cover` und `env(safe-area-inset-*)`.
- Badges ohne Icons.

## 10. Umsetzungsreihenfolge

Jeder Meilenstein wird in kleinen Schritten umgesetzt, jeweils mit Plan Mode, eigenem Branch und Tests.

1. **Setup:** Angular (ohne SSR), Tailwind v4, Spartan UI, Capacitor mit `appId`, ESLint/Prettier, Vitest, Transloco, `ThemeService`, Tokens aus Figma als `tokens.css`, Safe Areas, GitHub Actions (Lint, Test, Build).
2. **Datenschicht:** SQLite inkl. `jeep-sqlite` für den Browser, Migrationen, Repositories, UUIDv7, Import-Skript für den Übungskatalog (free-exercise-db → gebündeltes JSON mit `muscleGroup`-Ableitung und deutschen Namen).
3. **Basis-Komponenten:** Spartan-Komponenten ins Projekt holen, eigene Komponenten nach Figma (Set Row, Progress Ring, Timer Bar, Bottom Navigation, Plan-Karte).
4. **Pläne:** Liste mit «Heute», Detail/Bearbeiten/Erstellen, Übungen hinzufügen, Unsaved Changes Guard.
5. **Training:** Session-Erstellung, Pager, Satz-Zeilen, Vorbefüllung, Extra-Sätze, Kontextmenü, Übersicht mit Umsortieren, Timer, Abschliessen, Fortsetzen nach Neustart, Zeitintervalle.
6. **Verlauf:** Liste, Detail, Wochenübersicht.
7. **Einstellungen:** Theme, Einheiten, Sprache, Timer-Autostart, Export/Import.
8. **Native Feinschliff:** Haptik, Benachrichtigungen, Keep-Awake, Statusleiste, Splash, App-Icons, Cloud-Builds für iOS, TestFlight und interner Test bei Google Play.

## 11. Offene Punkte

- Finale Schrift (Inter als Platzhalter).
- Name «Grynd»: Verfügbarkeit in den Stores, Domain und Marke prüfen.
- Apple Developer Program und Google Play Console anlegen; danach Signatur, TestFlight und interner Test (Roadmap 8.5b, [release.md](release.md)).
- Datenschutzerklärung unter einer öffentlichen URL bereitstellen (beide Stores verlangen eine); Entwurf in [store/privacy.md](store/privacy.md).

Entschieden und daher hier gestrichen: Rekord-Definition (Epley-1RM, [0011](decisions/0011-workout-flow.md), [0012](decisions/0012-history.md)).
