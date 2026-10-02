# 0015 – Belohnungs-Animationen: Satz, Rekord, Übung, Training

**Datum:** 2026-10-02 · **Status:** entschieden

## Kontext
Wer einen Satz abhakt, eine Übung beendet oder das Training abschliesst, sah bisher nur einen Zustandswechsel. Das soll motivieren und Spass machen («Dopamin»). Es kommen später weitere Animationen dazu, deshalb braucht es eine gemeinsame Grundlage statt Einzellösungen.

## Entscheid
- **Libraries:** [`motion`](https://motion.dev) (MIT) für Springs, Keyframes, Stagger und Zahlen-Animationen auf der Web Animations API, dazu [`canvas-confetti`](https://github.com/catdad/canvas-confetti) (ISC, ~6 kB) für Partikel auf einem Canvas. Beide landen nur in Lazy-Chunks (Training, Dev), nicht im Start-Bundle. GSAP (eigene «no charge»-Lizenz) und Lottie (braucht Animations-Dateien, schwer an die Tokens anzupassen) wurden verworfen. `motion` ist auf 13.4.6 gepinnt, weil 14.0.0 jünger als pnpms `minimumReleaseAge` war.
- **Vier Stufen, je seltener desto grösser:**

  | Moment | Auslöser | Was passiert | Haptik |
  | --- | --- | --- | --- |
  | Satz | Set Row `open → completed` | Haken federt auf, Ring-Welle, kleiner Funken-Burst, Lichtstreifen über die Zeile; Segment füllt sich animiert | `tap` (wie bisher) |
  | Rekord | Set Row `→ record` | zusätzlich Sternen-Burst, «PR»-Badge springt rein | `success` |
  | Übung | alle geplanten Sätze erledigt | Badge mit Haken, Strahlen, zufälliges Lob und «Übung 3 von 6 geschafft», Konfetti; das Badge fliegt ins Fortschrittssegment, das hüpft, der Weiter-Button pulsiert kurz | `success`, beim Landen `tap` |
  | Training | «Training abschliessen» und «Beenden und speichern» | Vollbild `/workout/done/:id`: Konfetti-Kanonen und Feuerwerk, Pokal, Titel Wort für Wort, Kennzahlen zählen hoch (Dauer, Volumen, Sätze, Rekorde); «Weiter» → Verlaufs-Detail | `heavy` mit den Kanonen, am Ende `success` |

- **Nur Übergänge feiern:** Zeilen, die beim Laden oder Fortsetzen schon erledigt sind, bleiben ruhig. `menu-open` verdeckt den echten Zustand und zählt nicht als Wechsel. Jede Übung wird pro Training höchstens einmal gefeiert (Ab- und Wiederanhaken wiederholt nichts). Sind alle Übungen erledigt, pulsiert «Training abschliessen» (Ring in `primary`).
- **Nicht blockieren:** Das Übungs-Overlay nimmt keine Eingaben an (`pointer-events-none`), der Timer startet wie bisher. Der Feier-Screen hat genau einen Primary-Button («Weiter»); Android-Zurück macht dasselbe.
- **Reduzierte Bewegung** (`prefers-reduced-motion: reduce`): keine Partikel, keine Springs oder Flüge, Zahlen stehen sofort auf dem Endwert, das Übungs-Badge erscheint kurz statisch. Die Haptik bleibt.
- **Farben nur aus Tokens:** Konfetti liest `--primary`, `--chart-2`, `--chart-3`, `--chart-4`, `--brand-300` zur Laufzeit (passt in Hell und Dunkel), animierte Elemente nutzen Tailwind-Klassen wie `bg-primary`.
- **Ton:** keiner, im Gym läuft meist Musik.
- **Figma:** kein eigener Entwurf, weil sich Bewegung dort schlecht zeigen lässt. Der Feier-Screen besteht nur aus bestehenden Komponenten und Tokens. Alle Animationen lassen sich unter `/dev/components` («Celebrations») abspielen, den Feier-Screen mit Demodaten zeigt `/dev/celebration/demo`.

## Umsetzungshinweise
- `shared/motion/motion.ts`: Presets (`SPRING.snappy|bouncy|gentle`, `EASE_OUT`) und Helfer (`play`, `pop`, `shockwave`, `shine`, `enter`, `flyTo`, `countUp`). Alle prüfen `canAnimate()` (Web Animations API vorhanden, keine reduzierte Bewegung) und lösen sonst sofort auf, auch in jsdom-Tests. Neue Animationen bauen darauf auf.
- `shared/motion/celebration.service.ts`: ein Vollbild-Canvas (`pointer-events-none`), Presets `sparks`, `record`, `exercise`, `collect`, `finale` (gibt eine Stopp-Funktion zurück). In Tests über `CONFETTI_FACTORY` ersetzbar.
- Übung fertig: `exerciseJustDone(before, after)` in `workout.service.ts` (Extra-Sätze zählen nicht).
