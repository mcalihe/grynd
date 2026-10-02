# Builds und Release

Stand: Es gibt noch kein Apple- und kein Google-Entwicklerkonto. Deshalb baut CI vorerst **ohne Signatur** (Roadmap 8.5a). Signatur, TestFlight und Google Play folgen in 8.5b.

## Was CI heute baut

Workflow `.github/workflows/build-native.yml` («Native builds»). Er läuft manuell (Actions → Native builds → Run workflow), bei Tags `v*` und bei PRs, die `android/`, `ios/`, `capacitor.config.ts`, `package.json` oder den Lockfile ändern.

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
| `production` | CI auf `main` grün, oder manuell von `main` | `httpdocs/` des Produktions-FTP-Benutzers → `https://fit.michael-isler.com` |
| `preview` | PR geöffnet oder aktualisiert | `httpdocs/pr-<n>/` des Preview-FTP-Benutzers → `https://preview.fit.michael-isler.com/pr-<n>/` |
| `preview-cleanup` | PR geschlossen oder gemergt | löscht `httpdocs/pr-<n>/` |

Der Link zur Preview erscheint im PR als «View deployment».

### Einmalige Einrichtung

1. **Plesk:** Domain `fit.michael-isler.com` und Subdomain `preview.fit.michael-isler.com` mit je eigenem FTP-Benutzer, beide mit `httpdocs/` in der FTP-Wurzel. Für beide ein Let's-Encrypt-Zertifikat ausstellen. Liegt das DNS nicht bei Plesk, beim DNS-Anbieter A- oder CNAME-Einträge für `fit` und `preview.fit` anlegen.
2. **GitHub** (Settings → Environments) zwei Environments anlegen. Die Namen lassen sich später nicht ändern.

   | Environment | Secrets | Variable `SITE_URL` |
   | --- | --- | --- |
   | `production` | `FTP_HOST`, `FTP_USER`, `FTP_PASSWORD` | `https://fit.michael-isler.com` |
   | `preview` | `FTP_HOST`, `FTP_USER`, `FTP_PASSWORD` | `https://preview.fit.michael-isler.com` |

3. **Empfohlen:** im Environment `production` unter «Deployment branches and tags» nur `main` erlauben. Dann kommt ein Workflow aus einem PR nicht an die Produktions-Zugangsdaten.

### Wenn der Upload scheitert

- **Zertifikatsfehler:** Der Workflow prüft das TLS-Zertifikat des FTP-Servers. `FTP_HOST` muss ein Name sein, den das Zertifikat abdeckt. Bei Plesk ist das oft der Hostname des Servers, nicht die Domain.
- **Server-Fehler 500 nach dem Deploy:** Der Server erlaubt eine Direktive in der `.htaccess` nicht (`AllowOverride`). Der Webspace muss `mod_rewrite` und `mod_headers` zulassen, mit Apache (oder nginx als Proxy vor Apache, der Plesk-Standard).
- **Preview-Daten durcheinander:** Alle Previews teilen sich eine Datenbank im Browser. Abhilfe: in den Website-Einstellungen des Browsers die Daten für `preview.fit.michael-isler.com` löschen.

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

Ablauf im Workflow: `versionCode` aus der Run-Nummer, `versionName` aus `package.json`; `./gradlew bundleRelease` mit Signatur aus den Secrets; Upload des AAB in den Track `internal` (z.B. `r0adkll/upload-google-play`).

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

Ablauf im Workflow (macOS-Runner): Build-Nummer aus der Run-Nummer; `xcodebuild archive` mit `-allowProvisioningUpdates` und den Authentifizierungs-Parametern des API-Schlüssels (`-authenticationKeyPath/-authenticationKeyID/-authenticationKeyIssuerID`), dann `xcodebuild -exportArchive` mit `ExportOptions.plist` (`method: app-store-connect`, `destination: upload`). Der Build erscheint nach der Verarbeitung in TestFlight; interne Tester brauchen keine Review.

Sobald die Konten da sind: Secrets anlegen, dann ergänzt ein eigener PR die Release-Jobs (Tag `v*` → beide Stores).
