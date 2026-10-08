# Builds und Release

Stand: Es gibt noch kein Apple- und kein Google-Entwicklerkonto. Deshalb baut CI vorerst **ohne Signatur** (Roadmap 8.5a). Signatur, TestFlight und Google Play folgen in 8.5b.

## Versionierung und Releases

Semantic Versioning, automatisch aus den Commits auf `main` mit [release-please](https://github.com/googleapis/release-please-action) (Entscheid [0016](decisions/0016-release-please.md)). Die Version steht nur in `package.json`; alles andere leitet sich davon ab.

**Commits:** PRs werden gesquasht, der **PR-Titel** wird zum Commit auf `main` und zur Zeile im Changelog. Er muss deshalb ein Conventional Commit sein (`feat(workout): …`, `fix: …`), der Workflow «PR title» prüft das. Regeln für Typen und Scopes stehen in `CLAUDE.md` («Commits and PRs»).

| Commit | Version (vor 1.0) | Version (ab 1.0) | Im Changelog |
| --- | --- | --- | --- |
| `fix:` | Patch | Patch | Bug Fixes |
| `feat:` | Minor | Minor | Features |
| `perf:` / `revert:` | Patch | Patch | Performance / Reverts |
| `feat!:` oder Footer `BREAKING CHANGE:` | Minor | Major | eigener Abschnitt |
| `docs`, `ci`, `chore`, `refactor`, `test`, `build`, `style` | – | – | nein |

**Ablauf** (`.github/workflows/release.yml`):
1. Jeder Push auf `main` aktualisiert den Release-PR «chore(main): release X.Y.Z». Er erhöht die Version in `package.json`, `src/app/core/app-info.ts` (Markierung `x-release-please-version`) und `.release-please-manifest.json` und ergänzt `CHANGELOG.md`.
2. Release = diesen PR mergen. release-please setzt den Tag `vX.Y.Z` und veröffentlicht einen GitHub-Release mit dem Changelog als Text.
3. Danach baut derselbe Workflow die nativen Builds und hängt `grynd-vX.Y.Z-debug.apk` an den Release.
4. Sobald CI für den Release-Commit grün ist, deployt «Deploy» die Web-App in die Produktion. Nur Releases gehen in die Produktion; der Stand von `main` dazwischen läuft auf Staging (`/main/` des Preview-Hosts).

Native Versionen: Android liest `versionName` aus `package.json` und rechnet `versionCode` = Major · 1 000 000 + Minor · 1 000 + Patch (0.2.0 → 2000), das steigt mit jeder Version. iOS bekommt `MARKETING_VERSION` und `CURRENT_PROJECT_VERSION` nach demselben Schema als Parameter von `xcodebuild` in CI.

- Version und `CHANGELOG.md` nie von Hand ändern. Den Changelog-Text vor dem Release bei Bedarf im Release-PR korrigieren.
- Version erzwingen (z.B. 1.0.0): Commit mit Footer `Release-As: 1.0.0` auf `main`.
- Der Release-PR stammt von `GITHUB_TOKEN`. Seine Workflows warten deshalb auf Freigabe («Approve workflows to run») und laufen erst danach. Eine Preview bekommt er nie: Er ändert nur Version und Changelog, die App ist also dieselbe wie auf Staging (`/main/`).
- Repo-Einstellungen, die das voraussetzt: Squash-Merge mit PR-Titel als Commit-Titel, Merge-Commits und Rebase-Merges aus; Actions → General → «Allow GitHub Actions to create and approve pull requests» an.

## Was CI heute baut

Workflow `.github/workflows/build-native.yml` («Native builds»). Er läuft manuell (Actions → Native builds → Run workflow), bei jedem Release (aufgerufen von «Release») und bei PRs, die `android/`, `ios/`, `capacitor.config.ts`, `package.json` oder den Lockfile ändern.

| Job | Ergebnis |
| --- | --- |
| `android` | Debug-APK als Artefakt `grynd-debug-apk` (14 Tage aufbewahrt) |
| `ios` | Build für den iOS-Simulator ohne Signatur: prüft, dass Projekt und Swift-Pakete kompilieren. Installierbar ist das nicht. |

### Debug-APK auf dem Android-Gerät installieren

1. Im GitHub-Run das Artefakt `grynd-debug-apk` herunterladen und entpacken (`app-debug.apk`).
2. Die Datei aufs Telefon bringen (USB, Cloud, Mail) und öffnen. Android fragt einmalig, ob die App (Dateimanager/Browser) unbekannte Apps installieren darf: erlauben.
3. Alternativ per USB-Debugging: `adb install -r app-debug.apk`.

Debug-Builds sind mit dem Debug-Schlüssel signiert. Eine spätere Play-Version lässt sich nicht darüber installieren, vorher die Debug-App deinstallieren (Daten gehen dabei verloren; vorher in den Einstellungen exportieren).

### Was auf dem Gerät zu prüfen ist (aus M8)

- Haptik: Satz abhaken, Long-Press, Wischen auf Zahlenfeldern, Timer-Ende.
- Timer-Benachrichtigung: Timer starten, App in den Hintergrund, Benachrichtigung mit Ton zur Endzeit; Berechtigungsdialog beim ersten Timer.
- Statusleiste hell/dunkel passend zum Theme, randlose Darstellung (Safe Areas oben/unten).
- Splash ohne weissen Blitz, App-Icon (adaptiv, rund und eckig).
- Keep-Awake im Training, Android-Zurück im Training öffnet den Beenden-Dialog.
- Export über das Teilen-Menü, Import über die Dateiauswahl.

## Web-Deployment

Workflow `.github/workflows/deploy.yml` («Deploy»), Hintergrund in `docs/decisions/0015-web-deployment.md`.

| Job | Auslöser | Ziel |
| --- | --- | --- |
| `production` | nur Releases: CI auf `main` grün für den Release-Commit (gemergter Release-PR); manuell von `main` deployt den letzten Release erneut | `httpdocs/` des Produktions-FTP-Benutzers → `https://fit.michael-isler.com` |
| `staging` | CI auf `main` grün (jeder Merge) | `httpdocs/main/` des Preview-FTP-Benutzers → `https://fit-preview.michael-isler.com/main/` |
| `preview` | PR geöffnet oder aktualisiert, ausser dem Release-PR | `httpdocs/pr-<n>/` des Preview-FTP-Benutzers → `https://fit-preview.michael-isler.com/pr-<n>/` |
| `preview-cleanup` | PR geschlossen oder gemergt | löscht `httpdocs/pr-<n>/` |

Der Link zur Preview erscheint im PR als «View deployment» und in einem Kommentar des Jobs `preview-comment`, der bei jedem Deploy aktualisiert wird und beim Schliessen «Preview removed» meldet.

Staging und Previews sind als solche erkennbar: Die Einstellungen zeigen die Version mit Build-Kennzeichnung (`0.4.0+main.abc1234`, `0.4.0+pr-31.abc1234`, lokal mit `pnpm start` `0.4.0+dev`), der Tab-Titel beginnt mit dem Kanal (`pr-31 · Grynd`). Die Kennzeichnung setzt der Build mit `--define "GRYND_BUILD='…'"` (`src/app/core/app-info.ts`, `angular.json` für `dev`). Releases und native Builds zeigen nur die Version.

### Einmalige Einrichtung

1. **Plesk:** Domain `fit.michael-isler.com` und Subdomain `fit-preview.michael-isler.com` mit je eigenem FTP-Benutzer, beide mit `httpdocs/` in der FTP-Wurzel. Für beide ein Let's-Encrypt-Zertifikat ausstellen. Liegt das DNS nicht bei Plesk, beim DNS-Anbieter A- oder CNAME-Einträge für `fit` und `fit-preview` anlegen. Hinter dem Cloudflare-Proxy bleiben beide Namen eine Ebene tief, sonst deckt das kostenlose Cloudflare-Zertifikat sie nicht ab (`ERR_SSL_VERSION_OR_CIPHER_MISMATCH`).
2. **GitHub** (Settings → Environments) zwei Environments anlegen. Die Namen lassen sich später nicht ändern.

   | Environment | Secrets | Variable `SITE_URL` |
   | --- | --- | --- |
   | `Production` | `FTP_HOST`, `FTP_USER`, `FTP_PASSWORD` | `https://fit.michael-isler.com` |
   | `Preview` | `FTP_HOST`, `FTP_USER`, `FTP_PASSWORD` | `https://fit-preview.michael-isler.com` |

3. **Empfohlen:** im Environment `Production` unter «Deployment branches and tags» nur `main` erlauben. Dann kommt ein Workflow aus einem PR nicht an die Produktions-Zugangsdaten. Zusätzlich prüft der Job `main-gate`, dass der Commit auf `main` liegt, und gibt die Produktion nur für den neusten Release frei.

### Wenn der Upload scheitert

- **Zertifikatsfehler:** Der Workflow prüft das TLS-Zertifikat des FTP-Servers. `FTP_HOST` muss ein Name sein, den das Zertifikat abdeckt. Bei Plesk ist das oft der Hostname des Servers, nicht die Domain. Die Domains laufen über den Cloudflare-Proxy, der kein FTP weiterleitet. Bei netcup gilt das Zertifikat `*.netcup.net`. Ein Wildcard deckt nur eine Ebene ab, deshalb den kurzen Servernamen `<server>.netcup.net` verwenden, nicht `<hosting-id>.<server>.netcup.net` aus dem Kundenpanel (gleicher Server).
- **Server-Fehler 500 nach dem Deploy:** Der Server erlaubt eine Direktive in der `.htaccess` nicht (`AllowOverride`). Der Webspace muss `mod_rewrite` und `mod_headers` zulassen, mit Apache (oder nginx als Proxy vor Apache, der Plesk-Standard).
- **Preview-Daten durcheinander:** Alle Previews teilen sich eine Datenbank im Browser. Abhilfe: in den Website-Einstellungen des Browsers die Daten für `fit-preview.michael-isler.com` löschen.

## Später: signierte Releases (8.5b)

### Android – interner Test bei Google Play

Voraussetzungen:
- Google-Play-Console-Konto (einmalig 25 USD), App `com.michaelisler.grynd` anlegen.
- Upload-Keystore erzeugen (einmalig, gut aufbewahren): `keytool -genkeypair -v -keystore upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000`. Play App Signing aktivieren.
- Service-Account in der Google Cloud mit Zugriff auf die Play Console (Release-Manager für die App).
- Das erste AAB einmal von Hand in der Play Console hochladen (die API verlangt eine bestehende App-Version).

GitHub-Secrets:

| Secret | Inhalt |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | `upload.jks` als Base64 |
| `ANDROID_KEYSTORE_PASSWORD` | Keystore-Passwort |
| `ANDROID_KEY_ALIAS` | `upload` |
| `ANDROID_KEY_PASSWORD` | Schlüssel-Passwort |
| `PLAY_SERVICE_ACCOUNT_JSON` | JSON-Schlüssel des Service-Accounts |

Ablauf im Workflow: `versionCode` und `versionName` aus `package.json` (siehe «Versionierung und Releases»); `./gradlew bundleRelease` mit Signatur aus den Secrets; Upload des AAB in den Track `internal` (z.B. `r0adkll/upload-google-play`).

### iOS – TestFlight

Voraussetzungen:
- Apple Developer Program (99 USD/Jahr).
- App-ID `com.michaelisler.grynd` und App-Eintrag in App Store Connect.
- App-Store-Connect-API-Schlüssel (Rolle «App Manager»); damit kann `xcodebuild` Zertifikat und Profil selbst verwalten, ein Mac ist nicht nötig.

GitHub-Secrets:

| Secret | Inhalt |
| --- | --- |
| `APP_STORE_CONNECT_KEY_ID` | Schlüssel-ID |
| `APP_STORE_CONNECT_ISSUER_ID` | Issuer-ID |
| `APP_STORE_CONNECT_KEY_BASE64` | `.p8`-Datei als Base64 |
| `APPLE_TEAM_ID` | Team-ID |

Ablauf im Workflow (macOS-Runner): Version und Build-Nummer aus `package.json` wie im Simulator-Build; `xcodebuild archive` mit `-allowProvisioningUpdates` und den Authentifizierungs-Parametern des API-Schlüssels (`-authenticationKeyPath/-authenticationKeyID/-authenticationKeyIssuerID`), dann `xcodebuild -exportArchive` mit `ExportOptions.plist` (`method: app-store-connect`, `destination: upload`). Der Build erscheint nach der Verarbeitung in TestFlight; interne Tester brauchen keine Review.

Sobald die Konten da sind: Secrets anlegen, dann ergänzt ein eigener PR die Store-Uploads im Workflow «Release» (nach `release_created` → beide Stores).
