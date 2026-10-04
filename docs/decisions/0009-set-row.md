# 0009 – Satz-Zeile (Set Row)

**Datum:** 2026-09-30 · **Status:** entschieden

## Kontext
Die Figma-Komponente `Grynd/Set Row` war zweizeilig und zeigte «Vorher · 80 kg × 8». Die Trainings-Screens (`56:48015` ff.) zeigen dagegen eine einzeilige 80-px-Zeile. Auch die Zustände sahen in Komponente und Screens unterschiedlich aus.

## Entscheid
- **Layout wie in den Screens:** 80 px hoch, Satznummer, Stepper KG, Stepper REPS, Haken (44 px). **Kein Vorwert.** Die Werte sind ohnehin aus der letzten Session vorausgefüllt.
- **Kein Drei-Punkte-Button** (2026-10-04): Der Haken ist ganz rechts, das Satzmenü wird selten gebraucht. Es öffnet per Long-Press, Rechtsklick (Web) oder Tippen auf die Satznummer (die Nummer ist ein Button, damit das Menü auch ohne Long-Press erreichbar ist, z.B. mit Screenreader). Die Figma-Komponente zeigt noch das alte Menü-Icon.
- **Zustände:**
  - `open`: grauer Haken
  - `completed`: gefüllter `primary`-Haken, die Zeile bleibt sonst normal
  - `record`: wie `completed`, dazu ein 4 px breiter `primary`-Akzent links und das Badge «PR» oben rechts
  - `menu-open`: `primary`-Rahmen, 2 px
- Die Figma-Komponente ist entsprechend neu gebaut: `Grynd/Set Row` `96:3055`. Die alte Komponente `15:1822` ist entfernt, sie wurde nirgends verwendet.
- `Grynd/Exercise Card` (`15:1823`) und `Grynd/Training Day Card` (`15:2023`) sind als DEPRECATED markiert. Beide stammen aus dem verworfenen Rotationskonzept.
