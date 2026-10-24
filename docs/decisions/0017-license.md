# 0017 – Lizenz: source-available mit PolyForm Strict

**Datum:** 2026-10-04 · **Status:** entschieden

## Entscheide
- **PolyForm Strict License 1.0.0** (`LICENSE`): Der Code ist öffentlich lesbar und darf nichtkommerziell genutzt werden, aber nicht verändert, weitergegeben oder verkauft werden. Grynd ist damit source-available, nicht Open Source. Eine von Anwälten geschriebene Standardlizenz statt eines eigenen Textes; GitHub erkennt sie nicht automatisch und zeigt «Other».
- **Zusatzerlaubnis für Beiträge** oben in `LICENSE`: Forken und Ändern nur, um einen Beitrag an dieses Repo vorzubereiten. Ohne diese Ausnahme wäre schon ein Pull Request eine verbotene Änderung.
- **Beitragsbedingungen in `CONTRIBUTING.md`** statt eines CLA-Dienstes: Wer einen Beitrag einreicht, gibt dem Maintainer eine unbefristete, unwiderrufliche Lizenz, ihn unter beliebigen Bedingungen zu nutzen, auch kommerziell und unter einer anderen Lizenz. So bleibt eine spätere Lizenzänderung oder ein kommerzielles Angebot möglich, ohne alle Beitragenden fragen zu müssen. Braucht es später einen stärkeren Nachweis, kann CLA Assistant dazukommen.
- **Name und App-Icon** sind von der Lizenz ausgenommen.
- **Abhängigkeiten nur mit permissiven Lizenzen** (MIT, Apache, BSD, ISC, OFL …). Copyleft (GPL, AGPL, LGPL bei statischer Einbindung) verträgt sich nicht mit einer geschlossenen Lizenz. Stand heute: alle Laufzeit-Abhängigkeiten permissiv; `jszip` ist «MIT OR GPL-3.0», genutzt unter MIT.
- **Grenzen:** Eine Lizenz verhindert kein Kopieren, sie ist die rechtliche Grundlage, um dagegen vorzugehen (z.B. DMCA-Takedown bei GitHub oder in den App Stores). Forks auf GitHub selbst erlauben die GitHub-Nutzungsbedingungen bei jedem öffentlichen Repo.
