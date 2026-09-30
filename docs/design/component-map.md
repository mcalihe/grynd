# Component Map: Figma → Code

Figma-Datei: [grynd](https://www.figma.com/design/iCoAOIvfyeCFYFU4Og7rVf/grynd). Node-Links: `https://www.figma.com/design/iCoAOIvfyeCFYFU4Og7rVf/grynd?node-id=<id mit - statt :>`.

> `get_metadata` (REST) zeigt nur die Seite «Brand Directions». Alle anderen Seiten erreicht man nur über `use_figma` (Plugin-API) oder `get_design_context`/`get_screenshot` mit den Node-IDs unten.

Vor dem Bau von UI hier nachsehen. Neue eigene Komponenten hier ergänzen.

## Figma-Bestand (Stand 2026-09-30)

| Seite | ID | Inhalt |
| --- | --- | --- |
| Brand Directions | `0:1` | 3 Farbrichtungen. «Energisch / Volt Lime» ist gewählt. Nur Referenz. |
| Foundations (Previous) | `2:1449` | Veraltet, ignorieren |
| Foundations | `7:5` | Variablen-Doku (`7:6`) |
| Components | `9:5` | Alle Komponenten im Frame `9:6` |
| Screens | `25:1442` | 36 Frames à 393×852, jeweils Light und Dark |

**Variablen** (alle Semantic- und Radius-Variablen haben Web-Code-Syntax, siehe [Entscheid](../decisions/0004-token-names.md)): `Primitives` (31: brand/50–950, neutral/50–950, green/amber/red, white), `Semantic` (27, Modi Light/Dark, Code-Syntax `var(--…)`), `Layout` (spacing 4/8/12/16/24/32/48, radius base/lg/xl/pill).

## Komponenten

| Figma-Komponente | Node | Varianten | Code | Ort |
| --- | --- | --- | --- | --- |
| Button | `9:206` | default/secondary/outline/ghost/destructive × sm/default/lg × default/pressed/disabled | helm `button` | shared/ui |
| Input | `9:219` | default/focus/error | helm `input` | shared/ui |
| Number Input | `9:244` | default/focus/error | `NumberInputComponent` (Stepper −/Wert/+) | shared/components |
| Badge | `9:265` | default/secondary/success/warning/destructive | helm `badge` + Varianten success/warning | shared/ui |
| Switch | `9:284` | checked × default/disabled | helm `switch` | shared/ui |
| Checkbox | `9:295` | checked × default/disabled | helm `checkbox` | shared/ui |
| Separator | `9:298` | horizontal/vertical | helm `separator` | shared/ui |
| Toast | `9:326` | default/success/destructive | helm `sonner` | shared/ui |
| Card | `9:266` | – | helm `card` | shared/ui |
| Tabs | `9:271` | – | helm `tabs` (Segmented Control, z.B. Theme) | shared/ui |
| Sheet | `9:299` | – | helm `sheet` (Übersicht) | shared/ui |
| Dialog | `9:303` | – | helm `alert-dialog` (Änderungen verwerfen) | shared/ui |
| Icon | `9:25` | plus, minus, check, close, arrow, timer, dumbbell, calendar, chartline, skipforward, search, chevrondown, clipboardlist | ng-icons Lucide (`lucidePlus`, … `lucideClipboardList`) | – |
| Grynd/Set Row | `15:1822` | State=open/completed/record/menu-open | `SetRowComponent` `state: 'open' \| 'completed' \| 'record' \| 'menu-open'` | shared/components |
| Grynd/Timer Bar | `72:2641` | State=ready/running/warning/duration | `TimerBarComponent` | shared/components |
| Grynd/Progress Ring | `66:2852` | Value=0, 1/3, 1/2, 2/3, full | `ProgressRingComponent` `value: number (0–1)` | shared/components |
| Grynd/Bottom Navigation | `15:2111` | Active=plans/training/history | `BottomNavigationComponent` | shared/components |
| Grynd/Training Day Card | `15:2023` | – | `PlanCardComponent` (Name, Anzahl, Wochentag-Chips, Pfeil → öffnet Plan) | shared/components |
| Grynd/Exercise Card | `15:1823` | – | `ExerciseCardComponent` (Übungskopf im Training) – vor dem Bau prüfen | shared/components |
| Grynd/Rest Timer | `15:2022` | running/warning | **Deprecated** – ersetzt durch Timer Bar, nicht umsetzen ([Entscheid](../decisions/0003-rest-timer-deprecated.md)) | – |

**Nur in Screens vorhanden, ohne eigene Figma-Komponente** (als eigene Komponenten aus den Screens ableiten):
Weekday-Chips (helm `toggle-group`), Filter-Chips, Popover-Menüs Satz/Übung (helm `dropdown-menu`), Timer-Dauer-Popover (helm `popover`), Segment-Fortschritt (`SegmentProgressComponent`), Plan-Übungszeile mit Drag-Handle (`PlanExerciseRowComponent`), Übungs-Listeneintrag mit Auswahl und «Im Plan» (`ExerciseListItemComponent`), Kopfzeile/Seitentitel (`PageHeaderComponent`), Sticky-Aktion (`StickyActionComponent`), Wochen-Balkendiagramm (`WeekChartComponent`), Verlaufseintrag (`SessionRowComponent`).

## Screens

| Screen | Route | Light | Dark |
| --- | --- | --- | --- |
| Pläne | `/plans` | `37:27416` (verstecktes, leeres «Sticky Aktion» ignorieren) | `37:27562` |
| Plan-Detail | `/plans/:id` | `37:27708` | `37:27902` |
| Plan bearbeiten | `/plans/:id/edit` | `37:28096` | `37:28317` |
| Plan bearbeiten · Dialog | `/plans/:id/edit` | `66:1196` | `66:1271` |
| Plan erstellen · Leer | `/plans/new` | `63:12060` | `63:12234` |
| Plan erstellen · 2 Übungen | `/plans/new` | `63:12408` | `63:12616` |
| Plan erstellen · Dialog | `/plans/new` | `66:1078` | `66:1138` |
| Übungen hinzufügen · Leer | `/plans/:id/add-exercises` | `63:12824` | `63:13132` |
| Übungen hinzufügen · 3 ausgewählt | `/plans/:id/add-exercises` | `63:13440` | `63:13736` |
| Übungen hinzufügen · Keine Treffer | `/plans/:id/add-exercises` | `63:14032` | `63:14299` |
| Training · Normal | `/workout` | `56:48015` | `56:48160` |
| Training · Swipe Übung | `/workout` | `60:3568` | `60:3851` |
| Training · Extra-Satz | `/workout` | `56:49343` | `56:49513` |
| Training · Satzmenü | `/workout` | `56:49683` | `56:49835` |
| Training · Übungsmenü | `/workout` | `56:48305` | `56:48455` |
| Training · Übersicht | `/workout` | `56:48605` | `56:48814` |
| Training · Timer-Dauer | `/workout` | `79:2663` | `79:2832` |
| Verlauf | `/history` | `37:29734` | `37:29861` |
| Verlauf-Detail | `/history/:sessionId` | fehlt | fehlt |
| Einstellungen | `/settings` | fehlt | fehlt |
