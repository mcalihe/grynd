# 0006 – Navigation ohne Training-Tab

**Datum:** 2026-09-30 · **Status:** entschieden

## Kontext
Die Bottom-Navigation hatte die Tabs Pläne, Training und Verlauf. Ein laufendes Training ist aber ein Vollbild ohne Navigation und wird über «Beenden» oder «Training abschliessen» verlassen. Ohne laufendes Training gibt es im Tab nichts zu zeigen. Der Tab war also nie sinnvoll erreichbar. Gleichzeitig fehlte ein Einstieg zu den Einstellungen.

## Entscheid
Bottom-Navigation: **Pläne · Verlauf · Einstellungen**. Einstellungen ist der letzte Tab, mit Zahnrad-Icon. Ein Training startet nur im Plan-Detail. Eine aktive Session öffnet die App beim Start wieder (unverändert, siehe `plan.md` §7).

## Folgen in Figma
- Icon `Name=settings` ergänzt, Bottom Navigation `Active=plans|history|settings`.
- Neue Komponente `Grynd/Segmented Control` (`84:2788`), weil Tabs nur zwei Optionen kennt.
- Neue Screens: Einstellungen, Pläne · Leer, Verlauf-Detail, Training · Letzte Übung (Node-IDs in `docs/design/component-map.md`).
