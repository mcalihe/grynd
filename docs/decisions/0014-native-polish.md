# 0014 – Native Feinschliff: Haptik, Timer-Benachrichtigung, Statusleiste, Splash, App-Icon, E2E

**Datum:** 2026-10-01 · **Status:** entschieden

## Kontext
M8 soll die App auf dem Gerät rund machen und den Hauptablauf automatisch absichern. Apple- und Google-Konten gibt es noch nicht, deshalb ist der Release-Teil getrennt.

## Entscheid
- **App-Icon «Pulse Arc»** (Figma-Seite «App Icon – Fitness», `85:3759`, dort als Master empfohlen): lila-pinker Verlauf, Puls-Linie, Mint-Punkt. Es weicht bewusst von der In-App-Farbe Volt Lime ab. Die Exportvorlagen liegen auf derselben Seite (Frames «Export · …»): 1024er-Icon ohne Rundung, Vorder- und Hintergrund für Android Adaptive Icons, Splash hell und dunkel (2732², Icon 560 px auf `background`). Generiert wird mit `@capacitor/assets` (`pnpm assets:generate`). Der transparente Vordergrund entsteht aus zwei Exporten auf Schwarz und Weiss (Matting), weil Figma-Screenshots keinen Alpha-Kanal haben.
- **Haptik** über `HapticsService` (nur nativ): Satz abhaken = Impact leicht, Long-Press = Impact mittel, Wischen auf Zahlenfeldern = Selection-Ticks, Timer-Ende = Notification Success. Im Browser fällt nur das Timer-Ende auf `navigator.vibrate` zurück. Rekord und fertige Übung = Notification Success, Konfetti-Kanonen beim Abschliessen = Impact schwer ([0015](0015-celebrations.md)).
- **Timer-Ende als lokale Benachrichtigung** (`TimerNotificationService`): Jeder Start und jedes ±15 s plant die Benachrichtigung neu auf die Endzeit (feste ID), Stopp hebt sie auf. Die Aufrufe laufen nacheinander. Die Berechtigung wird beim ersten Timer gefragt; ohne sie läuft der Timer einfach still. Android nutzt `allowWhileIdle`; ohne Exact-Alarm-Erlaubnis plant das Plugin ungenau. Kleines Icon `ic_stat_grynd` (Puls-Linie, weiss).
- **Statusleiste** folgt dem aufgelösten Theme (`Style.Dark` = helle Schrift).
- **Splash** blendet die App selbst aus (`launchAutoHide: false`), sobald der erste Frame nach den App-Initializern gerendert ist.
- **E2E** mit Playwright (Chromium, 393×852, Locale de-CH, eigener `ng serve` auf :4300): Plan anlegen → Training → Satz 60 kg × 8 → abschliessen → Verlauf-Detail (480 kg) → Verlauf-Liste. Läuft als eigener CI-Job.

## Später
- Signatur, TestFlight und Play-Upload, sobald die Konten existieren (Roadmap 8.5b).
- Prüfen auf dem Gerät: Haptik, Benachrichtigung im Hintergrund, Statusleiste (randlose Darstellung auf Android 15) und Splash.
