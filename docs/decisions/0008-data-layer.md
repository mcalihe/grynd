# 0008 – Datenschicht (M2)

**Datum:** 2026-09-30 · **Status:** entschieden

## Entscheide
- **Treiber-Abstraktion `SqlDriver`** (`execute`, `run`, `query`, `transaction`). In der App läuft `@capacitor-community/sqlite`: nativ auf Android/iOS, im Browser über jeep-sqlite (sql.js + IndexedDB, nach jedem Schreibvorgang `saveToStore`). Die Unit-Tests laufen mit `sql.js` in-memory. Migrationen und Repository-SQL sind in beiden Umgebungen identisch.
- **sql.js ist auf 1.11.0 gepinnt** (pnpm-Override). jeep-sqlite 2.8.0 bündelt das JS von sql.js 1.11.0, eine neuere `sql-wasm.wasm` lässt sich damit nicht linken (`LinkError`). Vor einem Update zuerst prüfen, gegen welche sql.js-Version jeep-sqlite gebaut ist.
- **Migrationen** stehen versioniert in `src/app/core/db/migrations/`, der Stand liegt in `PRAGMA user_version`. Jede Migration läuft in einer eigenen Transaktion. Veröffentlichte Migrationen werden nie geändert.
- **Spalten** heißen wie in `plan.md` §6 (camelCase). Listen werden als JSON-Text gespeichert, Booleans als 0/1, Zeitstempel als ISO-8601-UTC-Text. Fremdschlüssel sind aktiv. Ein partieller Unique-Index erlaubt höchstens eine aktive Session.
- **`session_exercise` kopiert `repMin`, `repMax` und `restSeconds`** aus dem Plan, damit spätere Plan-Änderungen weder laufende noch vergangene Trainings verändern.
- **UUIDv7 selbst implementiert** (RFC 9562, Zähler pro Millisekunde, streng steigend). Es gibt keine Abhängigkeit dafür.
- **Repositories:** `BaseRepository` übernimmt IDs, Zeitstempel und Soft Delete (Lesen blendet gelöschte Zeilen aus). Die fachlichen Repositories ergänzen nur ihre Abfragen.

## Übungskatalog
- **Quelle:** [free-exercise-db](https://github.com/yuhonas/free-exercise-db), Lizenz **The Unlicense** (Public Domain), gepinnt auf Commit `f00c92c7dcf1`. Alle 876 Übungen werden übernommen, inklusive Dehn-, Cardio- und Plyometrie-Übungen.
- **Stabile IDs:** Jede Übung bekommt einmalig eine UUIDv7, die bei jedem erneuten Import erhalten bleibt. Pläne und Backups verweisen deshalb geräteübergreifend auf dieselbe Übung.
- **Deutsche Namen** hat Claude einmalig übersetzt (`scripts/data/exercise-names.de.json`). Korrekturen gehören in diese Datei, danach `pnpm catalog:import`.
- **`muscleGroup`** wird aus dem ersten Primärmuskel abgeleitet (Brust, Rücken, Schultern, Beine, Po, Arme, Core).
- **Bilder:** Pro Übung wird das erste Bild als 160-px-WebP gebündelt (4,2 MB, offline verfügbar). 3 Übungen haben kein Bild und bekommen in der UI einen Platzhalter.
- **Laden:** `public/data/exercises.json` wird nur geholt, wenn sich `CATALOG_VERSION` (vom Import-Skript generiert: Quell-Commit + Hash des Inhalts, damit auch korrigierte Namen ausgeliefert werden) von der gespeicherten `meta.catalogVersion` unterscheidet. Das Einspielen ist ein Upsert nach ID. Übungen, die aus dem Katalog verschwinden, werden per Soft Delete ausgeblendet.
