# 0004 – CSS-Namen für fehlende Tokens

**Datum:** 2026-09-30 · **Status:** entschieden

## Kontext
Vier Figma-Variablen hatten keine Web-Code-Syntax.

## Entscheid
In Figma nachgetragen:

| Figma-Variable | Wert | CSS | Tailwind |
| --- | --- | --- | --- |
| `surface-elevated` | Light `white`, Dark `neutral/800` | `--surface-elevated` | `bg-surface-elevated` |
| `radius/base` | 12 | `--radius` (bestehend) | `rounded-md` via `--radius-md: var(--radius)` |
| `radius/lg` | 16 | `--radius-lg` | `rounded-lg` |
| `radius/xl` | 20 | `--radius-xl` | `rounded-xl` |
| `radius/pill` | 999 | `--radius-full` | `rounded-full` |

Die Radien überschreiben die Tailwind-Standardwerte in `@theme`, damit `rounded-*` den Figma-Werten entspricht.
