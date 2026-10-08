# Component Map: Figma → Code

Figma-Datei: [grynd](https://www.figma.com/design/iCoAOIvfyeCFYFU4Og7rVf/grynd). Node-Links: `https://www.figma.com/design/iCoAOIvfyeCFYFU4Og7rVf/grynd?node-id=<id mit - statt :>`.

> `get_metadata` (REST) zeigt nur die Seite «Brand Directions». Alle anderen Seiten erreicht man nur über `use_figma` (Plugin-API) oder `get_design_context`/`get_screenshot` mit den Node-IDs unten.

Vor dem Bau von UI hier nachsehen. Neue eigene Komponenten hier ergänzen.

## Figma-Bestand (Stand 2026-10-04)

| Seite | ID | Inhalt |
| --- | --- | --- |
| Brand Directions | `0:1` | 3 Farbrichtungen. «Energisch / Volt Lime» ist gewählt. Nur Referenz. |
| Foundations (Previous) | `2:1449` | Veraltet, ignorieren |
| Foundations | `7:5` | Variablen-Doku (`7:6`) |
| Components | `9:5` | Alle Komponenten im Frame `9:6` |
| Screens | `25:1442` | 44 Frames à 393×852, jeweils Light und Dark. Neue Frames ab y=16184 |

**Variablen** (alle Semantic- und Radius-Variablen haben Web-Code-Syntax, siehe [Entscheid](../decisions/0004-token-names.md)): `Primitives` (43: brand/50–950, neutral/50–950, green/amber/red, white, blue/orange/aqua/violet/yellow/magenta für die Muskelgruppen), `Semantic` (34, inkl. `muscle-*`, Modi Light/Dark, Code-Syntax `var(--…)`), `Layout` (spacing 4/8/12/16/24/32/48, radius base/lg/xl/pill).

## Komponenten

Klassen folgen dem Angular-Styleguide 2025 (ohne `Component`-Suffix), Selektor-Präfix `app-`. Alle Bausteine in allen Zuständen: `/dev/components` (nur im Dev-Build).

| Figma-Komponente | Node | Varianten | Code (Selektor) | Ort |
| --- | --- | --- | --- | --- |
| Button | `9:206` | default/secondary/outline/ghost/destructive × sm/default/lg × default/pressed/disabled | helm `hlmBtn`, Größen 44/48/56, Icon `icon`/`icon-lg` | shared/ui/button |
| Input | `9:219` | default/focus/error | helm `hlmInput` (48 px, Radius 16) | shared/ui/input |
| (Textfeld, mehrzeilig) | – (nur Code) | – | helm `hlmTextarea`, Stil wie `hlmInput`, wächst mit dem Inhalt | shared/ui/textarea |
| Number Input | `9:244` | default/focus/error | im Set-Row-Layout: `NumberStepper` (`app-number-stepper`, 121×44, auf schmalen Phones schmaler, Entscheid [0009](../decisions/0009-set-row.md)) | shared/components/number-stepper |
| Badge | `9:265` | default/secondary/success/warning/destructive | helm `hlmBadge` (32 px Pill) | shared/ui/badge |
| Switch | `9:284` | checked × default/disabled | helm `hlm-switch` (52×32) | shared/ui/switch |
| Checkbox | `9:295` | checked × default/disabled | noch nicht generiert (bei Bedarf) | – |
| Separator | `9:298` | horizontal/vertical | noch nicht generiert, Linien über `border-b` | – |
| Toast | `9:326` | default/success/destructive | helm `hlm-toaster` (sonner, in der App-Shell, `toast()` aus `@spartan-ng/brain/sonner`) | shared/ui/sonner |
| Card | `9:266` | – | kein helm card; Karten als `bg-card rounded-lg border` | – |
| Tabs | `9:271` | – | nicht verwendet, stattdessen Segmented Control | – |
| Sheet | `9:299` | – | helm `hlm-sheet` (`side="bottom"`, Radius 20) | shared/ui/sheet |
| Dialog | `9:303` | – | helm `hlm-alert-dialog` | shared/ui/alert-dialog |
| (Menüs in Screens) | `56:49827`, `56:48449` | – | helm `hlmDropdownMenu` (Einträge ≥ 44 px) | shared/ui/dropdown-menu |
| (Timer-Dauer) | `79:2663` | – | helm `hlm-popover` in `TimerBar` | shared/ui/popover |
| Icon | `9:25` | plus, minus, check, close, arrow, timer, dumbbell, calendar, chartline, skipforward, search, chevrondown, clipboardlist, settings | ng-icons Lucide, zentral in `core/icons.ts` (`APP_ICONS`) | core |
| Grynd/Set Row | `96:3055` | State=open/completed/record/menu-open | `SetRow` (`app-set-row`), Entscheid [0009](../decisions/0009-set-row.md) | shared/components/set-row |
| Grynd/Timer Bar | `72:2641` | State=ready/running/warning/duration | `TimerBar` (`app-timer-bar`) | shared/components/timer-bar |
| (Timer-Ziffern, Motion) | `72:2641` (Beschreibung) | – | `RollingNumber` (`app-rolling-number`) in `TimerBar` | shared/components/rolling-number |
| Grynd/Progress Ring | `66:2852` | Value=0, 1/3, 1/2, 2/3, full | `ProgressRing` (`app-progress-ring`, `value` 0–1) | shared/components/progress-ring |
| Grynd/Bottom Navigation | `15:2111` | Active=plans/history/settings | `BottomNavigation` (`app-bottom-navigation`) | shared/components/bottom-navigation |
| Grynd/Segmented Control | `84:2788` | Options=2/3 × Active=1–3 | `SegmentedControl` (`app-segmented-control`) | shared/components/segmented-control |
| Grynd/Training Day Card | `15:2023` | – | **Deprecated** (Rotationskonzept); Plan-Karte siehe unten | – |
| Grynd/Exercise Card | `15:1823` | – | **Deprecated** (Rotationskonzept) | – |
| Grynd/Rest Timer | `15:2022` | running/warning | **Deprecated** – ersetzt durch Timer Bar ([0003](../decisions/0003-rest-timer-deprecated.md)) | – |

**Aus den Screens abgeleitet** (keine eigene Figma-Komponente):

| Element im Screen | Node | Code (Selektor) |
| --- | --- | --- |
| Planzeile | `37:27450` | `PlanCard` (`app-plan-card`) |
| Trainingsfortschritt | `56:48035` | `SegmentProgress` (`app-segment-progress`) |
| Seitentitel / Kopfzeile | `37:27418` / `37:27710` | `PageHeader` (`app-page-header`, `variant` title/bar) |
| Sticky Aktion | `37:27886`, `56:48144` | `StickyAction` (`app-sticky-action`, `divider` im Training) |
| Satzmenü-Popover | `56:49683` | `SetMenu` (`app-set-menu`, `features/workout`) |
| Übungsmenü | `56:48305` | helm Dropdown-Menü in `ExercisePage` (`app-exercise-page`) |
| Übersicht-Sheet | `56:48605` | `OverviewSheet` (`app-overview-sheet`, helm Sheet + CDK Drag) |
| Trainingsuhr (Beenden) | – (nur Code; Figma-Frames zeigen noch den Ghost-Button «Beenden») | `WorkoutClock` (`app-workout-clock`) |
| Beenden-Dialog | – | `ConfirmDialogHost` über `ConfirmService.choose()` (drei Aktionen) |
| Wochentage | `37:28125` | `WeekdayChips` (`app-weekday-chips`) |
| Satz-Stepper | `56:48064` | `NumberStepper` (`app-number-stepper`, Wert als Spinbutton) |
| Lineal beim Ziehen über einen Stepper | – (nur Code, [0018](../decisions/0018-value-scrubber.md)) | `ValueScrubber` (`app-value-scrubber`, per CDK Overlay aus `NumberStepper`) |
| Notiz einer Übung (Karte) | – (nur Code, [0019](../decisions/0019-exercise-notes.md)) | `ExerciseNote` (`app-exercise-note`) im Training und Plan-Detail |
| Notiz bearbeiten (Sheet) | – (nur Code, [0019](../decisions/0019-exercise-notes.md)) | `ExerciseNoteSheet` (`app-exercise-note-sheet`, helm Sheet + `hlmTextarea`) |
| Übungszeile im Plan (Detail/Editor, ≡-Handle, Chevron) | `37:27708`, `37:28096` | `PlanExerciseRow` (`app-plan-exercise-row`, features/plans) |
| Übungs-Listeneintrag + Filter-Chips im Picker | `63:13440` (Filter-Tabs nach [0016](../decisions/0016-exercise-picker-filters.md)) | im `ExercisePickerPage` (features/plans) |
| «Änderungen verwerfen» / Bestätigungen | `66:1123` | `ConfirmService` + `ConfirmDialogHost` (App-Shell, `@defer`) |
| Wochenübersicht (Balkendiagramm) | `37:29739` | `WeekChart` (`app-week-chart`), Balken über `BarChart` |
| Balkendiagramm (Statistik, Plan-Verlauf) | `120:1844`, `122:1931` | `BarChart` (`app-bar-chart`, optional antippbar) |
| Trainingseintrag im Verlauf | `37:29769` | `HistoryRow` (`app-history-row`) |
| Kennzahlen (auch als wählbare Kacheln) | `84:3425`, `121:1946`, `120:1844` | `KeyFigures` (`app-key-figures`, `selectable`) |
| Übungskarte im Verlauf-Detail | `84:3501` | im `HistoryDetailPage` (features/history) |
| Zeitraum ‹ September 2026 › | `119:1818`, `120:1844` | `PeriodPager` (`app-period-pager`) |
| Monatskalender | `119:1818` | `MonthCalendar` (`app-month-calendar`) |
| Muskelgruppen (Ring mit Legende) | `121:1841` | `DonutChart` (`app-donut-chart`) |
| Kraft-Trend pro Übung | `122:3253` | `Sparkline` (`app-sparkline`) |
| Kraft, Konstanz, Pläne (Statistik) | `121:1796`, `121:1880`, `121:1896` | im `HistoryStatsView` (features/history) |
| Planverlauf-Link (Detail, Plan-Detail) | `121:2022`, `122:3374` | im `HistoryDetailPage` / `PlanDetailPage` |

## Screens

| Screen | Route | Light | Dark |
| --- | --- | --- | --- |
| Pläne | `/plans` | `37:27416` (verstecktes, leeres «Sticky Aktion» ignorieren) | `37:27562` |
| Pläne · Leer | `/plans` | `84:3262` | `84:3986` |
| Plan-Detail | `/plans/:id` | `37:27708` | `37:27902` |
| Plan bearbeiten | `/plans/:id/edit` | `37:28096` | `37:28317` |
| Plan bearbeiten · Dialog | `/plans/:id/edit` | `66:1196` | `66:1271` |
| Plan erstellen · Leer | `/plans/new` | `63:12060` | `63:12234` |
| Plan erstellen · 2 Übungen | `/plans/new` | `63:12408` | `63:12616` |
| Plan erstellen · Dialog | `/plans/new` | `66:1078` | `66:1138` |
| Übungen hinzufügen · Leer | `/plans/new/add-exercises`, `/plans/:id/edit/add-exercises` | `63:12824` | `63:13132` |
| Übungen hinzufügen · 3 ausgewählt | `/plans/new/add-exercises`, `/plans/:id/edit/add-exercises` | `63:13440` | `63:13736` |
| Übungen hinzufügen · Keine Treffer | `/plans/new/add-exercises`, `/plans/:id/edit/add-exercises` | `63:14032` | `63:14299` |
| Training · Normal | `/workout` | `56:48015` | `56:48160` |
| Training · Swipe Übung | `/workout` | `60:3568` | `60:3851` |
| Training · Extra-Satz | `/workout` | `56:49343` | `56:49513` |
| Training · Satzmenü | `/workout` | `56:49683` | `56:49835` |
| Training · Übungsmenü | `/workout` | `56:48305` | `56:48455` |
| Training · Übersicht | `/workout` | `56:48605` | `56:48814` |
| Training · Timer-Dauer | `/workout` | `79:2663` | `79:2832` |
| Training · Letzte Übung | `/workout` | `84:3791` | `84:4068` |
| Training · Übung geschafft (Overlay `ExerciseCelebration`) | `/workout` | – (nur Code, [0015](../decisions/0015-celebrations.md)) | – |
| Training geschafft (`WorkoutCompletePage`) | `/workout/done/:sessionId` | – (nur Code, [0015](../decisions/0015-celebrations.md)) | – |
| Verlauf | `/history` | `37:29734` | `37:29861` |
| Verlauf · Leer | `/history` | `106:1654` | `106:1764` |
| Verlauf-Detail | `/history/:sessionId` | `84:3364` (Menü `106:1648`) | `84:4001` (Menü `106:1651`) |
| Verlauf · Liste (`HistoryListView`) | `/history` | `118:1692` | `122:3429` |
| Verlauf · Kalender (`HistoryCalendarView`) | `/history?view=calendar` | `119:1728` | `122:3501` |
| Verlauf · Statistik (`HistoryStatsView`) | `/history?view=stats` | `120:1760` | `122:3651` |
| Verlauf-Detail · Vergleich | `/history/:sessionId` | `121:1935` | `122:3846` |
| Plan-Verlauf (`PlanHistoryPage`) | `/history/plans/:planId` | `122:1825` | `122:3939` |
| Plan-Detail · Verlauf | `/plans/:id` | `122:3315` | `122:4037` |
| Einstellungen | `/settings` (`SettingsPage`, features/settings) | `84:2796` | `84:3950` |

Hinweis: «Training · Timer-Dauer» lag über «Verlauf» und liegt jetzt bei y=19992. «Verlauf · Leer» liegt bei y=20944. Die Statistik-Frames ([0016](../decisions/0016-history-statistics.md)) beginnen bei y=21896; «Verlauf · Statistik» und «Plan-Verlauf» sind höher als 852 px (scrollende Inhalte).

## App-Icon und Splash

| Element | Figma | Code |
| --- | --- | --- |
| App-Icon «Pulse Arc» (Master) | `85:3762` | `assets/icon-only.png` → iOS AppIcon, Android mipmaps (`pnpm assets:generate`) |
| Adaptive Icon Hinter-/Vordergrund | `112:40` / `112:47` | `assets/icon-background.png` / `assets/icon-foreground.png` |
| Splash hell/dunkel | `112:54` / `112:61` | `assets/splash.png` / `assets/splash-dark.png` |
| Favicon, Apple-Touch-Icon | aus `icon-only.png` | `public/favicon.png`, `public/apple-touch-icon.png` |
