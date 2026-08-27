# mausemaus.com — Projektstand

Stand: 27.08.2026 · Branch `brief-umbau` · Diese Datei ist die Übergabe.
Sie gehört **nicht** in den Upload-Ordner.

## Vor JEDEM Hochladen: ein Befehl

```bash
node tests/hochladen.mjs
```

Der macht alles Noetige in einem Rutsch: Versionsstempel setzen, die
Teilen-Vorschau der Welten vorbauen, `_redirects`, `seed.js` und
`sitemap.xml` neu schreiben und jede Welt zusätzlich unter `blog/` ablegen.
Danach committen und pushen — GitHub Pages veröffentlicht von selbst. (Er löst
den früheren `tests/stempel.mjs` ab, der weiterhin existiert und von ihm
mitbenutzt wird.)

Ist die Datenbank gerade nicht erreichbar, bricht er ab und laesst
**alles unangetastet** — lieber ein alter Stand als ein halber.

> **Ein Haken, den man kennen muss:** Aenderst du danach etwas nur im
> Admin, ohne neu hochzuladen, bleibt die **Teilen-Vorschau** (das Bild,
> das WhatsApp und LinkedIn zeigen) auf dem alten Stand. Die Seite selbst
> ist sofort aktuell — die kommt weiter live aus der Datenbank.

## Was die Seite ist

Portfolio von Lucas Schönwald (Video Editor & Motion Designer, Köln).
Statische Seiten auf **GitHub Pages**, Inhalte aus **Supabase**. Kein
Bauwerkzeug — veröffentlicht wird der Inhalt des Ordners `HOCHLADEN`.

**Umzug von Netlify (August 2026).** Netlifys Abrechnungsmodell war der Grund.
Drei Dinge sind dabei weggefallen und mussten ersetzt werden:

1. **`_redirects` wirkt nicht mehr.** Die Datei liegt weiter im Ordner, ist auf
   GitHub Pages aber wirkungslos. Ersatz: GitHub Pages liefert `<name>.html`
   von sich aus unter `/<name>` aus, und `tests/hochladen.mjs` schreibt jede
   Welt doppelt — nach `welt/<slug>.html` und `blog/<slug>.html` —, damit auch
   die alte Adressform weiter funktioniert.
2. **`_headers` wirkt nicht mehr.** Keine eigenen Cache- und Sicherheits-Header
   mehr. GitHub Pages setzt `max-age=600` und liefert ETags; praktisch heißt
   das eine kurze Rückfrage statt eines vollen Downloads. Verschmerzbar.
3. **Netlify Forms ist weg.** Das Anfrageformular läuft jetzt über Formspree,
   siehe unten.

**Wichtig:** Lucas kann nicht programmieren. Alles Inhaltliche muss über
`/admin.html` selbst änderbar sein. Wenn etwas nur im Code änderbar wäre, ist
das ein Konstruktionsfehler.

## Der Umbau (das ist neu seit dem 21.08.)

Die alte **Kachel-Startseite** mit `/blog` ist weg. Die Seite ist jetzt ein
durchgehender **Brief**: eine schmale Spalte, die man von oben nach unten
liest. Einzelne Projekte liegen dahinter als **Welten** — eigene Seiten, die
sich über „Türchen" im Brief öffnen.

Damit hängt zusammen:

- **Blockeditor.** Inhalte sind keine Markdown-Textfelder mehr, sondern eine
  Liste echter **Blöcke** (`text`, `ueberschrift`, `bild`, `gif`, `video`,
  `code`, `werkzeug`, `randnotiz`, `trenner`, `tuer`, `abschnitt`, `kasten`,
  `zitat`). Markdown, das Lucas einfügt, wird beim Einfügen automatisch in
  Blöcke zerlegt.
- **Deko-Blumen** hängen an Ankern im Text statt in einem Layer über der Seite.
- **Scroll-Animationen**: alles blendet sich am Scrollstand ein.
  ⚠️ **Hier ist ein offener Fehler — siehe unten.**

## Adressen

| Adresse | Datei | Inhalt |
|---|---|---|
| `/` | index.html | Der Brief (Startseite) |
| `/welt/<slug>` | welt.html | Eine Welt (einzelnes Projekt) |
| `/blog/<slug>` | welt.html | Alte Adressen, bleiben gültig |
| `/admin.html` | admin.html | Verwaltung (Login nötig) |

Umgeschrieben über `_redirects`. **Alle Dateiverweise müssen absolut sein**
(`/assets/…`) — relative Pfade brechen unter `/welt/…`.

Für jede veröffentlichte Welt liegt zusätzlich eine **vorgebaute Fassung**
unter `HOCHLADEN/welt/<slug>.html`, und `_redirects` bekommt dafür eine
ausdrückliche Zeile ÜBER der Sammelregel. Grund: `welt.html` baut ihren
Inhalt erst im Browser zusammen — im Quelltext steht nur ein leeres `<div>`.
Google führt JavaScript aus, WhatsApp, LinkedIn, Slack und Twitter **nicht**.
Ohne die vorgebaute Fassung zeigte jede verschickte Projektadresse nur das
allgemeine `og-bild.jpg`. Erzeugt von `tests/hochladen.mjs`; unbekannte Slugs
fallen weiterhin auf die Sammelregel zurück.

## Supabase

Projekt `mqkggwvcositmpemtqot`, Zugangsdaten in `assets/config.js` (öffentlicher
Schlüssel, das ist so vorgesehen). Zugriffsschutz über RLS: Fremde lesen nur
`status = 'published'`, Schreiben nur eingeloggt.

- **`seiten`** — Brief und Welten. `typ` (`brief` | `welt` | `projekt`), `slug`,
  `titel`, `status`, `sort_order`. Der Brief ist die eine Zeile mit
  `typ=brief, slug=brief`.
- **`bloecke`** — die Inhalte, an einer Seite hängend.
  `id, seite_id, typ, inhalt, breite, sort_order, created_at, updated_at`
  ⚠️ Die Spalte **`notiz`** ist für `anon` per REVOKE gesperrt. Deshalb steht in
  `db.js` eine **ausgeschriebene Spaltenliste** (`BLOCK_SPALTEN`) statt
  `select=*` — sonst scheitert die Abfrage mit einem Rechte-Fehler. Das ist
  Teil des Vertrags, nicht Zierde.
  ⚠️ Die Spalte `bewegung` wird noch mitgelesen, ist aber **funktionslos**:
  Seit `24e3df0` animiert die Seite selbst (siehe `bewegung.css`).
- **`settings`** — eine Zeile mit den Rahmen-Inhalten (Schlagzeile, Infozeile,
  Kundenliste, Profil, Werkzeuge, Kontakt)
- **`media`** — hochgeladene Bilder
- **`projects`, `posts`** — Reste des alten Modells, nur noch im Admin

## Dateien

```
HOCHLADEN/
  index.html   welt.html   admin.html   404.html   _redirects   robots.txt
  favicon.svg  apple-touch-icon.png  og-bild.jpg
  assets/
    fonts.css      Schriften (Tropi, Space Grotesk, Space Mono) — 171 kB
    site.css       Farben, Grundlagen, Detail-Fenster
    brief.css      Der Brief: Scroll-Container, Spalte, Typografie
    welt.css       Eine Welt
    leiste.css     Die Leiste neben dem Brief
    blumen.css     Deko-Blumen
    bewegung.css   Scroll-Animationen (Chrome, Safari) — rein CSS
    bewegung-nachbau.css  ERZEUGT aus bewegung.css, nur fuers Polyfill
    scroll-timeline.js    Polyfill flackr/scroll-timeline 1.1.0 (Apache-2.0)
    inhalt.css     Blöcke im Fließtext
    admin.css

    config.js      Supabase-Adresse und öffentlicher Schlüssel
    db.js          Laden mit Zwischenspeicher + Rückfall auf seed.js
    seed.js        Notfall-Daten (aus der Datenbank erzeugt, Stand 22.08.2026)
    shared.js      Markdown-Renderer + SVG-Formen — von Seite UND Admin genutzt
    block-modell.js  Die Blockarten, ihre Felder und Vorgabewerte
    bloecke.js     Blöcke → HTML (auf der Seite)
    blockeditor.js Blöcke bearbeiten (im Admin)
    inhalt.js      Aufbau einer Welt
    brief.js       Aufbau des Briefs
    leiste.js      Die Leiste
    blumen.js      Verteilt die Deko-Blumen an Ankern
    tueren.js      Türchen: Brief → Welt
    site.js        Detail-Fenster
    demo-race.js   Werkzeug-Nachbildung (macOS-Stil)
    anleitung.js   Hilfetexte im Admin
    admin.js       Verwaltung
docs/
  admin-uebergabe.md                    Was Lucas im Admin tun kann
  scroll-animationen-fuer-ox-alpha.md   Fehlerbericht + Loesung, siehe unten
  designfibel.html
tests/                                  467 Prüfungen, alle grün
  nachbau.mjs    erzeugt bewegung-nachbau.css
  firefox.mjs    Firefox fernsteuern, ohne geckodriver
```

## Markdown-Dialekt (in `shared.js`)

Wird noch gebraucht: für `text`-Blöcke und beim Zerlegen eingefügter Texte.

`## Überschrift` · `---` (Trennstrich mit Blume) · `**fett**` · `*kursiv*` ·
`- Liste` · `> Zitat` · `[Text](adresse)` · `![Text](bild.jpg){klein|mittel}` ·
YouTube-Link allein auf einer Zeile → eingebettetes Video ·
` ```sprache ` → Code-Block · `::demo kennung` → interaktive Einlage ·
`::: … :::` → Textblock mit Bildern daneben

## Die Scroll-Animationen — gelöst am 27.08.2026

Lucas sah keine Animation. Ursache: **sein Firefox 154 kann Scroll-Animationen
nicht** (`CSS.supports('animation-timeline: view()')` → `false`). Der
`@supports`-Block griff korrekt nicht, die Seite blieb statisch — wie entworfen.
Kein Fehler im Code. Die Angabe „Firefox vor 144" im Kommentar war frei erfunden
und hat die Suche zwei Runden lang fehlgeleitet.

Behoben mit einem Polyfill (`flackr/scroll-timeline` 1.1.0), das **nur** in
Engines ohne eigene Unterstützung nachgeladen wird. Chrome und Safari holen null
Byte und laufen unverändert in reinem CSS auf dem Compositor.

**Der Fallstrick dabei:** Der Parser des Polyfills liest den Rohtext der
Stylesheets und steigt **weder in `@supports` noch in `@media`** hinab. Der
naheliegende Einbau wirkt deshalb nicht — gemessen. Darum gibt es dieselben
Regeln zweimal:

| Datei | Für wen | Form |
|---|---|---|
| `assets/bewegung.css` | Chrome, Safari | `@supports` + `@media`, reines CSS |
| `assets/bewegung-nachbau.css` | Firefox (Polyfill) | flach, jede Regel mit `html.mm-bewegung` davor |

Die zweite Datei wird aus der ersten **erzeugt** und nicht von Hand gepflegt:

```bash
node tests/nachbau.mjs --schreiben
```

`tests/pruefe-nachbau.mjs` schlägt Alarm, sobald beide auseinanderlaufen.

**Die Sicherheitszusage steht unverändert:** Der Nachbau greift nur, wenn
`<html>` die Klasse `mm-bewegung` trägt — gesetzt erst, wenn das Polyfill
wirklich lädt und „Bewegung reduzieren" aus ist. Kein JavaScript → keine Klasse
→ keine Regel → Seite statisch und **vollständig sichtbar**. Per Gegenbeweis
nachgewiesen.

Der ganze Hergang mit allen Messwerten steht in
[`docs/scroll-animationen-fuer-ox-alpha.md`](docs/scroll-animationen-fuer-ox-alpha.md).

## Weitere offene Punkte

- **Formular:** läuft über Formspree (`https://formspree.io/f/xljerkoz`).
  Der kostenlose Tarif deckt 50 Einsendungen im Monat. Geprüft von
  `tests/pruefe-formular.mjs` — dieser Test schickt bewusst **nie** eine echte
  Anfrage ab, sondern ersetzt vorher `window.fetch`.
- **Porträtfoto und Showreel-Link** fehlen — im Admin unter „Startseite"
  nachtragbar.
- **Die Welten** enthalten Platzhaltertexte, die Lucas selbst schreibt.
- `bewegung`-Spalte in `bloecke` ist funktionslos und könnte irgendwann weg.
- **Bildbeschreibungen fehlen noch überall.** Der Bild-Block hat jetzt ZWEI
  Felder — „Bildunterschrift" (sichtbar) und „Beschreibung" (unsichtbar, für
  Blinde und Google). Die Beschreibungen muss Lucas im Admin nachtragen; das
  ist Textarbeit, keine Programmierarbeit.
- **Die zwei Welten haben kein Coverbild.** Für die Teilen-Vorschau nimmt
  `hochladen.mjs` ersatzweise das erste Bild aus dem Inhalt — ein richtiges
  Coverbild im Admin wäre besser. Bei „Wie ich die Grafik-Pipeline …" gibt es
  gar kein Bild, dort erscheint das allgemeine `og-bild.jpg`.
- **Kein Türchen hat Vorschautext.** Alle `data-titel`/`data-text` sind leer,
  die Hover-Vorschau erscheint deshalb derzeit für niemanden. Im Admin über
  `[[Wort|ziel|Titel|Vorschautext]]` zu füllen.

## Besucherstatistik

**GoatCounter**, Konto `mauselucas` — eingebaut in `index.html` und
`welt.html`, ausdrücklich NICHT in `admin.html` (Lucas' eigene Arbeit im
Editor gehört nicht in die Besucherzahlen).

```html
<script data-goatcounter="https://mauselucas.goatcounter.com/count"
        async src="//gc.zgo.at/count.js"></script>
```

Keine Cookies, keine personenbezogenen Daten, nichts, was über Seiten hinweg
wiedererkennt — deshalb **kein Einwilligungsbanner nötig**. Das Skript trägt
`async` und steht ganz am Ende: fällt der Dienst aus oder blockt ihn ein
Adblocker, merkt die Seite davon nichts.

Zahlen unter <https://mauselucas.goatcounter.com>.

> **Auf dem Testserver zählt es absichtlich nicht.** GoatCounters eigener
> Filter meldet auf `localhost`/`127.0.0.1` „localhost" und schickt nichts.
> Gemessen — das ist kein Fehler in der Einrichtung. Die Zahlen fangen erst
> an zu laufen, wenn die Seite live auf mausemaus.com steht.

## Gelernte Fallstricke (nicht wiederholen)

1. **`[hidden]` wird von eigenen `display`-Regeln ausgehebelt.** Global gelöst in
   `site.css`. Trat zweimal auf (Login-Formular, Showreel-Knopf).
2. **Relative Pfade brechen unter `/welt/…`** — der Browser löst gegen `/welt/`
   auf. Immer absolut schreiben. Der Renderer korrigiert Bildpfade inzwischen
   selbst.
3. **Immer an den echten Adressen testen**, nicht die Datei im
   Wurzelverzeichnis. Dafür gibt es `tests/server.mjs`.
4. **Chrome im Kopflos-Betrieb erzwingt ~500 px Mindestbreite** — schmalere
   Screenshots zeigen nur einen Ausschnitt und sehen nach Fehler aus.
5. **View Transitions laufen kopflos nicht** (kein Compositor). Das
   Detail-Fenster scheint dort kaputt, ist es aber nicht — mit
   `--force-prefers-reduced-motion` gegenprüfen.
6. **CSS-Grid: Rasterfelder schrumpfen nicht unter ihre Inhaltsbreite.** Ohne
   `min-width: 0` sprengen Eingabefelder das Raster. Trat zweimal auf.
7. **Pythons `str.replace` ersetzt ALLE Vorkommen** — beim Patchen immer mit
   Trefferzählung arbeiten.
8. **GIFs nicht durchs Canvas schicken** — sonst bleibt nur das erste Einzelbild.
9. **`overflow-x: clip` neben `overflow-y: auto` macht der Browser stillschweigend
   zu `hidden`:** kein Rollbalken, aber weiter ein Scrollbereich. Deshalb der
   eigene Kasten `.br-rand`, dessen y-Achse `visible` bleibt.
10. **Ein absolut positioniertes Kind sucht seinen Bezugsrahmen beim nächsten
    POSITIONIERTEN Vorfahren.** Ohne `position:relative` auf `.br-scroller` zog
    das versteckte Spamfallen-Feld das ganze Fenster auf — zwei Rollbalken.
11. **Die `animation`-Kurzschreibweise setzt `animation-timeline` und
    `animation-range` zurück.** Beide müssen DANACH stehen.
12. **Drei Zahlen hängen zusammen und dürfen nicht auseinanderlaufen:**
    `längster Animationsbereich (340px) < Auslauf der Spalte (380px) < halbe
    Bildhöhe`. Siehe `bewegung.css`, `brief.css:27`, `welt.css:19`.
13. **Behauptungen über Browser gehören datiert und gemessen.** „Firefox vor
    144" stand als Tatsache im Kommentar, war frei erfunden und hat eine ganze
    Fehlersuche fehlgeleitet. Verlässlich ist nur die Abfrage zur Laufzeit.
14. **Nur in Chrome zu messen ist keine Prüfung.** Der Fehler wohnte in dem
    einen Browser, den keine Prüfung kannte. Dafür gibt es jetzt
    `tests/firefox.mjs`.
15. **Der Polyfill-Parser sieht nicht in `@supports` und `@media` hinein.**
    Regeln in einem At-Block erreichen ihn nie — deshalb der flache Nachbau.
16. **Beim Messen von Scroll-Ständen absolute Werte anfahren.** Relativ
    gerechnete Ziele verschieben sich zwischen zwei Messungen, sobald ein Bild
    nachlädt. Genau daran ist der Rückwärtstest zuerst falsch gescheitert —
    und `scroll-behavior: smooth` muss man dabei abschalten, sonst misst man
    mitten im Gleiten.
17. **Eine Prüfung kann grün sein und trotzdem das Falsche messen.** Die erste
    Animationsfassung lief rechnerisch einwandfrei — im untersten Bildviertel,
    wo niemand hinsieht. Gemessen wurde OB sich etwas bewegt, nicht WO.
    Deshalb: jede Prüfung einmal absichtlich brechen („Gegenbeweis").
18. **`indexOf` liefert −1, und −1 ist kleiner als alles.** Eine Prüfung
    lautete `kopf.indexOf(a) < kopf.indexOf(b)` und war grün, auch als `a`
    ganz fehlte. Gefunden hat das nicht der Verstand, sondern der
    Sabotage-Durchlauf aus Punkt 17 — die Prüfung wurde als einzige nicht
    rot. Erst prüfen, DASS etwas da ist, dann erst wo.
19. **Feste `width`/`height` am Bild brauchen zwingend `height:auto` im CSS.**
    Sonst gilt für die Breite das Stylesheet und für die Höhe das Attribut:
    Bilder werden gestaucht. Gemessen: 0,56:1 statt 1,78:1 — fast dreimal zu
    hoch. `welt.css` hatte `height:auto`, `brief.css` und `site.css` nicht.
20. **`opacity:0` macht unsichtbar, nicht unerreichbar.** Als die
    Zeitleisten-Etiketten von `<div>` zu `<button>` wurden, waren sie bei
    eingeklappter Leiste weiterhin ertabbar — man landete auf unsichtbaren
    Schaltflächen. `pointer-events:none` hält nur die Maus ab. Es braucht
    `visibility:hidden`, verzögert um die Dauer der Blende.
21. **„Verwaist" muss man gegen die DATENBANK prüfen, nicht gegen den Code.**
    `absent.jpg` und `fern.jpg` sahen unreferenziert aus — sie sind die
    Coverbilder zweier Projekte und stehen nur in Supabase. Ein `grep` über
    das Repo hätte sie gelöscht. Der frisch erzeugte `seed.js` ist eine
    exakte Kopie der Datenbank und damit das richtige Suchziel.
22. **Totes CSS nicht nach Laufzeit-Treffern wegwerfen.** Regeln wie
    `.mm-farbe-ocker` greifen erst, WENN Lucas einen Block so einfärbt. Wer
    misst, welche Selektoren gerade passen, und den Rest löscht, zerstört
    künftige Inhalte. Entfernt wurde deshalb nur, was zur zurückgebauten
    Kachel-Seite gehört — abschnittsweise, nicht selektorweise.
23. **Drei Schriftschnitte waren dieselbe Datei.** Space Grotesk 400, 500 und
    700 hatten denselben Fingerabdruck — 44 kB, die jeder Besucher doppelt
    holte. Aufgefallen ist das erst, als die Dateinamen einen Hash aus dem
    Inhalt bekamen. Wer Schriften einbettet, sieht so etwas nie.
24. **`immutable` im Cache braucht eine Adresse, die sich ändern KANN.** Für
    CSS und JS sorgt der `?v=`-Stempel dafür. Schriften bekommen ihn nicht
    (das Skript stempelt nur `.css`/`.js`) und `seed.js` wird nachgeladen —
    beide brauchten deshalb eine eigene Lösung: Fingerabdruck im Dateinamen
    bzw. eine ausdrückliche Ausnahme in `_headers`.
25. **Das Scroll-Animations-Polyfill zerstört die `@font-face`-Regeln.**
    Nach dem Umzug meldete Lucas, die Schriften luden in Firefox nicht — in
    Chrome und Safari war alles richtig. flackr/scroll-timeline liest beim
    Start jedes `<link rel=stylesheet>` und jedes `<style>` ein, schreibt sie
    um und hängt sie als `blob:`-Adresse wieder ein; die `@font-face`-Regeln
    überleben das nicht. Chrome und Safari sind nie betroffen, weil das
    Polyfill dort gar nicht erst lädt. Ersatz ist
    `assets/schriften-retten.js`: es holt `fonts.css` als Text, liest die
    Regeln aus und registriert sie über die JS-Schnittstelle neu. Es liest
    dabei bewusst die Datei statt eine zweite Liste zu führen — sonst liefen
    Dateinamen und Fingerabdrücke auseinander. Ein zweites `<link>` auf
    `fonts.css` nachträglich einzuhängen half **nicht** (gemessen): das
    Polyfill greift auch später eingefügte Stylesheets ab. Geprüft von
    `tests/pruefe-schriften-firefox.mjs`.
26. **Zwei falsche Fährten auf dem Weg dorthin — beide durch schlechtes
    Messen.** Erstens wurde `offsetWidth` einer Testspanne gemessen; die Zahl
    war in Wahrheit die Breite des Elternelements und für jede Schrift
    identisch. Elementbreiten hängen am Layout, nicht an der Schrift. Was
    trägt, ist ein ins Canvas gezeichnetes Wort und die Zahl seiner gefärbten
    Pixel. Zweitens wurde daraus geschlossen, der Familienname `Tropi`
    kollidiere mit der auf dem Mac installierten Schrift „Tropi Land". Das war
    falsch — betroffen waren **alle** Familien, auch Manrope und Space Mono.
    Die Familie heißt seitdem trotzdem `TropiWeb`; die Umbenennung schadet
    nicht und schließt eine echte Kollisionsmöglichkeit aus, war aber nie die
    Ursache. Lehre: bevor eine Erklärung steht, prüfen, ob sie auch erklärt,
    was NICHT betroffen ist. Hier war nichts unbetroffen — das hätte die
    Namenstheorie sofort erledigt.

## Testserver, der Netlify nachahmt

```bash
node tests/server.mjs        # Port 8901, bildet die _redirects-Regeln nach
```

Prüfungen einzeln ausführen, z.B.:

```bash
node tests/pruefe-scroll-bewegung.mjs
```

Screenshots über Chrome im Kopflos-Betrieb (das Vorschau-Panel ist unzuverlässig):

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --disable-gpu --hide-scrollbars --virtual-time-budget=25000 \
  --window-size=1280,4900 --screenshot=bild.png "http://localhost:8901/"
```
