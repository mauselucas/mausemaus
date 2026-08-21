# mausemaus.com — „Der Brief"

**Entwurfsdokument · 21. August 2026**

---

## 1. Warum überhaupt neu

Die aktuelle Seite ist live und funktioniert. Lucas' Urteil: *„sieht immer noch wie eine
vibecoded Seite aus … sehr generic."* Das stimmt, und der Grund liegt nicht im Feinschliff,
sondern im Aufbau:

> **„Ich wollte mich selbst in dem Portfolio verwirklichen und als Addition meine Projekte zeigen."**

Die live stehende Seite macht das Gegenteil. Sie ist ein Cutter-Portfolio, auf das jemand
Blümchen gestreut hat: Person als Dekoration, Arbeit als Inhalt. Gewollt ist die Umkehrung.

Dazu kommt ein zweiter Satz, der die Form bestimmt:

> **„Ich lebe sehr im Moment und versuche mich abzukapseln von allem, was in der Vergangenheit liegt."**

Ein Portfolio ist per Definition ein Archiv — eine absteigend sortierte Liste von früher.
Das passt nicht. Die neue Seite erzählt statt aufzulisten.

### Was die Person ausmacht (Material, kein Beiwerk)

- **mausemaus** ist kein Fantasiewort: Der Name kommt von Celine und bedeutet „lieb und
  herzlich sein". Das Wort steht im Logo — die Seite sollte sich danach anfühlen, also warm
  und hell, nicht dunkel und kühl wie jetzt.
- **Gänseblümchen** sind Lucas' Lieblingsblume, nicht Zierrat.
- **Dackel und Dinosaurier** — die wiederkehrenden Motive. Formal fast dasselbe Tier:
  langer Körper, kurze Beine.
- **Karten**: Pokémon früher, Balatro heute. Sammeln und Kombinieren als Muster.
- **Werkzeugbauer**: Er baut sich Sachen, die ihm Arbeit abnehmen. Das ist das Interessanteste
  an ihm als Cutter und steht bisher nur als Bewerbungsfloskel auf der Seite.

**Nicht Bestandteil der Seite:** alles, was Lucas im Gespräch über seine persönliche Lage
erzählt hat. Das war Hintergrund für mich, kein Inhalt für die Öffentlichkeit.

---

## 2. Die Grundform: ein Brief

Kein Raster, keine Kacheln, keine Abschnittsüberschriften im Portfolio-Stil. Die Startseite ist
**ein durchgehender Text in Lucas' eigener Stimme** — so wie er Celine zutextet, wenn ihn etwas
begeistert. Videos hängen genau an der Stelle, wo er sie erwähnt. Am Rand stehen Randnotizen.

Gewählt aus sieben Vorschlägen (Zimmer · Sammlung · Jetzt · Sammelalbum · Schreibtisch · Wiese ·
Brief). Begründung des Nutzers:

> *„Ich liebe es, wenn man durch die Seite spielerisch geführt wird, wie mein persönlicher
> optimierter Blog, wo man immer irgendwo Stellen findet mit Randnotizen und vielleicht auch
> auf andere Seiten geführt wird wie so kleine Hintertürchen in ne ganz andere Welt."*

### Inhalt: bestehendes Material, unverändert

**Ich schreibe keinen Brieftext.** Ausdrücklich so entschieden. Die Projekttexte und Bilder,
die heute auf mausemaus.com stehen, werden **1:1 übernommen** — Wortlaut und Bilder bleiben,
sie werden nur in die neue Form gesetzt.

Die erste Fassung des Briefes setzt sich damit so zusammen:

- Einstieg aus der vorhandenen Begrüßung und dem Intro der aktuellen Startseite
- je ein Abschnitt pro Projekt, mit dessen vorhandenem Text, Bild und Video
- Abschluss aus dem vorhandenen Kontaktteil

Das ist noch kein Brief im vollen Sinn — die verbindende Erzählung dazwischen fehlt. Lucas
schreibt sie, wann er mag; bis dahin ist die Seite vollständig und veröffentlichungsfähig.
Der Aufbau ist so gebaut, dass später einfach Textblöcke dazwischengesetzt werden, ohne dass
irgendetwas umgebaut werden muss.

**Nicht ändern:** Wortlaut, Bilder und Videos der bestehenden Projekte.

---

## 3. Die Zeitleiste links

Die eine Stelle, an der die Seite hart benutzerfreundlich sein muss. Ein Producer soll in zwei
Sekunden bei der Arbeit sein, ohne einen Satz gelesen zu haben.

Idee stammt vom Nutzer: eine **Schnittzeitleiste als Navigation**. Nicht als Cutter-Deko —
als Werkzeug.

### Aufbau

- Senkrechte Spur über die volle Höhe. Jeder Abschnitt des Briefes ist ein Segment.
- **Berufliche Abschnitte** tragen die Farbe ihres Projekts, **persönliche** ein blasses
  Grüngrau (`#D6D3C4`). Legende unten. Auch zugeklappt erkennt man an den Farbblöcken,
  wo noch Arbeit kommt.
- **Abspielkopf** (9 px, heller Ring) zeigt die Position, dahinter ein **Sichtfenster-Balken**,
  der anzeigt, wie viel gerade auf den Schirm passt — wie der Sichtbereich in einer Zeitleiste.
- **Timecode** rechts in eigener Spur, rechtsbündig, Ziffern gleicher Breite.
- **Etiketten** neben den Segmenten. Sie sitzen bei ihrem Abschnitt, stoßen sich aber
  gegenseitig ab, sodass sie sich nie berühren; wo eines verschoben werden musste, führt eine
  Haarlinie zurück zu seinem Balken (wie Ortsnamen auf Landkarten).
- **Klick auf Etikett oder Segment** springt zur Stelle.
- **Griff unten rechts** hält die Leiste dauerhaft offen.

### Optisch festgelegt (Stand „VORHER" im Umschalter — bewusst gewählt)

| Punkt | Entscheidung |
|---|---|
| Segmente | **mit Abstand** (~6 px) und abgerundet — *nicht* lückenlos aneinanderstoßend |
| Etiketten | **feste Breite 172 px**, mehrzeilig statt abgeschnitten |
| Führungslinien | **blass** (`#DAD6CA`), ohne Haken zum Etikett |
| Timecode | **freistehend**, ohne Verbindungslinie zum Kopf |
| Aktiver Abschnitt | Fläche hinter dem Etikett, nicht Leuchtring am Balken |
| Kein Wort „BERUFLICH" | Ein farbiger Punkt vor dem Titel sagt dasselbe leiser |

Eine lückenlose Variante mit angeschmiegten Etiketten wurde gebaut und **abgelehnt**.
Nicht erneut vorschlagen.

Der blasse Ton `#D6D3C4` für persönliche Abschnitte ist gegenüber dem ersten Entwurf leicht
kräftiger. Falls er zu präsent wirkt, ist das der Wert, an dem gedreht wird.

### Pacing — festgelegt, vom Nutzer eingestellt

Der Nutzer hat die Kurve als After-Effects-Graph gezeichnet: **oben halten, dann fallen, dann
weich landen.** Aus vier Voreinstellungen hat er „sehr weich" gewählt.

| Wert | Einstellung |
|---|---|
| Halten nach Scrollbeginn | **760 ms** |
| Dauer der Bewegung | **860 ms** |
| Kurve | **`cubic-bezier(.50, 0, .12, 1)`** |
| Halten nachdem die Maus weg ist | **1100 ms** |
| Schwelle (ab wie viel Scrollen) | **120 px** |
| Hochscrollen öffnet sofort wieder | **an** |

**Regeln dahinter:**

- Runterscrollen heißt lesen → Leiste darf zugehen. Hochscrollen heißt navigieren → Leiste
  kommt sofort zurück, ohne Warten.
- **Alles bewegt sich auf derselben Kurve**: Breite, Etiketten, Timecode, Legende, Griff.
  Nicht jedes Teil mit eigenem Timing — genau das lässt Bewegung billig wirken.

### ⚠ Bekannter Fehler, der behoben werden muss

**Beim Klick auf ein Projekt in der Leiste scrollt die Seite nach unten; der Scroll-Zähler
liest das als „runter" und klappt die Leiste zu — obwohl der Mauszeiger noch in der Leiste
steht.**

Behebung: Der Zustand „Zeiger ist in der Leiste" muss mitgeführt werden und das automatische
Zuklappen blockieren, egal woher das Scrollen kommt. Zusätzlich sollte ein durch Klick
ausgelöstes Scrollen gar nicht erst als Nutzer-Scrollen zählen.

---

## 4. Hintertürchen und Welten

Im Fließtext sind einzelne Wörter Türen. Erkennbar an einer zarten Unterlegung und einem
kleinen **❀**. Beim Darüberfahren zeigt sich eine Vorschau: wohin es geht — aber nicht alles.

Hinter jeder Tür liegt eine **Welt**: eine eigene Seite mit **eigener Farbstimmung**, die
deutlich anders aussieht als der Brief. „Blender" ist dunkel und orange, „Mitbringsel" warm
und rosa. Der Reiz liegt darin, dass man vorher nicht weiß, wo man landet.

**Das bestehende Blog-System wird zu diesem Weltensystem.** Kein zweites System, nur ein
neuer Name und je eine Farbstimmung pro Seite.

Zusätzlich beschlossen:

- **Besuchte Türchen sehen anders aus** — wer alle findet, sieht das.
- **Ein unmarkiertes Geheimtürchen**: irgendwo ein Wort ohne ❀, das nur beim zufälligen
  Darüberfahren aufleuchtet.
- **Der Farbwechsel schwappt herein** statt hart umzuschalten — man betritt eine andere Welt,
  nicht eine andere Seite.
- **Der Zeiger wird über Türchen zum Blümchen.**

---

## 5. Bewegung auf der Seite

Alle vom Nutzer abgenickt („die Ideen klingen alle gut").

- **Startanimation:** Der Brief wird beim ersten Laden *geschrieben* statt eingeblendet —
  erst der Name in Tropi, dann setzt der Text ein. **Nur beim ersten Besuch**; danach merkt
  sich der Browser das. Sonst wird genau das die Animation, die man hasst.
- **Der erste Satz kennt die Tageszeit.** Drei, vier Varianten, vom Nutzer selbst geschrieben.
- **Beim zweiten Besuch ein anderer Einstieg** („Schön, dass du nochmal da bist").
- **Der Dackel läuft ab und zu unten durchs Bild** — selten und zufällig, nicht bei jedem
  Besuch, sonst ist er Deko statt Überraschung.
- **Bewegung abschaltbar.** Ein Schalter, und die Systemeinstellung „Bewegung reduzieren"
  wird automatisch respektiert. Kein Kürprogramm: Bei einer Seite mit so viel Bewegung ist
  das Anstand — manchen Menschen wird davon schlecht.

---

## 6. Der Admin: Blockeditor

Gewählt aus vier Möglichkeiten. Ausdrücklicher Wunsch: *„umso näher du an dieses
Notion-Prinzip kommst, umso besser."*

### Aufbau

Blöcke liegen **untereinander**, nicht frei auf einer Fläche. Man fügt sie ein, zieht sie am
Griff zum Sortieren und schreibt direkt hinein.

Von Notion übernommen: **`/` öffnet die Blockauswahl** · **Griff zum Ziehen** · **Text
markieren blendet eine kleine Leiste ein** (fett, kursiv, Link, Türchen) · **Enter erzeugt den
nächsten Block, Rücktaste auf leerem Block löscht ihn** · **duplizieren und löschen** ·
**Vorlagen** („neues Projekt" legt die passenden Blöcke gleich an) · **rückgängig** ·
**speichert selbst**, mit „gespeichert" in der Ecke.

**Bewusst nicht gebaut: Spalten und verschachtelte Blöcke.** Sie bröckeln auf dem Handy und
zwingen zum Nachdenken über Layout statt zum Schreiben. Die Breite „Randnotiz" deckt ab,
wofür man in Notion sonst Spalten nimmt. (Der bestehende Block „Text mit Bild daneben" bleibt,
weil er existiert, mobiltauglich untereinander bricht und sich bewährt hat.)

### Blockarten

| Block | Zweck |
|---|---|
| Text | Absatz im Brief |
| Überschrift | |
| Randnotiz | steht seitlich am Rand, links oder rechts |
| Bild | mit Größe und Bildausschnitt (bestehende Regler übernehmen) |
| GIF | wird nicht komprimiert (sonst bleibt nur das erste Einzelbild übrig) |
| Video | YouTube, Vimeo oder Datei; bei blockierten Videos Cover mit Knopf nach außen |
| Text mit Bild daneben | bestehender Block |
| Code-Block | bestehend, im Claude-Chat-Stil |
| Werkzeug-Nachbau | die bestehende Demo einbetten |
| Trenner | Gänseblümchen |
| **Türchen** | Verweis in eine Welt, mit Vorschautext |
| **Abschnittsmarke** | erzeugt einen Abschnitt in der Zeitleiste: Titel · beruflich/persönlich · Farbe |

### Einstellungen pro Block

1. **Breite** — schmal · normal · Randnotiz · volle Breite
2. **Bewegung** — sanft einblenden · von unten hochschieben · Bild wächst beim Scrollen ·
   Zeile für Zeile · gar nichts
3. **Notiz an Claude** — freies Textfeld, **nur im Admin sichtbar, nie für Besucher**

Die Notiz ist der Kern des Ganzen: Lucas beschreibt in eigenen Worten, was passieren soll
(*„hier soll der Dackel von links reinlaufen und sich einmal schütteln"*), sagt nach dem
Speichern Bescheid, ich gehe die Notizen durch und baue sie ein.

**Zweistufig,** damit er nicht für Kleinigkeiten auf mich warten muss: Die Auswahlliste
schaltet er selbst und sofort. Die Notizen sind für alles darüber hinaus.

### Die Anleitung

Das Einzige, was ich selbst schreibe: eine **Anleitung zu allen Funktionen des Editors** —
welche Blöcke es gibt, was `/` alles kann, wie man ein Türchen setzt, wie man eine
Abschnittsmarke benutzt, mit Beispielen.

**Sie liegt im Admin, nicht auf der Website.** Ein Hilfe-Bereich neben dem Editor, den nur
Lucas sieht. Begründung: Sie ist eine Anleitung für ihn, kein Inhalt für Besucher — als
öffentliche Seite müsste sie versteckt oder archiviert werden, und archivierte Sachen
liegen trotzdem in der Datenbank herum. Im Admin stellt sich die Frage gar nicht erst.

Sie ist jederzeit auf- und zuklappbar; einmal zugeklappt bleibt sie zu. Wegwerfen muss sie
also niemand.

Dazu eine **Spielwiese**: eine Seite mit allen Blockarten als Beispiel, an der man
herumprobieren kann, ohne etwas kaputtzumachen. Steht auf „Entwurf", ist also für Fremde
unsichtbar, und darf gelöscht werden.

---

## 7. Datenmodell

Alles wird zu **Seiten aus Blöcken** — ein Editor für alles.

**`seiten`**
`id · slug · typ ('brief' | 'projekt' | 'welt') · titel · untertitel · kunde · jahr ·
cover_url · video_url · embed_ok · farbe · ist_aktuell · status · sort_order`

**`bloecke`**
`id · seite_id · typ · inhalt (jsonb) · breite · bewegung · notiz · sort_order`

**`settings`** bleibt für Kontaktdaten und globale Schalter.

Der Brief ist eine einzige Seite vom Typ `brief`. Seine Abschnittsmarken erzeugen die
Zeitleiste. Die Leiste listet alle Seiten vom Typ `projekt`.

**Migration:** Die bestehenden Tabellen `projects` und `posts` werden einmalig nach
`seiten`/`bloecke` überführt; die vorhandenen Markdown-Texte werden dabei in Blöcke zerlegt.
**Es geht nichts verloren.** Vor der Migration ein Export aller Tabellen.

Zugriffsregeln wie bisher: Fremde lesen nur `status = 'published'`, Schreiben nur eingeloggt.

---

## 8. Technik

Unverändert, weil es sich bewährt hat: **Netlify** (Ordner hochladen, kein Build-Schritt) +
**Supabase** (Postgres, Anmeldung, Dateien). Saubere Adressen über `_redirects`.
Kontaktformular über Netlify Forms, fest in der HTML-Datei — sonst findet Netlify es nicht.

**Dreistufiger Rückfall bleibt:** Supabase → Zwischenspeicher im Browser → `seed.js`.
Der `seed.js` muss nach jeder größeren Inhaltsänderung neu erzeugt werden, sonst zeigt er
bei einer Störung veraltete Texte.

**Der geheime Schlüssel (`service_role` / `sb_secret_…`) gehört niemals in die Website.**
Im Browser lebt ausschließlich der veröffentlichbare Schlüssel.

**Versionierung:** Der Ordner ist seit dem 21. August 2026 ein lokales Git-Repository.
Der Stand vor dem Umbau ist als erster Stand festgehalten. Rein lokal, kein GitHub, kein
Konto nötig — es ist ein Sicherheitsnetz: Jeder Bauschritt wird festgehalten, und wenn etwas
schiefgeht, lässt sich jederzeit auf einen früheren Stand zurückgehen. Lucas muss damit
nichts tun; das übernehme ich.

---

## 9. Qualitätsmaßstab

Jeder Teil bekommt einen Feinschliff-Durchgang. Das ist die eigentliche Antwort auf
„sieht vibecoded aus". Geprüft wird gegen fünf Fragen:

1. **Rhythmus** — sind die Abstände gleichmäßig? Ungleiche liest das Auge als Versehen.
2. **Hierarchie** — sieht man, was wichtig ist und was leise?
3. **Ausrichtung** — stehen Dinge auf gemeinsamen unsichtbaren Linien?
4. **Gewicht** — ist ein Element so auffällig, wie es wichtig ist?
5. **Lärm** — steht etwas viermal da, wo einmal reichen würde?

---

## 10. Reihenfolge

| Schritt | Ergebnis | Abnahme |
|---|---|---|
| 1 | Datenmodell + Migration, Sicherung vorher | — |
| 2 | Der Brief öffentlich: Zeitleiste, Türchen, Pacing, Daten aus der Datenbank | **ja** |
| 3 | Welten und Projektseiten mit Farbstimmungen | — |
| 4 | Blockeditor im Admin | **ja** |
| 5 | Startanimation und die Spielereien aus Abschnitt 5 | — |
| 6 | Feinschliff-Durchgang über alles, Handy-Ansicht, `seed.js` neu | — |
| 7 | Hochladen | — |

**Früh hochladen ist ausdrücklich erwünscht** („auf mein Portfolio ist gerade eh nicht so viel
Traffic"). Sobald Schritt 2 und 3 stehen, geht die Seite live; Editor und Spielereien kommen
danach im laufenden Betrieb dazu. Das senkt das Risiko, weil jeder Schritt einzeln
auf der echten Adresse geprüft wird, statt alles auf einmal.

**Geprüft wird unter den echten Adressen** über den Netlify-Nachbau-Server (`/`, `/welt/slug`),
nicht nur im Wurzelverzeichnis — genau dort ist der Pfad-Fehler von neulich aufgetreten.
Handy-Ansicht mindestens 520 px breit prüfen (darunter liefert Chrome nur einen Ausschnitt).
Als anonymer Besucher prüfen, dass Entwürfe unsichtbar bleiben.

---

## 11. Offene Punkte

- **Die verbindende Erzählung im Brief** schreibt Lucas selbst, wann er mag. Bis dahin
  trägt die Seite die bestehenden Projekttexte.
- **Welche Welten es geben soll.** Bisher gedacht: Blender · Mitbringsel von Celine ·
  Werkzeuge. Steht nicht fest.
- **Abschnittslängen im Brief.** Sind einzelne Abschnitte sehr lang und andere sehr kurz,
  müssen viele Etiketten verschoben werden und die Leiste wird unruhig. Beim Schreiben
  etwas ausgleichen.
- **Porträtfoto und Showreel** fehlen weiterhin.
- **Zeitleiste auf dem Handy** — dort ist kein Platz für eine Spalte. Muss eigens
  entworfen werden; noch nicht entschieden.
- **Netlify-Formularbenachrichtigung** einmalig einschalten.
