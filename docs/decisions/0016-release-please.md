# 0016 – Semantic Versioning und Releases mit release-please

**Datum:** 2026-10-04 · **Status:** entschieden

## Entscheide
- **release-please als GitHub Action** statt semantic-release oder changesets: keine npm-Abhängigkeit, und der Release ist ein bewusster Schritt (Release-PR mergen) statt jeder Merge auf `main`. Der Release-PR zeigt vorher, welche Version und welcher Changelog entstehen.
- **Conventional Commits über den PR-Titel:** PRs werden gesquasht, und der Squash-Commit nimmt immer den PR-Titel (Repo-Einstellung `squash_merge_commit_title = PR_TITLE`; Merge-Commits und Rebase-Merges sind aus). So prüft ein einziger Check («PR title», `amannn/action-semantic-pull-request`) alles, was auf `main` landet. Ein lokaler Commit-Hook (commitlint) wäre eine zusätzliche Abhängigkeit und prüft nicht, was am Ende auf `main` steht.
- **Vor 1.0** erhöhen Breaking Changes nur die Minor-Version (`bump-minor-pre-major`). 1.0.0 wird bewusst mit `Release-As: 1.0.0` gesetzt.
- **Changelog** zeigt nur, was Nutzer betrifft: Features, Bug Fixes, Performance, Reverts. `docs`, `ci`, `chore`, `refactor`, `test`, `build`, `style` lösen keinen Release aus und erscheinen nicht.
- **Eine Quelle für die Version: `package.json`.** `APP_VERSION` wird von release-please mitgezogen (ein Test prüft die Gleichheit), Android liest `package.json` in `build.gradle`, iOS bekommt die Werte in CI über `xcodebuild`-Parameter. Ohne Mac würde niemand `project.pbxproj` aktuell halten.
- **`versionCode` aus der Version statt aus der Run-Nummer** (Major · 1 000 000 + Minor · 1 000 + Patch): deterministisch, auch lokal gleich, und steigt mit jeder Version. Für einen erneuten Store-Upload derselben Version braucht es deshalb ein Patch-Release.
- **Native Builds als `workflow_call` aus dem Release-Workflow:** Tags, die mit `GITHUB_TOKEN` entstehen, starten keine anderen Workflows. Der frühere Trigger `push: tags: v*` hätte nie gefeuert. Die Debug-APK hängt am GitHub-Release.
- **Produktion nur bei Releases:** Die Web-App speichert die Trainingsdaten im Browser, eine fehlerhafte Migration lässt sich serverseitig nicht zurückrollen. Ein Release ist der bewusste Prüfpunkt, und Web, Apps und Changelog zeigen dieselbe Version. Erkannt wird ein Release-Commit daran, dass er die Version in `package.json` ändert (statt am Tag, der parallel zu CI entsteht, oder am Commit-Titel). Weiterhin erst nach grüner CI (0015). Manuell deployt der Workflow den letzten Release erneut, nie einen unveröffentlichten Stand.
- **Staging `/main/` auf dem Preview-Host** zeigt `main` zwischen den Releases. Es teilt die Datenbank mit den PR-Previews, nie mit der Produktion.
