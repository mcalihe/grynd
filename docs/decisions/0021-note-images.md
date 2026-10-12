# 0021 – Bilder in Übungsnotizen

**Datum:** 2026-10-12 · **Status:** entschieden (ergänzt [0019](0019-exercise-notes.md) und das Backup-Format aus [0013](0013-settings-units-swipe-backup.md))

## Kontext
Zur Notiz pro Übung sollen sich optional mehrere Bilder hinzufügen lassen, z.B. ein Foto der Geräteeinstellung oder der Ausführung. Die Bilder sind nur für den Nutzer selbst. Offen war, wie viele, wo sie liegen, ob sie ins Backup kommen und wie man sie hinzufügt, ansieht und löscht.

## Entscheid
- **Höchstens 6 Bilder pro Übung** (mit dem Nutzer entschieden): genug für Einstellung und Technik, klein in Speicher und Backup, und im Sheet passen alle in eine Reihe.
- **Bilder gehören zur Übung wie die Notiz** (`exerciseId`), nicht zur Notiz-Zeile: Eine geleerte Notiz wird gelöscht und bekommt beim nächsten Mal eine neue Zeile, die Bilder bleiben. Eine Notiz kann nur aus Bildern bestehen. «Hat eine Notiz» heisst Text **oder** Bilder (Symbol im Plan, Menü «Notiz bearbeiten», Karte im Training).
- **Nur für den Nutzer:** kein Upload, kein Teilen. Sollten Pläne später geteilt werden, gehen Bilder nie mit (wie der Notiztext, plan.md §1). Den Hinweis «Sie bleiben auf deinem Gerät und sind nur für dich» zeigt das Sheet.
- **Speicher:** Die Dateien liegen nicht in SQLite, sondern als JPEG im privaten Datenordner der App (`@capacitor/filesystem`, `Directory.Data`, `note-images/<id>.jpg`; im Browser in IndexedDB). Grund: jeep-sqlite schreibt im Browser bei jedem Schreibzugriff die ganze Datenbank weg, und Megabytes an Bildern würden jedes Abhaken bremsen. In SQLite steht nur die Tabelle **`exercise_note_image`** (`exerciseId` plus `id`/`createdAt`/`updatedAt`/`deletedAt`, Migration 3), Reihenfolge nach `createdAt`.
- **Verkleinern beim Hinzufügen:** längste Seite höchstens 1600 px, JPEG mit Qualität 0,8 (etwa 0,2–0,4 MB). Die EXIF-Drehung wird übernommen (Dekodieren über ein `<img>`, das sie in allen unterstützten Web-Views anwendet), transparente Flächen werden weiss. Bilder, die der Web-View nicht lesen kann (z.B. HEIC im Android-WebView), werden mit einem Toast gemeldet; die übrigen kommen trotzdem dazu.
- **Hinzufügen ohne neue Abhängigkeit**, über `<input type="file" accept="image/*">`: «Bilder auswählen» (Mehrfachauswahl) und in der App zusätzlich «Foto aufnehmen» (`capture`), weil die Auswahl des Android-WebViews keine Kamera anbietet. Android braucht dafür keine Berechtigung (vorhandener FileProvider). iOS bekommt `NSCameraUsageDescription` und `NSPhotoLibraryUsageDescription`, vorerst nur auf Englisch: Lokalisierte `InfoPlist.strings` bräuchten Änderungen am Xcode-Projekt ohne Mac.
- **Sofort gespeichert,** wie der Text und ohne Verwerfen: Ein gewähltes Bild ist gespeichert, sobald es verkleinert ist. Bis dahin zeigt das Sheet einen Platzhalter. Was das Limit überschreitet, wird übersprungen und per Toast gemeldet.
- **Ansehen:** Die Notiz-Karte (Training, Plan-Detail) zeigt die Bilder als Reihe von Vorschaubildern (44 px) unter dem Text; ohne Text steht «Bilder» an seiner Stelle. Ein Tap öffnet den **Bildbetrachter**: Vollbild, Wischen per Scroll-Snap wie im Trainings-Pager, Zähler «2 / 5», Schliessen. Android-Zurück schliesst ihn.
- **Löschen nur im Betrachter, mit Bestätigung** («Bild löschen?»), und nur wenn er aus dem Sheet geöffnet wurde. Von der Karte aus ist er nur zum Ansehen. Löschen setzt `deletedAt` an der Zeile und entfernt die Datei sofort (privat, Speicher frei).
- **Backup (Schema 3):** Die Tabelle `exercise_note_image` ist im Backup (`since: 3`), dazu der neue Schlüssel `images: { <id>: <JPEG als Base64> }` für jede lebende Zeile. Ein Bild ohne lesbare Datei lässt der Export weg. Die Prüfung verlangt für jede lebende Zeile gültige Base64-Daten. Ein Import ersetzt wie bisher alles: erst die Zeilen in einer Transaktion, danach wird der Bildordner geleert und neu geschrieben. Backups mit Schema 1 oder 2 werden ohne Bilder importiert.

## Umsetzungshinweise
- `ExerciseNotesService` hält die Bilder als Signal-Map (`imagesFor`, `pendingFor`, `hasNote`, `addImages`, `removeImage`). Zeilen ohne Datei lässt er beim Laden aus.
- `NoteImageStore` (core/exercises) kapselt die Dateien: in der App `Capacitor.convertFileSrc`, im Browser Data-URLs. `encodeNoteImage` verkleinert, das Token `NOTE_IMAGE_ENCODER` ersetzen die Unit-Tests (jsdom kann keine Bilder dekodieren). Testhilfe: `provideMemoryNoteImages()` ist in `createTestDatabase()` enthalten.
- Bildbetrachter wie der Bestätigungsdialog: `ImageViewerService` plus `ImageViewerHost` in der App-Shell, gebaut auf dem neuen helm-Dialog.
- Figma hat keinen Frame dafür (nur Code). Vorschau: `/dev/components`.
- Nicht automatisch getestet: Kamera und Fotoauswahl auf Android und iOS. Manuell prüfen: Foto aufnehmen, mehrere aus der Galerie, Hochformat-Foto steht aufrecht.
