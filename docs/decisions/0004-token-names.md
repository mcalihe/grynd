# 0004 – CSS-Namen für fehlende Tokens

**Datum:** 2026-09-30 · **Status:** entschieden

## Kontext
Vier Figma-Variablen hatten keine Web-Code-Syntax.

## Entscheid
In Figma nachgetragen:

| Figma-Variable | Wert | CSS | Tailwind |
| --- | --- | --- | --- |
| `surface-elevated` | Light `white`, Dark `neutral/900` (vorher `neutral/800`, siehe unten) | `--surface-elevated` | `bg-surface-elevated` |
| `radius/base` | 12 | `--radius` (bestehend) | `rounded-md` via `--radius-md: var(--radius)` |
| `radius/lg` | 16 | `--radius-lg` | `rounded-lg` |
| `radius/xl` | 20 | `--radius-xl` | `rounded-xl` |
| `radius/pill` | 999 | `--radius-full` | `rounded-full` |

Die Radien überschreiben die Tailwind-Standardwerte in `@theme`, damit `rounded-*` den Figma-Werten entspricht.

## Nachtrag: Dark-Kontrast
Im Dark Mode waren `surface-elevated`, `muted` und `secondary` alle `neutral/800`. Tracks, Balken und Badges auf erhöhten Flächen hatten dadurch keinen Kontrast. `surface-elevated` zeigt im Dark Mode jetzt auf `neutral/900`.
