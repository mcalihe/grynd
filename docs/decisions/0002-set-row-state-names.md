# 0002 – Set-Row-Zustände wie in Figma

**Datum:** 2026-09-30 · **Status:** entschieden

## Kontext
`CLAUDE.md` und `plan.md` nannten den Zustand «erledigt» `done`, Figma (`Grynd/Set Row`, `15:1822`) nennt ihn `completed`.

## Entscheid
Code übernimmt die Figma-Namen: `state: 'open' | 'completed' | 'record' | 'menu-open'`.

## Folgen
- `CLAUDE.md` und `plan.md` §4 angepasst.
- `session_exercise.status` (`open` / `done`) im Datenmodell bleibt unverändert: Das ist ein Datenbankwert, keine Figma-Variante.
