# Blockeditor — Umsetzungsplan (Plan 2)

> **Für ausführende Agenten:** ERFORDERLICHE UNTERFÄHIGKEIT: `superpowers:subagent-driven-development`.
> Schritte benutzen Kästchen (`- [ ]`) zur Nachverfolgung.

**Ziel:** Lucas kann seine Seite selbst bearbeiten — Blöcke einfügen, ziehen, schreiben,
gestalten — ohne eine Zeile Code und ohne mich.

**Architektur:** Alle Inhalte werden zu **Seiten aus Blöcken**. Ein Editor für alles: den
Brief, die Projekte, die Welten. Die öffentliche Seite rendert Blöcke statt Markdown; für die
Auszeichnung *innerhalb* eines Textblocks (fett, kursiv, Links, Türchen) bleibt der vorhandene
Umsetzer zuständig.

**Werkzeuge:** unverändert — HTML, CSS, JavaScript ohne Bibliotheken, Supabase REST, Netlify,
Node 25 nur für die Prüfungen, Chrome DevTools Protocol.

---

## Wie dieser Plan geschrieben ist — und warum anders als Plan 1

Plan 1 enthielt den vollständigen Code. Jeder Fehler darin kostete eine volle Runde:
Umsetzer baut → Prüfer findet → Plan berichtigen → neu beauftragen. So entstanden **fünf
Prüfungen, die nicht fehlschlagen konnten**, dazu toter Code und eine falsche Prüfreihenfolge.
Der Umsetzer hat fast nie etwas falsch gemacht; er hat meine Fehler gefunden.

**Dieser Plan beschreibt Verträge und Abnahmekriterien, keinen fertigen Code.** Der Umsetzer
schreibt die Umsetzung *und* die Prüfungen. Damit fängt seine Selbstprüfung seine eigenen
Fehler, statt meine durchzureichen.

Was aus Plan 1 bleibt, weil es sich bewährt hat:

- **Jede Prüfung muss man einmal absichtlich brechen können.** Wer eine Absicherung baut,
  entfernt sie testweise wieder und zeigt, dass die Prüfung fällt. Ohne diesen Nachweis gilt
  eine Prüfung als nicht vorhanden.
- **Anhalten und fragen ist erwünscht**, sobald eine Vorgabe widersprüchlich oder falsch
  wirkt. Das hat in Plan 1 jedes Mal einen echten Fehler aufgedeckt.
- **Code, den nichts erreichen kann, wird entfernt, nicht kommentiert.** Doppelte Sperren,
  ungelesene Merker, Gestaltung ohne Auslöser.

---

## Globale Vorgaben

- **Kein Inhalt darf verlorengehen oder sich ändern.** Die Texte, Bilder und Videos gehören
  einer echten Person. Der Umzug ist die gefährlichste Stelle dieses Plans — er ist
  ausschließlich additiv, und die alten Tabellen bleiben bis zum Schluss unangetastet stehen.
- **Der geheime Schlüssel** (`service_role` / `sb_secret_…`) gehört in keine Datei unter
  `HOCHLADEN/`. Nur `sb_publishable_…`.
- **Nichts aus `tests/` darf in `HOCHLADEN/` liegen.**
- **Alle Pfade in HTML absolut** (`/assets/…`).
- **Farben, Schriften, Bewegungskurve** kommen aus `site.css` (`--mm-kurve`) und werden
  nirgends erneut fest hingeschrieben.
- **`prefers-reduced-motion`** wird überall respektiert.
- **Zugriffsregeln:** Fremde lesen nur `status = 'published'`, Schreiben nur angemeldet.
  Für jede neue Tabelle gilt dasselbe, und das ist nachzuweisen.
- **Handy-Ansicht ab 520 px prüfen.** Darunter liefert Chrome nur einen Ausschnitt.
- Kommentare und Bezeichner auf Deutsch.
- **Die vier bestehenden Prüfungen müssen durchgehend bestehen:** `pruefe-bestand` 5 ·
  `pruefe-leiste` 28 · `pruefe-brief` 25 · `pruefe-welten` 17.
- Nach jeder Aufgabe wird festgeschrieben.

---

## Aufgabe 1: Datenmodell, Umzug, öffentliche Darstellung

Die riskante Aufgabe. Sie bekommt als einzige einen eigenen Prüfer.

**Vertrag — Datenbank**

Zwei neue Tabellen, additiv. `projects`, `posts` und `settings` bleiben **unverändert
bestehen** und werden in dieser Aufgabe nur gelesen.

- **`seiten`** — `id · slug · typ ('brief' | 'projekt' | 'welt') · titel · untertitel ·
  kunde · jahr · cover_url · cover_pos · video_url · embed_ok · farbe · ist_aktuell ·
  status · sort_order · created_at · updated_at`
- **`bloecke`** — `id · seite_id · typ · inhalt (jsonb) · breite · bewegung · notiz ·
  sort_order · created_at · updated_at`

`breite` ∈ `schmal | normal | randnotiz | voll`, Vorgabe `normal`.
`bewegung` ∈ `keine | einblenden | hochschieben | wachsen | zeilenweise`, Vorgabe `keine`.
`notiz` ist frei und **wird niemals öffentlich ausgeliefert** — das ist nachzuweisen.

**Vertrag — Blockarten** (`bloecke.typ`)

`text · ueberschrift · randnotiz · bild · gif · video · text_mit_bild · code · werkzeug ·
trenner · tuer · abschnitt`

`abschnitt` erzeugt einen Abschnitt in der Zeitleiste und trägt Titel, Art
(`beruflich | persoenlich | kontakt`) und Farbe.

**Vertrag — Umzug**

Ein Skript unter `tests/` (nicht in `HOCHLADEN/`) liest `projects`, `posts` und `settings`
und schreibt daraus `seiten` und `bloecke`. Es zerlegt die vorhandenen Markdown-Texte anhand
der Grammatik, die `assets/shared.js` heute schon versteht.

**Abnahme — und das ist die wichtigste Zeile dieses Plans:**

> Für **jede** vorhandene Zeile gilt: Der aus Blöcken erzeugte Text enthält **jeden
> zusammenhängenden Textabschnitt** und **jede Bild- und Videoadresse**, die der alte
> Markdown-Umsetzer erzeugt hätte. Wortgleich, nicht sinngemäß.

Die Prüfung vergleicht dazu beide Wege gegeneinander: alter Umsetzer auf den Rohtext gegen
neuen Weg über die Blöcke. Fehlt ein Satz, schlägt sie fehl und benennt ihn.

Das Umzugsskript muss **mehrfach ausführbar** sein, ohne Dubletten anzulegen.

**Vertrag — öffentliche Darstellung**

`index.html` und `welt.html` lesen ab jetzt `seiten`/`bloecke`. Die Zeitleiste bekommt ihre
Abschnitte aus den `abschnitt`-Blöcken. Die drei Rückfallstufen bleiben: Datenbank →
Zwischenspeicher → `seed.js`.

**Abnahme:** Die vier bestehenden Prüfungen bestehen unverändert weiter — sie prüfen das
sichtbare Ergebnis, und das darf sich nicht ändern. **Wenn eine davon fehlschlägt, ist Inhalt
verlorengegangen.** Sie sind damit die eigentliche Absicherung dieser Aufgabe.

**Rückweg:** Solange die alten Tabellen stehen, genügt ein Zurücksetzen der beiden HTML-Dateien.
Das ist im Bericht zu bestätigen.

---

## Aufgabe 2: Der Blockeditor

**Vertrag — Bedienung**

Blöcke liegen untereinander. Man fügt sie ein, zieht sie am Griff zum Sortieren und schreibt
direkt hinein. Pro Block: **Breite**, **Bewegung**, **Notiz an Claude**.

Von Notion übernommen — ausdrücklicher Wunsch des Auftraggebers
(*„umso näher du an dieses Notion-Prinzip kommst, umso besser"*):

- `/` öffnet die Blockauswahl
- Griff links zum Ziehen
- Text markieren blendet eine kleine Leiste ein: fett, kursiv, Link, **Türchen**
- Enter erzeugt den nächsten Block, Rücktaste auf leerem Block löscht ihn
- Block duplizieren und löschen
- Rückgängig
- speichert selbst, mit „gespeichert" in der Ecke

**Bewusst nicht gebaut:** Spalten und verschachtelte Blöcke. Sie bröckeln auf dem Handy und
zwingen zum Nachdenken über Layout statt zum Schreiben. Die Breite „Randnotiz" deckt ab,
wofür man in Notion sonst Spalten nimmt. Der vorhandene Block „Text mit Bild daneben" bleibt.

**Vertrag — was erhalten bleibt**

Bild-Upload mit Verkleinerung, **GIFs ohne Verkleinerung** (sonst bleibt nur das erste
Einzelbild), der Bildausschnitt-Regler, die Sicherung aller Tabellen, die Anmeldung.

**Abnahme**

- Ein neuer Block jeder Art lässt sich anlegen, füllen, verschieben, löschen — und ist nach
  dem Neuladen unverändert da.
- **Kein Datenverlust bei Nebenläufigkeit:** Zwei Änderungen kurz hintereinander dürfen sich
  nicht gegenseitig überschreiben. Nachzuweisen.
- **Die Notiz erscheint nirgends im ausgelieferten HTML.** Nachzuweisen.
- Der Editor ist ab 520 px bedienbar.
- Nach dem Speichern zeigt die öffentliche Seite das Geänderte.

---

## Aufgabe 3: Komfort, Anleitung, Spielwiese

**Vertrag — Vorlagen.** „Neues Projekt" legt die passenden Blöcke gleich an.

**Vertrag — Anleitung.** Ein Hilfe-Bereich **im Admin**, nicht auf der Website: welche Blöcke
es gibt, was `/` kann, wie man ein Türchen setzt (`[[Wort|ziel|Titel|Text]]` sichtbar,
`((Wort|ziel|Titel|Text))` geheim), wie eine Abschnittsmarke wirkt. Auf- und zuklappbar;
einmal zugeklappt bleibt sie zu.

Sie liegt im Admin, weil sie eine Anleitung für Lucas ist und kein Inhalt für Besucher. Als
öffentliche Seite müsste man sie verstecken oder archivieren — im Admin stellt sich die Frage
nicht.

**Vertrag — Spielwiese.** Eine Seite mit allen Blockarten als Beispiel, Status „Entwurf",
also für Fremde unsichtbar, jederzeit löschbar.

**Vertrag — Aufräumen.** Erst **nachdem** Aufgabe 1 und 2 nachweislich laufen: die alten
Tabellen abräumen und `seed.js` aus dem neuen Modell neu erzeugen. Vorher eine Sicherung
ziehen und im Bericht bestätigen.

**Abnahme:** Alle vier bestehenden Prüfungen bestehen. Ein Durchgang „neue Welt anlegen,
Blöcke füllen, veröffentlichen, im Brief ein Türchen daraufsetzen, als Fremder aufrufen"
funktioniert von Anfang bis Ende.

---

## Vorgehen

| Aufgabe | Prüfung |
|---|---|
| 1 — Datenmodell, Umzug, Darstellung | **eigener Prüfer** — hier stehen Lucas' Inhalte auf dem Spiel |
| 2 — Blockeditor | Selbstprüfung des Umsetzers, danach prüfe ich selbst nach |
| 3 — Komfort, Anleitung, Spielwiese | Selbstprüfung, danach prüfe ich selbst nach |

Abnahme durch Lucas nach Aufgabe 2 — dann kann er den Editor zum ersten Mal anfassen.

**Geprüft wird unter den echten Adressen** über den Netlify-Nachbau (`tests/server.mjs`),
nicht als Datei. Handy ab 520 px. Als anonymer Besucher ist zu prüfen, dass Entwürfe
unsichtbar bleiben und Notizen nicht ausgeliefert werden.

## Offene Punkte

- Der Brieftext und die beiden Welt-Texte werden weiterhin von Lucas geschrieben.
- Porträtfoto und Showreel fehlen weiterhin.
- Startanimation, Tageszeit-Begrüßung, Dackel und der Schalter für Bewegung sind **Plan 3**.
