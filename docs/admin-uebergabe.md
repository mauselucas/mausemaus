# Block-Editor als Admin-Oberfläche — Übergabe

**Für:** die KI, die Celines Website betreut
**Von:** Claude (Lucas' Projekt mausemaus.com), Stand 25.08.2026
**Zweck:** denselben Admin noch einmal bauen, ohne dieselben Fehler noch einmal zu machen

---

## 0. Für Celine und Lucas in drei Sätzen

Es geht um eine Seite `admin.html`, auf der man sich einloggt und dann jede Seite der
Website bearbeitet: Text schreiben, Bilder einsetzen, Videos einbetten, Blöcke per
Griff umsortieren. Man drückt nie „Speichern" — es speichert von selbst. Die Fläche,
auf der man schreibt, sieht schon aus wie das fertige Ergebnis; es gibt keine zweite
Vorschau-Spalte.

Der Rest dieses Dokuments richtet sich an die KI, die es bauen soll.

---

## 1. Voraussetzungen — was Celines Seite mitbringen muss

| Was | Warum | Ersetzbar? |
|---|---|---|
| **Supabase-Projekt** (kostenlos) | Datenbank + Anmeldung + Dateiablage in einem | Ja, aber dann ist fast alles in `admin.js` und `db.js` neu zu schreiben |
| **Statisches Hosting** (Netlify, Vercel, …) | Es gibt keinen Build-Schritt: Ordner hochladen, fertig | Ja, beliebig |
| **Kein Framework, kein npm** | Reines HTML/CSS/JS mit ES-Modulen | — |
| **Moderner Browser** | `crypto.randomUUID`, `color-mix()`, `checkVisibility()` | Fallbacks nötig, wenn ältere unterstützt werden sollen |

**Wenn Celines Seite eine ganz andere Datenhaltung hat** (WordPress, Contentful, eigene
API, Dateien im Repo), ist der Editor trotzdem übernehmbar: Er spricht nur über vier
Funktionen mit der Datenbank (siehe §4). Diese vier tauscht man aus, der Rest bleibt.

---

## 2. Der Aufbau in einem Bild

```
admin.html          Gerüst: Anmeldung · Übersichtsliste · Dokument · zwei Panels
  └─ admin.js       Anmeldung, Liste, Bild-Upload, Seiten-Felder, Panels
       └─ blockeditor.js    der Editor selbst (alles, was mit Blöcken zu tun hat)
            └─ block-modell.js   REINE LOGIK, ohne DOM — hier liegt der Wert
       └─ anleitung.js  Auf-/Zuklappen der Hilfe (18 Zeilen)

geteilt mit der öffentlichen Website:
  shared.js     Markdown → HTML, Video-Erkennung, Escaping
  bloecke.js    Block → HTML  ← DERSELBE Umsetzer, den Besucher sehen
  config.js     Supabase-Adresse und öffentlicher Schlüssel
  site.css      Farben und Schriften als CSS-Variablen
```

**Die wichtigste Entscheidung des ganzen Aufbaus:** Der Editor rendert Bilder, Videos
und Trenner mit **exakt demselben** `bloecke.js`, das auch die öffentliche Seite
benutzt. Dadurch *kann* die Vorschau nicht von der Wirklichkeit abweichen — nicht weil
jemand aufpasst, sondern weil es nur einen Umsetzer gibt.

Zweitwichtigste: **`block-modell.js` enthält keine einzige DOM-Zeile.** Sortierung,
Speicher-Warteschlange, Markdown-Zerlegung, Auszeichnungs-Hervorhebung — alles reine
Funktionen. Das ist der Grund, warum 143 der 328 Prüfungen ohne Browser und ohne
Anmeldung laufen. Wer das vermischt, kann später fast nichts mehr prüfen.

---

## 3. Datenbank

Zwei Tabellen. `seiten` ist eine Seite, `bloecke` sind ihre Absätze.

```sql
create table seiten (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  typ         text not null check (typ in ('brief','projekt','welt')),
  titel       text not null default '',
  untertitel  text,
  kunde       text,
  jahr        text,
  cover_url   text,
  cover_pos   text default '50% 50%',
  video_url   text,
  embed_ok    boolean default true,
  farbe       text,
  ist_aktuell boolean default false,
  status      text not null default 'draft'
              check (status in ('draft','published','archived')),
  sort_order  double precision default 1000,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create table bloecke (
  id         uuid primary key default gen_random_uuid(),
  seite_id   uuid not null references seiten(id) on delete cascade,
  typ        text not null check (typ in (
               'text','ueberschrift','randnotiz','bild','gif','video',
               'text_mit_bild','code','werkzeug','trenner','tuer','abschnitt')),
  inhalt     jsonb not null default '{}',
  breite     text not null default 'normal'
             check (breite in ('schmal','normal','randnotiz','voll')),
  bewegung   text not null default 'keine'
             check (bewegung in ('keine','einblenden','hochschieben','wachsen','zeilenweise')),
  notiz      text,                          -- PRIVAT, siehe unten
  sort_order double precision default 1000,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

`typ`, `breite` und `bewegung` sind projektspezifisch — Celine braucht andere Blockarten.
**Wichtig ist nur das Muster:** `inhalt` als `jsonb`, `sort_order` als **Fließkommazahl**
(nicht integer!), und die Prüfbedingungen in der Datenbank statt nur im JavaScript.

### Warum `sort_order` eine Fließkommazahl sein muss

Zum Umsortieren wird der neue Wert als **Mittelwert der beiden Nachbarn** berechnet:
zwischen 100 und 200 liegt 150, dann 125, dann 112.5. So ist beim Verschieben **immer
genau eine Zeile** zu schreiben, nie die ganze Liste neu durchzunummerieren. Mit einem
Integer geht das nach wenigen Verschiebungen nicht mehr auf.

Kanten sauber behandeln: kein Vorgänger → `danach - 100`; kein Nachfolger →
`davor + 100`; Liste leer → `1000`.

### Zugriffsregeln (RLS) — hier lag ein echtes Leck

```sql
alter table seiten  enable row level security;
alter table bloecke enable row level security;

create policy "eingeloggt darf alles" on seiten
  for all to authenticated using (true) with check (true);
create policy "oeffentlich liest veroeffentlichte" on seiten
  for select to anon using (status = 'published');

create policy "eingeloggt darf alles" on bloecke
  for all to authenticated using (true) with check (true);
create policy "oeffentlich liest bloecke veroeffentlichter seiten" on bloecke
  for select to anon
  using (exists (select 1 from seiten s
                 where s.id = bloecke.seite_id and s.status = 'published'));
```

**Die Spalte `notiz` ist ein privates Notizfeld** („Notiz an Claude") und darf Fremden
nie zugänglich sein. Der entscheidende Punkt, an dem wir uns geirrt haben:

> **Ein `REVOKE` auf eine einzelne Spalte hebt ein tabellenweites `GRANT` nicht auf.**

Es funktioniert nur andersherum — Recht komplett entziehen, dann die erlaubten Spalten
einzeln vergeben:

```sql
revoke select on bloecke from anon;
grant select (id, seite_id, typ, inhalt, breite, bewegung, sort_order,
              created_at, updated_at) on bloecke to anon;   -- notiz fehlt: Absicht
```

**Und dann nachweisen, nicht glauben.** Wir prüfen es mit einem gezielten Angriff aus
dem Browser:

```js
fetch(URL + '/rest/v1/bloecke?select=notiz&limit=5', { headers: { apikey: OEFFENTLICHER_SCHLUESSEL }})
// muss 401/403 liefern — nicht etwa Daten
```

**Für Celines Aufbau strenger machen als bei uns:** In Lucas' Projekt hat `anon`
weiterhin INSERT/UPDATE-Rechte auf allen Spalten von `bloecke`, inklusive `notiz`. Das
ist ungenutzt und wirkungslos, weil keine RLS-Regel Fremden das Schreiben erlaubt — RLS
und GRANT müssen **beide** zustimmen. Trotzdem ist es unnötiger Sprengstoff für den Tag,
an dem jemand eine großzügige Regel ergänzt. Bei einem Neuaufbau also gleich:

```sql
revoke insert, update, delete on seiten, bloecke from anon;
```

### Dateiablage

Ein Storage-Bucket (bei uns `media`), öffentlich lesbar, Schreiben nur angemeldet.

---

## 4. Die Schnittstelle, an der man Supabase austauschen kann

`mountBlockEditor()` kennt keine Datenbank. Es bekommt vier Funktionen:

```js
mountBlockEditor(wurzelElement, {
  seiteId,
  anfangsBloecke,          // Array, bereits nach sort_order sortiert
  statusEl,                // Element für "speichert…" / "gespeichert HH:MM:SS"
  api: {
    async neu(entwurf)            { /* → { id } */ },
    async aktualisieren(id, felder) { /* wirft bei Fehler */ },
    async loeschen(id)            { /* wirft bei Fehler */ },
    async bildHochladen(datei)    { /* → { url } oder null */ },
  },
});
```

Wenn Celines Seite keine Supabase-Datenbank hat, sind **das hier die vier Funktionen**,
die neu geschrieben werden — sonst nichts. Wichtig: `aktualisieren` und `loeschen`
müssen bei Fehlern **werfen**, sonst greift die Fehlerbehandlung in der
Speicher-Warteschlange nicht (siehe §6, Fehler 4).

---

## 5. Welche Dateien Lucas schicken kann

**Mitschicken — der eigentliche Admin:**

| Datei | Zeilen | Inhalt |
|---|---|---|
| `admin.html` | 243 | Gerüst |
| `assets/admin.css` | 527 | Aussehen |
| `assets/admin.js` | 673 | Anmeldung, Liste, Upload, Panels |
| `assets/blockeditor.js` | 1022 | der Editor |
| `assets/block-modell.js` | 482 | **reine Logik — der wertvollste Teil** |
| `assets/anleitung.js` | 18 | Hilfe auf-/zuklappen |

**Mitschicken — das Prüfwerkzeug (sehr empfehlenswert):**

| Datei | Zeilen | Inhalt |
|---|---|---|
| `tests/chrome.mjs` | 102 | steuert Chrome ohne npm-Pakete (Chrome DevTools Protocol) |
| `tests/server.mjs` | 50 | ahmt Netlify nach, damit Adressen wie live funktionieren |
| `tests/feste/blockeditor-probe.html` | 115 | Prüfseite: Editor an einen erfundenen Speicher gehängt, **ohne Anmeldung** |
| `tests/pruefe-editor*.mjs`, `pruefe-auszeichnung.mjs`, `pruefe-ueberlagerung.mjs` | | die Prüfungen selbst |

Die Prüfseite ist der Grund, warum sich der Editor überhaupt automatisch prüfen lässt:
Sie hängt ihn an einen Datenspeicher im Arbeitsspeicher, der sich wie Supabase verhält
(asynchron, mit künstlicher Verzögerung). Kein Passwort nötig.

**Auf keinen Fall mitschicken:**

- **`assets/config.js`** — enthält Lucas' Supabase-Adresse. Celine muss ein **eigenes**
  Projekt anlegen. Würde sie die Datei unverändert übernehmen, schriebe ihr Admin in
  **Lucas' Datenbank**. Der Schlüssel darin ist zwar öffentlich und harmlos, die Adresse
  ist es nicht.
- **`sicherungen/`** — Datenbank-Auszüge samt der privaten Notizen.
- **Niemals den `service_role` / `sb_secret_…`-Schlüssel.** Der gehört in keine Datei,
  die im Browser landet, und in keine Nachricht. Nur der `sb_publishable_…`-Schlüssel
  darf in den Code — geschützt wird über die Zugriffsregeln, nicht über Geheimhaltung.

**Nicht direkt übernehmbar** (das sind mausemaus-Sachen, kein Admin):
`shared.js`, `bloecke.js`, `db.js`, `site.css`, `fonts.css`, `inhalt.js`. Sie definieren
Lucas' Blockarten, seine Türchen-Schreibweise `[[Wort|ziel]]`, seine Farben und
Schriften. Celine braucht hier eigene — aber **nach demselben Muster**: ein Umsetzer,
den Admin und öffentliche Seite gemeinsam benutzen.

---

## 6. Die Fehler — der wertvollste Teil dieses Dokuments

Alles hier ist wirklich passiert. Die meisten waren nicht beim Draufschauen zu sehen.

### Fehler 1 — Prüfungen, die gar nicht fehlschlagen konnten

In diesem Projekt gab es davon **acht**. Das ist die häufigste und teuerste Fehlerart,
weil sie sich als Sicherheit tarnt.

- Eine Prüfung las `window.__fehler` — eine Variable, die nie jemand gesetzt hat.
- Eine prüfte `document.fonts.check('16px Tropi')` und bekam `true` von einer
  **auf dem Mac installierten Schrift „Tropi Land"**, nicht von der Website.
- Eine las `#vorschau`, ein Element, das es nach dem Umbau nicht mehr gab → leerer
  String → „die Notiz steht nicht drin" ✓ für immer grün, ohne noch etwas zu bewachen.
- Und die feinste: `statusWaehrend.includes('speichert')` — **„gespeichert" enthält
  „speichert".** Die Prüfung konnte nicht fehlschlagen. Ihr eigener Gegenbeweis testete
  `'speichert…'` *mit* Auslassungspunkten, also eine ganz andere Zeichenkette, und sah
  deshalb nichts.

> **Regel, die daraus wurde:** Jede Prüfung wird einmal absichtlich gebrochen, und es
> wird gezeigt, dass sie fällt. Ohne diesen Nachweis gilt sie als nicht vorhanden.

Praktischer Zusatz, doppelt schmerzhaft gelernt: **vor dem Brechen festschreiben
(`git commit`).** `git checkout --` zum Zurücksetzen hat mir zweimal noch nicht
festgeschriebene Arbeit mitgerissen. Besser auf einer Kopie brechen.

### Fehler 2 — Der Editor verlor den letzten Satz

Getippt wird entprellt gespeichert (500 ms nach dem letzten Tastendruck). Wer tippte
und **sofort** „Zurück" drückte, verlor alles aus diesen 500 ms — das Schließen kappte
den Zeitgeber, ohne ihn auszulösen.

Das passierte **zweimal**: erst bei den Seiten-Feldern, später noch einmal im
Blockeditor, nachdem der Fehler beim ersten Mal schon bekannt war.

```js
// beim Schließen: ausstehende Änderungen SOFORT rausschreiben, dann warten
function flush() { /* jeden laufenden Zeitgeber kappen UND auslösen */ }
seitenEntprellung.sofort();
EDITOR?.flush();
while (WARTESCHLANGE?.beschaeftigt() || EDITOR?.beschaeftigt?.())
  await new Promise(r => setTimeout(r, 30));
EDITOR?.zerstoeren();     // erst JETZT
```

### Fehler 3 — Zwei schnelle Speichervorgänge, der ältere gewinnt

Zwei Änderungen kurz hintereinander. Die erste Antwort kommt langsamer zurück als die
zweite — und überschreibt sie. Eine Entprellung hilft dagegen **nicht**.

Die Lösung ist strukturell, nicht zeitbasiert: eine Warteschlange pro Block, die nie
mehr als einen Schreibvorgang gleichzeitig laufen lässt und nur den **neuesten**
wartenden Stand als nächstes schickt.

```js
export function erzeugeSpeicherWarteschlange(schreiben, beiFehler = null) { … }
```

### Fehler 4 — Ein Fehlschlag verschwand spurlos

Dieselbe Warteschlange hatte `try { await schreiben(daten) } finally { … }` — **ohne
`catch`**. Ging der Schreibvorgang schief (Netz weg, Anmeldung abgelaufen), war der
Stand für immer fort, und die Anzeige sagte weiter „gespeichert".

Das ist der schlimmste denkbare Fehler in einem Editor, dessen ganzes Versprechen „du
musst nie auf Speichern drücken" lautet.

Jetzt: Der gescheiterte Stand **bleibt liegen**, die Anzeige wird rot und anklickbar
(„nicht gespeichert — klicken zum Wiederholen"). Und: `beschaeftigt()` zählt einen
gescheiterten Stand absichtlich **nicht** mit, sonst wartet das Schließen bei
dauerhaftem Fehler ewig.

### Fehler 5 — Schreibfeld und Hervorhebung liefen mit verschiedener Schrift

Der Editor zeigt Auszeichnungen (`**fett**`, Links) direkt im Text an. Technisch liegt
dafür ein **durchsichtiges Textfeld über einer eingefärbten Kopie desselben Textes**.

Damit das kein Doppelbild wird, müssen beide Schichten **zeichengenau und metrisch
identisch** setzen. Zwei Wege, das zu zerstören — wir hatten beide:

**(a) Zeichen verschwinden.** Der naive Ansatz macht aus `**fett**` ein
`<strong>fett</strong>` — sechs Zeichen weg, die Schicht ist kürzer als das Feld, die
Schrift steht ab da versetzt zum Cursor. Die Sterne müssen **mitgezeichnet** werden.

**(b) Glyphen werden breiter.** Selbst bei perfekt erhaltenen Zeichen verschiebt echtes
`font-weight: bold` den Zeilenumbruch. **Die Hervorhebungs-Klassen dürfen nichts
enthalten, was Glyphen breiter macht** — kein `font-weight`, kein `font-style`, kein
`letter-spacing`, keine andere Schriftfamilie. Erlaubt ist nur, was malt:

```css
.hz-fett {
  text-shadow: .32px 0 0 currentColor, -.32px 0 0 currentColor;  /* Pseudo-Fett */
}
.hz-kursiv { background: color-mix(in srgb, var(--akzent) 12%, transparent); }
```
(Versatz statt Unschärfe: ein Unschärferadius unter einem Bildpunkt wird je nach
Bildschirm auf null gerundet und ist dann unsichtbar.)

**(c) Und der, den alle übersehen haben:** Eine gewöhnliche Formularregel

```css
.admin textarea { font-family: inherit; font-size: 14px; line-height: 1.55; }
```

ist **spezifischer** als `.be-text` (0,1,1 gegen 0,1,0) und gewinnt. Das Schreibfeld
lief mit Systemschrift in 14px, die Schicht darunter mit Space Grotesk in 17px. Zwei
Schichten, die deckungsgleich liegen müssen, mit völlig verschiedener Metrik — und der
Code sah an keiner Stelle falsch aus.

Gefunden nur durch **Messen im echten Browser**:

```js
const a = getComputedStyle(feld), b = getComputedStyle(schicht);
for (const e of ['fontFamily','fontSize','lineHeight','letterSpacing',
                 'paddingLeft','paddingTop','borderLeftWidth','whiteSpace'])
  if (a[e] !== b[e]) melde(e, a[e], b[e]);
```

Gelöst nicht über höhere Spezifität (das nächste Wettrennen kommt bestimmt), sondern
über eine **Ausnahmeliste**, die aussagt, was zur Schreibfläche gehört:

```css
.admin textarea:not(.be-text):not(.be-ueberschrift):not(.be-code-text) { … }
```

### Fehler 6 — Zwei Maße, die zueinander passen mussten, standen an zwei Orten

Die Leiste links (Griff ⠿ und ⋯-Menü) war 59 px breit, die Einrückung des Textes 44 px.
Der ⋯-Knopf lag also 15 px **über** dem ersten Buchstaben. Auf dem Bildschirmfoto war
das ein winziger Strich vor dem Text — nichts, was beim Draufschauen auffällt.

Zwei Lehren: Knöpfe brauchen **feste Maße**, wenn ihre Gesamtbreite vorher bekannt sein
muss. Und zwei Maße, die zusammenpassen müssen, gehören in **eine** Variable:

```css
.dok-bereich { --leiste: 56px; }
.be-zeile { padding-left: var(--leiste); }
.be-rail  { width: calc(var(--leiste) - 4px); }
```

Ebenfalls hier gelernt: `opacity: 0` **nimmt weiterhin Platz**. Ein unsichtbares
Auswahlfeld als Flex-Geschwister vor der Überschrift rückte genau diese eine Zeile
dauerhaft ein.

### Fehler 7 — Textverlust durch eine Weiche am falschen Merkmal

Bei einem zusammengesetzten regulären Ausdruck mit mehreren Alternativen entschied der
Code anhand des **ersten Zeichens** des Treffers, welche Alternative gegriffen hatte.
Ein Kursiv-Treffer nach einer eckigen Klammer sah damit aus wie ein Link-Treffer:

```
Eingabe:  siehe [*wichtig*] hier
Ergebnis: siehe [undefined](undefined)] hier     ← Text ZERSTÖRT
```

> **Immer nach Gruppenfüllung entscheiden** (`m[1] !== undefined`), nie nach dem
> Anfangszeichen. Und ein defensiver Zweig am Ende, der den Treffer im Zweifel
> unverändert durchreicht.

Direkt daneben der Gegenfehler: ein Wächter, der `5 * 3` vor der Kursiv-Erkennung
schützen sollte, verlangte ein Nicht-Leerzeichen **vor** dem Stern — und tötete damit
den Normalfall `Wort *kursiv* Wort`. Richtig ist die Bedingung **nach** dem öffnenden
Stern.

### Fehler 8 — Die Prüfung, die nur die halbe Fehlerklasse sah

Zu Fehler 7 wurde eine Prüfung geschrieben: „Tags entfernt ergibt wieder den Rohtext."
Sie sah den zweiten Fehler **nicht** — nicht erkannter Text bleibt ja unverändert und
verletzt keine Erhaltungsregel.

> Eine Textauszeichnung braucht **drei** Verträge, nicht einen:
> **1. ERHALTEN** — Tags weg ergibt exakt den maskierten Rohtext
> **2. ERKANNT** — bekannte Muster tragen wirklich ihre Klasse
> **3. RUHIG** — Gegenbeispiele (`5 * 3`) bekommen **keine** Auszeichnung
>
> Plus: ein Test auf die Zeichenkette `"undefined"` im Ergebnis. Der fängt kaputte
> Weichen generell, auch die, an die niemand gedacht hat.

### Fehler 9 — Kleinere, aber teure

- **`offsetTop` ist relativ zum nächsten *positionierten* Vorfahren**, nicht zum
  Scroll-Container. Eigene Helfer schreiben, die bis zum Container hochlaufen.
- **`loading="lazy"`-Bilder oberhalb der Falz laden nie**, wenn nichts scrollt →
  `Promise.all` auf `onload` löst nie auf → die Berechnung danach lief nie.
  `ResizeObserver` statt auf Bilder zu warten.
- **Safari kann per Canvas kein WebP erzeugen** — es liefert stillschweigend PNG unter
  der Endung `.webp`. Endung aus dem tatsächlichen Blob-Typ ableiten.
- **Animierte Bilder nie durchs Canvas schicken** (GIF, APNG, animiertes WebP) — es
  bleibt nur das erste Einzelbild übrig. Mit einer **Positivliste** arbeiten
  („garantiert ein Einzelbild: jpeg, png, bmp"), nicht mit einer Liste bekannter
  bewegter Formate. Eine Verneinung übersieht jedes neue Format von selbst.
- **Netlify-Weiterleitung `/welt/*` verschluckt Unterpfade** und liefert für
  `/welt/assets/x.css` eine HTML-Seite mit Status 200. Ein Test, der `<link>`-Tags
  zählt, merkt davon nichts. `/welt/:slug` (ein Segment) benutzen, und prüfen, ob
  Stilregeln wirklich **geladen** wurden (`document.styleSheets[i].cssRules.length`).
- **Ein zugeklapptes `<details>` meldet weiterhin seine volle Höhe.** Eine Höhenmessung
  als Sichtbarkeitsprüfung ist blind — `element.checkVisibility()` benutzen.
- **Chrome-Profile nicht in einen iCloud-synchronisierten Ordner legen.** Das gab
  `ENOTEMPTY`-Abstürze. `os.tmpdir()`.

---

## 7. Checkliste für Celines Coder

**Bevor irgendetwas gebaut wird**

- [ ] Eigenes Supabase-Projekt anlegen. `config.js` **neu schreiben**, nicht kopieren.
- [ ] Prüfen, dass nirgends ein `sb_secret_…` im ausgelieferten Ordner landet.
- [ ] Sicherung der bestehenden Daten ziehen, bevor der erste Schreibzugriff läuft.

**Beim Bauen**

- [ ] Reine Logik strikt vom DOM trennen (`block-modell.js`-Muster). Ohne das ist später
      fast nichts prüfbar.
- [ ] Ein Umsetzer für Admin **und** öffentliche Seite. Niemals zwei.
- [ ] Speichern über eine Warteschlange pro Block, **mit** Fehlerbehandlung.
- [ ] `flush()` beim Schließen — und erst danach zerstören.
- [ ] Private Felder dem Umsetzer gar nicht erst übergeben, zusätzlich zur Sperre in
      der Datenbank.
- [ ] Bedienelemente, die bei Annäherung erscheinen, brauchen einen Ersatz für
      Berührungsgeräte (`@media (hover: none)`).

**Wenn eine Überlagerungs-Technik zum Einsatz kommt (fett/kursiv im Textfeld)**

- [ ] Zeichenzahl beider Schichten identisch — automatisch prüfen.
- [ ] Keine Eigenschaft, die Glyphen breiter macht.
- [ ] Berechnete Stile **im Browser vergleichen**, nicht im Code nachlesen.
- [ ] Von Hand nachsehen: Cursor ans Textende setzen — er muss auf dem letzten Zeichen
      sitzen, nicht daneben.

**Bevor irgendetwas „fertig" heißt**

- [ ] Jede Prüfung einmal absichtlich brechen und den Fehlschlag zeigen. Vorher
      festschreiben.
- [ ] Einmal echt durchspielen: Seite anlegen, füllen, speichern, **neu laden**,
      vergleichen.
- [ ] Ab 520 px Breite prüfen (darunter liefert Chrome nur einen Ausschnitt).
- [ ] Als **nicht angemeldeter** Besucher prüfen: Entwürfe unsichtbar, private Felder
      nicht abfragbar.

---

## 8. Was Celine ohnehin anders braucht

Diese Dinge sind mausemaus-spezifisch und lassen sich nicht übernehmen, nur nachbauen:

- **Die Blockarten.** Lucas hat zwölf, darunter „Türchen" (Knöpfe in andere Welten) und
  „Abschnitt" (Marken für seine Zeitleiste). Celine braucht ihre eigenen — die Liste
  steht an genau einer Stelle (`BLOCKARTEN` in `block-modell.js`) und speist von dort
  aus die „/"-Auswahl, die Prüfbedingung in der Datenbank und die Hilfe.
- **Die Schreibweisen im Text.** `[[Wort|ziel]]` und `((Wort|ziel))` sind Lucas'
  Erfindung.
- **Farben und Schriften.** Der Rahmen des Admins ist bewusst neutral (Systemschrift,
  ruhiges Grau, eine Akzentfarbe) — nur *innerhalb* der Schreibfläche gelten die
  Schriften der Website. Das ist übernehmbar; die konkreten Werte nicht.

  **Achtung, sonst bricht es sofort und stumm:** `admin.css` bringt die Variablen des
  Rahmens selbst mit (`--text`, `--grau`, `--akzent`, …), erwartet aber vier weitere
  von außen — sie stehen in `site.css` und **nicht** in den mitgeschickten Dateien:

  | Variable | wofür | Vorschlag, falls Celine nichts Eigenes hat |
  |---|---|---|
  | `--ink` | Textfarbe in der Schreibfläche | `#0D1821` |
  | `--paper` | Hintergrund von Randnotiz und Code | `#F0F4EF` |
  | `--line` | deren Rahmenlinie | `#D5D9D2` |
  | `--muted` | Untertitel | `#6E7873` |

  Fehlen sie, fällt CSS **stillschweigend auf nichts zurück** — kein Fehler in der
  Konsole, nur unsichtbarer Text und farblose Kästen. Ebenfalls von außen erwartet:
  die Schriften `Tropi` (Überschriften), `Space Grotesk` (Fließtext) und `Space Mono`
  (Code). Ohne sie greift die jeweilige Ersatzschrift — das ist harmlos, sieht aber
  anders aus. Wer eigene Schriften einsetzt, muss danach die Überlagerungs-Prüfung
  erneut laufen lassen (§6, Fehler 5).
- **Die Seitentypen.** `brief`/`projekt`/`welt` sind Lucas' Struktur.

---

## 9. Stand des Originals

328 automatische Prüfungen in 16 Bereichen, alle grün. **143 davon laufen als reine
Logik in Node** — ohne Browser, ohne Anmeldung, in unter einer Sekunde; die übrigen 185
über Chrome gegen einen Netlify-Nachbau. Dieses Verhältnis ist kein Zufall, sondern die
Folge der Trennung aus §2: Was ohne DOM auskommt, lässt sich billig und oft prüfen.
Jede Prüfung ist einmal absichtlich gebrochen worden.

Nicht enthalten und offen: Bild per Strg+V einfügen, Fokus-Modus, verkleinerte
Vorschaubilder in der Übersichtsliste.
