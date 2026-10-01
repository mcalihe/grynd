# Grynd – Roadmap

Umsetzbare Aufgaben pro Meilenstein aus [plan.md](plan.md) §10. UI-Aufgaben verweisen auf Figma-Node-IDs. Welche Figma-Komponente zu welchem Code gehört und welcher Frame zu welcher Route, steht in [design/component-map.md](design/component-map.md).

Link-Schema für Node-IDs: `https://www.figma.com/design/iCoAOIvfyeCFYFU4Og7rVf/grynd?node-id=<id mit - statt :>`

---

## Vorgehen

- Pro Meilenstein ein Feature-Branch (`feat/m1-setup`, `feat/m4-plans-list`, …). Pro Aufgabe ein Branch, wenn sie gross ist. Commit nach jedem funktionierenden Schritt, Conventional Commits.
- Jede Aufgabe startet im Plan Mode. Fertig ist eine Aufgabe, wenn `pnpm lint` und `pnpm test` grün sind und Light/Dark gegen den Figma-Frame geprüft ist (Screenshot im Browser-Pane neben `get_screenshot`).
- UI-Aufgaben: zuerst `get_design_context` auf den Light-Frame, dann Dark gegenprüfen. Nur Tokens und helm-Komponenten verwenden, alle Texte über Transloco.
- Geschäftslogik test-first (Vitest): Session-Kopie, Vorbefüllung, PR-Erkennung, Intervalle, Dirty-Erkennung, Filter/Suche, Timer-Restzeit.

---

## M0 – Repo-Hygiene (vor dem Setup)

| # | Aufgabe |
| --- | --- |
| 0.1 | ✅ `plan.md` → `docs/plan.md` verschieben, weil `CLAUDE.md` dorthin verweist |
| 0.2 | ✅ `docs/roadmap.md` und `docs/design/component-map.md` anlegen |
| 0.2b | ✅ `docs/plan.md` §8 Einstellungen: Hinweis «Deine Daten sind nur auf diesem Gerät gespeichert» streichen (MVP ist nur lokal) |
| 0.3 | ✅ Abweichungen Plan ↔ Figma geklärt, siehe `docs/decisions/0001`–`0005` |
| 0.4 | ✅ Fehlende Screens in Figma entworfen: Pläne leer, Training letzte Übung, Verlauf-Detail, Einstellungen; Navigation ohne Training-Tab ([0006](decisions/0006-navigation-without-training-tab.md)) |
| 0.5 | ✅ `surface-elevated` im Dark Mode auf `neutral/900` gesetzt, damit `muted`/`secondary` (`neutral/800`) darauf Kontrast haben ([0004](decisions/0004-token-names.md)) |

## M1 – Setup ✅

Umgesetzt wie geplant, Details in [0007](decisions/0007-tooling.md).

| # | Aufgabe | Figma |
| --- | --- | --- |
| 1.1 | ✅ Angular-Projekt (aktuell, standalone, ohne SSR, pnpm), Ordnerstruktur nach `CLAUDE.md` | – |
| 1.2 | ✅ ESLint (angular-eslint), Prettier + `prettier-plugin-tailwindcss`, Vitest; Scripts `start/test/lint/build` | – |
| 1.3 | ✅ Tailwind v4 CSS-first, `@custom-variant dark`, Inter lokal gebündelt, `tabular-nums` als Standard für Zahlen | – |
| 1.4 | ✅ **Tokens:** `src/styles/tokens.css` aus den Variablen generieren: Primitives, Semantic Light in `:root`, Dark in `.dark`, Layout (spacing/radius), per `@theme inline` an Tailwind gebunden. Namen laut Figma-Code-Syntax, inkl. `--surface-elevated`, `--radius-lg`, `--radius-xl`, `--radius-full`. | Foundations `7:6` |
| 1.5 | ✅ Spartan UI (brain + helm) initialisieren, vorerst nur `button` als Test | Button `9:206` |
| 1.6 | ✅ Transloco (de, en), Sprache aus Gerät, Fallback en | – |
| 1.7 | ✅ `ThemeService` (auto/hell/dunkel, `prefers-color-scheme` live, `.dark` an `html`, Status-Bar-Hook) | – |
| 1.8 | ✅ Capacitor (`com.michaelisler.grynd`), Android-Projekt, iOS-Projekt; `viewport-fit=cover`, Safe-Area-Utilities | Obere/Untere Safe Area in jedem Screen (24/16 px) |
| 1.9 | ✅ App-Shell: Routen `/plans`, `/plans/new`, `/plans/:id`, `/plans/:id/edit`, `/plans/:id/add-exercises` (seit M4: `/plans/new/add-exercises`, `/plans/:id/edit/add-exercises`), `/workout`, `/history`, `/history/:sessionId`, `/settings` (Platzhalter) | – |
| 1.10 | ✅ GitHub Actions: Lint, Test, Build | – |

## M2 – Datenschicht ✅

Umgesetzt, Details in [0008](decisions/0008-data-layer.md). Katalog: alle 876 Übungen mit Thumbnails.

| # | Aufgabe |
| --- | --- |
| 2.1 | ✅ `@capacitor-community/sqlite` + `jeep-sqlite` (Browser), DB-Service mit Init/Open |
| 2.2 | ✅ Migrationssystem (versionierte SQL-Skripte), Schema aller 7 Tabellen aus §6 inkl. `id/createdAt/updatedAt/deletedAt` |
| 2.3 | ✅ UUIDv7-Generator (ohne neue Dependency oder nach Freigabe), UTC-Zeitstempel-Helper |
| 2.4 | ✅ Basis-Repository (Soft Delete, `updatedAt`), Repositories: exercise, plan, plan_exercise, workout_session, session_exercise, exercise_interval, set_log |
| 2.5 | ✅ Import-Skript free-exercise-db → gebündeltes JSON: `muscleGroup`-Ableitung (Brust, Rücken, Schultern, Beine, Po, Arme, Core), `force`, `equipment`-Mapping, deutsche Namen (AI-Übersetzung, einmalig), Bilder-Strategie festlegen |
| 2.6 | ✅ Seed des Katalogs beim ersten Start |
| 2.7 | ✅ Unit-Tests: Repositories gegen In-Memory-/jeep-DB, UUIDv7-Sortierung |

## M3 – Basis-Komponenten ✅

Umgesetzt, Zuordnung in [component-map.md](design/component-map.md), Satz-Zeile nach [0009](decisions/0009-set-row.md). Alle Bausteine unter `/dev/components` (Dev-Build).

Jede Komponente mit Light/Dark gegen die Figma-Komponente prüfen. Dazu eine Storybook-freie Showcase-Route `/dev/components`, nur im Dev-Build.

| # | Aufgabe | Figma |
| --- | --- | --- |
| 3.1 | ✅ helm-Komponenten holen: button, input, badge (+success/warning), switch, checkbox, separator, sonner, card, tabs, sheet, alert-dialog, dropdown-menu, popover, toggle-group | `9:206`, `9:219`, `9:265`, `9:284`, `9:295`, `9:298`, `9:326`, `9:266`, `9:271`, `9:299`, `9:303` |
| 3.2 | ✅ Icons: ng-icons Lucide, Registry der 13 Icons | Icon `9:25` |
| 3.3 | ✅ `NumberInputComponent` (Stepper, Schritt 2.5 kg / 1 Wdh., Tastatur-Eingabe) | Number Input `9:244` |
| 3.4 | ✅ `SetRow` (80 px; Nummer, 2× Stepper, Haken; 4 Zustände; Long-Press 500 ms + 3-Punkte-Icon) | Set Row `96:3055` |
| 3.5 | ✅ `ProgressRingComponent` (SVG, `primary`, voll = Haken) | Progress Ring `66:2852` |
| 3.6 | ✅ `TimerBarComponent` (ready/running/warning/duration; −15/+15, Stopp, Fortschrittslinie) | Timer Bar `72:2641` |
| 3.7 | ✅ `BottomNavigationComponent` (Pläne, Verlauf, Einstellungen; RouterLinkActive) | Bottom Navigation `15:2111` |
| 3.12 | ✅ `SegmentedControlComponent` (2–3 Optionen, auf helm toggle-group) | Segmented Control `84:2788` |
| 3.8 | ✅ `PlanCardComponent` (Pfeil öffnet Plan; `primary` wenn heute, sonst `secondary`, 44 px) | Training Day Card `15:2023`, Beispiel in Pläne `37:27420` |
| 3.9 | ✅ `PageHeaderComponent` (Seitentitel groß / Kopfzeile mit Zurück, Titel, Aktion) und `StickyActionComponent` (Primary unten, volle Breite, über Safe Area) | «Seitentitel» `37:27418`, «Kopfzeile» `37:27710`, «Sticky Aktion» `37:27886` |
| 3.10 | ✅ `SegmentProgressComponent` (Segment pro Übung, anteilig, aktuelles hervorgehoben) | «Trainingsfortschritt» `56:48035` |
| 3.11 | ✅ Weekday-Chips (toggle-group, 7 Chips) | Plan bearbeiten `37:28125` |

## M4 – Pläne ✅

Umgesetzt nach [0010](decisions/0010-plan-detail-and-editor.md): Detail als Ansicht, Editor mit Guard, Löschen im Menü, Picker als Kind-Route des Editors.

| # | Aufgabe | Figma Light | Figma Dark |
| --- | --- | --- | --- |
| 4.1 | ✅ `PlansService` (Signals): Liste, «Heute» nach Wochentag, Anzahl Übungen | – | – |
| 4.2 | ✅ **Pläne-Liste** `/plans`: Abschnitt «Heute» (nur wenn nötig), «Meine Pläne», «Neuer Plan» als Secondary, Bottom-Nav | Pläne `37:27416`, Leer `84:3262` | `37:27562`, `84:3986` |
| 4.3 | ✅ **Plan-Detail** `/plans/:id`: Übungsliste, Primary «Training starten» | Plan-Detail `37:27708` | `37:27902` |
| 4.4 | ✅ **Plan bearbeiten** `/plans/:id/edit`: Name, Wochentage, Drag-and-Drop (CDK), Übungsmenü, «Plan speichern» | Plan bearbeiten `37:28096` | `37:28317` |
| 4.5 | ✅ **Plan erstellen** `/plans/new`: Empty State; mit Übungen; Speichern deaktiviert ohne Name/Übungen | Leer `63:12060`, 2 Übungen `63:12408` | `63:12234`, `63:12616` |
| 4.6 | ✅ **Unsaved Changes Guard**: Dirty-Erkennung per Snapshot-Vergleich (Rückgängig = nicht dirty), `CanDeactivateFn`, Android-`backButton` über den Router, Dialog «Änderungen verwerfen?» | Plan bearbeiten · Dialog `66:1196`, Plan erstellen · Dialog `66:1078` | `66:1271`, `66:1138` |
| 4.7 | ✅ **Übungen hinzufügen** `/plans/new/add-exercises`, `/plans/:id/edit/add-exercises`: Suche (umlaut- und case-tolerant), Filter-Chips (ODER in Gruppe, UND zwischen Gruppen), «Zuletzt verwendet», Mehrfachauswahl, «Im Plan» gedimmt, Primary «N Übungen hinzufügen», X mit Guard | Leer `63:12824`, 3 ausgewählt `63:13440`, Keine Treffer `63:14032` | `63:13132`, `63:13736`, `63:14299` |
| 4.8 | ✅ Tests: Wochentag-Logik, Dirty-Erkennung, Suche/Filter, Standardwerte 3 × 8–12 / 90 s | – | – |

## M5 – Training ✅

Umgesetzt in einem PR (`feat/m5-workout`), Entscheide in [0011](decisions/0011-workout-flow.md). Vibration, Ton und Benachrichtigung beim Timer-Ende sowie die Haptik beim Long-Press folgen in M8; der Autostart-Schalter in M7.

| # | Aufgabe | Figma Light | Figma Dark |
| --- | --- | --- | --- |
| 5.1 | ✅ `WorkoutService`: Session aus Plan kopieren, max. 1 aktive, Fortsetzen nach Neustart (test-first) | – | – |
| 5.2 | ✅ Vorbefüllung aus letzter abgeschlossener Session; Extra-Satz übernimmt letzten Satz (test-first) | – | – |
| 5.3 | ✅ **Training-Grundscreen** `/workout`: Trainingskopf (Pill «2 / 6», Beenden als Ghost), Segment-Fortschritt, Satz-Zeilen, «+ Satz», Weiter-Button «Weiter zu …» / «Training abschliessen» | Training · Normal `56:48015`, Letzte Übung `84:3791` | `56:48160`, `84:4068` |
| 5.4 | ✅ **Pager** mit CSS Scroll-Snap, Kopf und Button bleiben fix; aktuelle Seite → Intervall öffnen/schliessen | Training · Swipe Übung `60:3568` | `60:3851` |
| 5.5 | ✅ **Extra-Satz** mit Label «Extra» | Training · Extra-Satz `56:49343` | `56:49513` |
| 5.6 | ✅ **Satz-Kontextmenü** (duplizieren, löschen), Haptik | Training · Satzmenü `56:49683` | `56:49835` |
| 5.7 | ✅ **Übungsmenü** («1 nach hinten», «Ans Ende») | Training · Übungsmenü `56:48305` | `56:48455` |
| 5.8 | ✅ **Übersicht-Sheet**: Progress Rings, aktuelle markiert, CDK-Reorder, Tippen springt | Training · Übersicht `56:48605` | `56:48814` |
| 5.9 | ✅ **Timer**: Endzeit speichern, Auto-Start nach Haken, −15/+15, Warnung letzte 10 s, lokale Notification bei Ablauf | Timer Bar Area in `56:48015` (`72:2642`) | `72:2650` |
| 5.10 | ✅ **Timer-Dauer-Popover** (0:30 … 3:00) | Training · Timer-Dauer `79:2663` | `79:2832` |
| 5.11 | ✅ Abschliessen/Beenden (finished/aborted), Keep-Awake während aktiver Session | – | – |
| 5.12 | ✅ Zeitintervalle: < 3 s verwerfen, offene Intervalle beim Start mit letztem `completedAt` schliessen (test-first) | – | – |
| 5.13 | ✅ PR-Erkennung per Epley → Set Row `record` (test-first) | Set Row `State=record` | – |

## M6 – Verlauf ✅

Umgesetzt in einem PR (`feat/m6-history`), Entscheide in [0012](decisions/0012-history.md). Neu in Figma: «Verlauf · Leer» und das Drei-Punkte-Menü im Detail (Training löschen).

| # | Aufgabe | Figma Light | Figma Dark |
| --- | --- | --- | --- |
| 6.1 | ✅ `HistoryService`: Sessions nach Woche gruppiert, Dauer aus Zeitstempeln, Gesamtvolumen (test-first) | – | – |
| 6.2 | ✅ **Verlauf** `/history`: Wochen-Balkendiagramm (`chart-1`, leere Tage grau), Liste | Verlauf `37:29734` | `37:29861` |
| 6.3 | ✅ **Verlauf-Detail** `/history/:sessionId`: Kennzahlen (Dauer, Volumen, Sätze), pro Übung Zeit und Satzliste mit Badges «Rekord»/«Extra» | Verlauf-Detail `84:3364` | `84:4001` |

## M7 – Einstellungen ✅

Umgesetzt in einem PR (`feat/m7-settings`), Entscheide in [0013](decisions/0013-settings-units-swipe-backup.md). Zusätzlich: Werte durch Wischen über die Zahlenfelder ändern.

| # | Aufgabe | Figma |
| --- | --- | --- |
| 7.1 | ✅ `SettingsService` (Capacitor Preferences): Theme, Einheit, Sprache, Timer-Autostart | – |
| 7.2 | ✅ **Einstellungen** `/settings` (Tab in der Bottom-Nav): Theme, kg/lb, DE/EN (Segmented Control), Autostart (Switch), Version. Kein Hinweis «Daten nur auf diesem Gerät»: Im MVP gibt es nur lokale Speicherung, also nichts zu erklären. | Einstellungen `84:2796` / Dark `84:3950` |
| 7.3 | ✅ JSON-Export (Filesystem + Share) und Import mit Validierung und Bestätigungsdialog | Dialog `9:303`, Toast `9:326` |

## M8 – Native Feinschliff und Release

| # | Aufgabe |
| --- | --- |
| 8.1 | Haptik (Satz abhaken, Long-Press, Timer-Ende, Wisch-Schritte auf Zahlenfeldern) |
| 8.2 | Local Notifications (Timer), Keep-Awake, Status-Bar passend zum Theme, Splash |
| 8.3 | App-Icons und Splash aus Brand (Volt Lime, Brand-Mark aus `0:1`) |
| 8.4 | Playwright-E2E: Plan anlegen → Training → Verlauf |
| 8.5 | Cloud-Build iOS (GitHub Actions macOS), TestFlight; Android interner Test bei Google Play |

---

## Entscheide aus M0

| # | Entscheid |
| --- | --- |
| [0001](decisions/0001-plan-card-opens-plan.md) | Plan-Karte hat einen Pfeil und öffnet den Plan; Start im Plan-Detail |
| [0002](decisions/0002-set-row-state-names.md) | Set-Row-Zustände heissen wie in Figma: `open`, `completed`, `record`, `menu-open` |
| [0003](decisions/0003-rest-timer-deprecated.md) | `Grynd/Rest Timer` ist veraltet, die Timer Bar ersetzt ihn |
| [0004](decisions/0004-token-names.md) | CSS-Namen für `surface-elevated` und Radien |
| [0005](decisions/0005-missing-screens.md) | Fehlende Screens entwirft Claude in Figma (Aufgabe 0.4) |

## Verifikation

- Pro Aufgabe: `pnpm lint`, `pnpm test` grün. UI im Browser-Pane (`pnpm start`) in Light und Dark bei 393×852 neben `get_screenshot` des Figma-Frames vergleichen.
- Datenschicht: Tests gegen jeep-sqlite. Nach jedem Meilenstein Smoke-Test auf Android (`npx cap sync`, Gerät/Emulator).
- Ende M5: E2E-Flow Plan → Training → Neustart → Fortsetzen → Abschliessen manuell auf Android.
- CI: GitHub Actions führt Lint, Test und Build bei jedem PR aus.
