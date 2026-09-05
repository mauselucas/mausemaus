# Arbeitsregeln für dieses Projekt

Diese Datei gilt für jede Sitzung. Sie sagt, WIE hier gearbeitet wird —
was das Projekt IST, steht in `PROJEKTSTAND.md`.

## Das Wichtigste zuerst

Lucas kann nicht programmieren. Zwei Folgen:

1. Alles Inhaltliche muss über `/admin.html` änderbar sein. Was nur im Code
   änderbar wäre, ist ein Konstruktionsfehler.
2. Er kann nicht gegenlesen, ob eine Änderung stimmt. Die Prüfungen sind sein
   Ersatz dafür. Eine Änderung ohne grüne Prüfung ist nicht fertig.

## Prüfungen: drei Stufen, und die richtige wählen

```
node tests/schnell.mjs            # Sekunden — nur Logik, KEIN Browser
node tests/schnell.mjs --mittel   # ~1 Min — alles mit Chrome
node tests/voll.mjs               # alles, vor dem Hochladen
```

**Welche wann:**

| Was geändert wurde | Welcher Lauf |
|---|---|
| Blockmodell, Vorlagen, Markdown-Umsetzung | `schnell` |
| **Alles am Aussehen oder Verhalten** | `--mittel` |
| Bewegung/Schriften angefasst, oder vor dem Hochladen | `voll` |

Das ist die wichtigste Zeile hier: **`schnell` allein sagt bei einer
Gestaltungsänderung NICHTS aus.** Die sieben schnellen Prüfungen fassen keinen
Browser an. Wer einen Knopf umbaut und dann nur `schnell` laufen lässt, hat
nichts geprüft. Dafür ist `--mittel` da.

Draußen bleiben bei `--mittel` nur vier: drei starten zusätzlich Firefox,
eine misst die echte Seite über das Netz.

Läuft eine einzelne Prüfung rot, diese eine einzeln aufrufen statt den ganzen
Satz zu wiederholen:

```
node tests/pruefe-sprache.mjs
```

Neue Prüfung geschrieben? Nichts eintragen — `schnell.mjs` teilt selbst ein,
indem es den Quelltext liest.

### Prüfungen schreiben: auf Zustände warten, nicht auf die Uhr

`await s.warte(500)` ist fast immer falsch. Unter Last reicht dieselbe Zahl
plötzlich nicht mehr, die Prüfung wird ohne Grund rot, und eine Prüfung, die
ohne Grund rot wird, wird ignoriert. Stattdessen:

- `s.bisWahr(ausdruck, frist)` — **wirft** bei Fristablauf. Nur für
  Voraussetzungen („die Seite ist geladen"). Ein Wurf reißt die ganze
  Prüfdatei mit, und dann sieht sie aus wie „keine Fehler".
- `wirdWahr(...)` (in `pruefe-sprache.mjs`) — liefert `false` statt zu werfen.
  **Für alles, was auch scheitern darf.**

`warte()` ist nur dann richtig, wenn wirklich Zeit vergehen muss — etwa das
Ende einer 600-ms-Animation. Das ist kein Zustand, den man abfragen kann.

## Erst der Plan, dann der Code

Bei allem, was mehr als eine Datei berührt: zuerst in zwei, drei Sätzen sagen,
welche Dateien angefasst werden und warum, und auf Zustimmung warten. Ein
falscher Plan kostet eine Rückfrage, ein falscher Umbau kostet eine halbe
Stunde.

Ausgenommen: Tippfehler, einzelne Werte, Sachen die Lucas genau so benannt hat.

## Nicht mehr lesen als nötig

Nennt Lucas Dateien, dann nur die und was sie direkt brauchen. Das Repo hat
gewachsene Struktur; ein Durchsuchen auf Verdacht kostet viel und bringt
selten etwas. Fehlt Kontext: fragen, statt breit zu suchen.

Die 29 Fallstricke in `PROJEKTSTAND.md` sind ein Nachschlagewerk, keine
Pflichtlektüre. Beim Anfassen von Animationen, Schriften, Grid oder Prüfungen
lohnt der Blick — sonst nicht.

## Der Ton in der Antwort

Deutsch, direkt, ohne Fachjargon-Nebel. Fachbegriffe erklären, nicht
voraussetzen. Wenn etwas nicht geht oder eine schlechte Idee ist: sagen,
nicht umsetzen und hoffen.

Behauptungen über Browser, Hoster oder Verhalten gehören gemessen, nicht
geschätzt — siehe Fallstrick 13 und 27. Lieber „weiß ich nicht, messe ich"
als eine plausible Zahl.

## Wiederkehrende Fallen in diesem Projekt

- **Pfade immer absolut** (`/assets/…`). Relative brechen unter `/welt/…`.
- **Neue Spalte auf `bloecke`?** Dann zwingend `grant select (spalte) … to anon`
  UND eintragen in `BLOCK_SPALTEN` in `assets/db.js` UND in
  `tests/hochladen.mjs`. Sonst fällt Englisch lautlos aus.
- **`bewegung.css` nie ohne `bewegung-nachbau.css`** — der Nachbau wird erzeugt:
  `node tests/nachbau.mjs --schreiben`.
- **Englisch ist eine Ergänzung.** Fehlt eine Übersetzung, steht Deutsch da —
  nie eine Lücke. Für einen deutschen Besucher darf sich kein Byte ändern.
- **Kein Bauwerkzeug.** Veröffentlicht wird der Inhalt von `HOCHLADEN/`.

## Hochladen

```
node tests/hochladen.mjs
```

Macht Versionsstempel, vorgebaute Welten, `seed.js`, `sitemap.xml` in einem
Rutsch. Ist die Datenbank nicht erreichbar, bricht er ab und lässt alles
unangetastet. Danach committen und pushen — GitHub Pages veröffentlicht selbst.

Diesen Befehl nie ungefragt ausführen.

## Tokens sparen: das meiste liegt nicht bei den Prüfungen

Gemessen an einer Sitzung vom 05.09.2026: Die Prüfungen liefen im
Hintergrund und kosteten fast nichts. Teuer waren drei Gewohnheiten.

1. **Nie eine Ausgabedatei in Schleife lesen.** Ein Hintergrundbefehl meldet
   sich von selbst, wenn er fertig ist. Alle zehn Sekunden nachzusehen hat an
   einem Abend Zehntausende Tokens gekostet und nichts beschleunigt. Lange
   Läufe im Hintergrund starten, dann etwas anderes tun oder antworten — die
   Meldung kommt.
2. **Bildschirmfotos nur zum Abliefern.** Ein Bild bleibt für immer im Verlauf
   und wird bei JEDER weiteren Anfrage erneut mitgelesen. Zum Nachsehen wird
   gemessen (`getBoundingClientRect`, `getComputedStyle`) — das ist ohnehin
   verlässlicher. Zum Zeigen: eine PNG-Datei schreiben und schicken.
3. **Nie ganze Dateien lesen, wenn zwanzig Zeilen reichen.** `grep -n`,
   `sed -n 'X,Yp'`. Ausgaben filtern (`| grep -E "FEHL|bestanden"`).

Dazu: aufräumen. Kopflose Browser überleben abgebrochene Läufe und blockieren
den nächsten. Wenn eine Prüfung ohne erkennbaren Grund hängt:

```
pkill -f "tests/pruefe"; pkill -f headless
```

## Eine Aufgabe, eine Sitzung

Ist eine Aufgabe fertig, ist die Sitzung fertig. Nicht die nächste Baustelle
im selben Verlauf anfangen — der mitgeschleppte Kontext ist das, was hier
teuer ist.
