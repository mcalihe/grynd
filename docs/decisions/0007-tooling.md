# 0007 – Tooling-Setup (M1)

**Datum:** 2026-09-30 · **Status:** entschieden

## Entscheide
- **Angular 22, zoneless, standalone.** Change Detection läuft über Signals. Neue Komponenten nutzen `OnPush`.
- **Node 24** (`.nvmrc`), weil Angular 22 Node ≥ 22.22 verlangt. **pnpm 12** über corepack, die Version ist in `packageManager` gepinnt. Native Build-Skripte (esbuild, lmdb, …) sind in `pnpm-workspace.yaml` unter `allowBuilds` freigegeben, `nx` ist bewusst ausgeschlossen.
- **Unit-Tests mit dem eingebauten Vitest-Builder** (`@angular/build:unit-test`, jsdom) statt Analog. Weniger Abhängigkeiten, offiziell unterstützt.
- **Tailwind v4 CSS-first.** Farben und Radien kommen aus `src/styles/tokens.css` (aus Figma generiert, siehe `scripts/figma-tokens.md`). Das Spartan-Tailwind-Preset liefert Varianten und Overlay-Styles. Das mitgelieferte Spartan-Farbthema wird **nicht** installiert.
- **Spartan helm** liegt in `src/app/shared/ui` (`components.json`, Stil `vega`). Generierte Komponenten werden an die Figma-Komponente angepasst, zum Beispiel der Button an `9:206` (44/48/56 px, `rounded-lg`, Semibold, Zustände `pressed`/`disabled`).
- **Inter** über `@fontsource-variable/inter`, lokal gebündelt, Zahlen in Tabellenziffern.
- **i18n:** Transloco lädt `public/i18n/{de,en}.json`. Die Startsprache kommt aus `navigator.language`, Fallback ist Englisch.
- **Theme:** `ThemeService` setzt `.dark` am `<html>`. Die Wahl liegt bis M7 in `localStorage`.
- **Capacitor 8:** Android und iOS liegen im Repo. iOS nutzt Swift Package Manager und wird ab M8 in CI gebaut.
- **Zeilenenden:** LF über `.gitattributes`, weil Windows sonst CRLF auscheckt und Prettier scheitert.
