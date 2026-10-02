# 0015 – Web-Deployment über FTPS mit PR-Previews

**Datum:** 2026-10-03 · **Status:** entschieden

## Entscheide
- **Produktion** `https://fit.michael-isler.com`, **Previews** `https://preview.fit.michael-isler.com/pr-<n>/`. Beide liegen in eigenen Plesk-Webspaces mit eigenem FTP-Benutzer, deployt wird jeweils nach `httpdocs/`.
- **Eigene Subdomain statt Unterordner der Produktion:** Die Web-App speichert ihre SQLite-Datenbank im IndexedDB, und das gilt pro Origin. Eine Preview unter derselben Domain würde im selben Browser die echten Trainingsdaten teilen und könnte sie mit einer Schema-Migration beschädigen. Die Previews teilen sich untereinander eine Datenbank, das ist in Ordnung.
- **GitHub-Environments `Production` und `Preview`** mit gleich benannten Secrets (`FTP_HOST`, `FTP_USER`, `FTP_PASSWORD`) und der Variable `SITE_URL`. Der Workflow ist für beide gleich, das Environment wählt die Zugangsdaten. Environments lassen sich nicht umbenennen, die Namen bleiben deshalb fix.
- **Produktion erst nach grüner CI:** Der Deploy startet per `workflow_run` nach dem Workflow «CI» auf `main` (oder manuell von `main`). Ein kaputter Stand auf `main` wird also nicht ausgeliefert. Der Job `production-gate` deployt nur, wenn der Commit der aktuelle Stand von `main` ist: Ein `workflow_run`-Job läuft immer als `main`, die Branch-Regel des Environments sieht also nicht, woher der Commit stammt (ein Tag namens `main` passt auch auf den Branch-Filter).
- **`lftp` aus apt statt einer Drittanbieter-Action.** Das FTP-Passwort geht an keinen fremden Code, TLS ist erzwungen (`ftp:ssl-force`), und `lftp` kann beim Schliessen eines PRs den ganzen Ordner löschen.
- **Upload-Reihenfolge:** zuerst neue Dateien, dann `index.html`, zuletzt das Löschen veralteter Dateien. So zeigt die Live-Seite nie auf Bundles, die es noch nicht gibt. Verglichen wird nur über die Dateigrösse, weil ein frischer Checkout jede Datei neuer erscheinen lässt. Dateien, die sich bei gleicher Grösse ändern können (`index.html`, `.htaccess`, i18n, Katalog), werden immer hochgeladen.
- **`.htaccess`** (`deploy/app.htaccess`): SPA-Fallback auf `index.html` (Path-Routing), MIME-Typ `application/wasm`, `index.html` ohne Cache, gehashte Bundles ein Jahr `immutable`. Die Preview-Wurzel (`deploy/preview-root.htaccess`) leitet auf die Produktion um und setzt `X-Robots-Tag: noindex` für alle Previews.
- **Keine Previews für Fork-PRs**, weil diese keine Secrets bekommen.
