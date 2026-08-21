# „Der Brief" — öffentliche Seite · Umsetzungsplan

> **Für ausführende Agenten:** ERFORDERLICHE UNTERFÄHIGKEIT: `superpowers:subagent-driven-development`
> (empfohlen) oder `superpowers:executing-plans`, um diesen Plan Aufgabe für Aufgabe umzusetzen.
> Schritte benutzen Kästchen (`- [ ]`) zur Nachverfolgung.

**Ziel:** mausemaus.com wird von der Kachel-/Zeilen-Startseite zum „Brief" mit
Zeitleisten-Navigation, Hintertürchen und Welten-Seiten — mit **unverändertem Inhalt** und
live-fähig am Ende dieses Plans.

**Architektur:** Statische Seite ohne Bauschritt. HTML lädt reines JavaScript, das die Inhalte
zur Laufzeit aus Supabase holt (mit Zwischenspeicher und `seed.js` als Rückfall). Die Zeitleiste
ist ein eigenständiges, datenfreies Bauteil, das eine Liste von Abschnitten entgegennimmt — sie
weiß nichts von Projekten oder Supabase. Der Brief setzt seine Abschnitte aus den **vorhandenen**
Tabellen `settings` und `projects` zusammen; **es gibt in diesem Plan keine Datenwanderung.**

**Werkzeuge:** HTML · CSS · JavaScript ohne Bibliotheken · Supabase REST · Netlify ·
Node 25 (nur für die Tests, ohne fremde Pakete) · Chrome DevTools Protocol

---

## Bewusste Abweichung vom Entwurfsdokument

Das Entwurfsdokument nennt als Schritt 1 die Wanderung nach `seiten`/`bloecke`.
**Dieser Plan verschiebt sie in den Blockeditor-Plan.**

Begründung: Der Brief lässt sich vollständig aus `settings` und `projects` erzeugen, so wie sie
heute sind. Eine Datenwanderung wäre der einzige Schritt in diesem Plan, der bestehende Inhalte
anfassen könnte — und genau das soll nicht passieren („übernehme die Projekte 1:1"). Ohne sie
ist der Weg bis zum Hochladen kürzer und das Risiko fällt auf null. Die Wanderung wird gebraucht,
sobald es Blöcke zu bearbeiten gibt, also im nächsten Plan.

Einzige Datenbankänderung hier: **eine zusätzliche, leere Spalte** `posts.farbe` (Aufgabe 2).
Additiv, verändert keine vorhandene Zeile.

---

## Reihenfolge der Pläne

| Plan | Inhalt | Ergebnis |
|---|---|---|
| **1 — dieser** | Brief, Zeitleiste, Türchen, Welten | **Seite geht live** |
| 2 | `seiten`/`bloecke`, Wanderung, Blockeditor, Anleitung im Admin | Lucas kann alles selbst |
| 3 | Startanimation, Tageszeit, Dackel, Bewegung abschaltbar, Feinschliff | fertig |

---

## Globale Vorgaben

Diese gelten für **jede** Aufgabe, auch wenn sie dort nicht wiederholt werden.

- **Inhalt nicht verändern.** Wortlaut, Bilder und Videos der bestehenden Projekte und
  Beiträge werden 1:1 übernommen. Kein Umformulieren, kein Kürzen, kein Ersetzen von Bildern.
- **Der geheime Schlüssel** (`service_role` / `sb_secret_…`) darf in keiner Datei unter
  `HOCHLADEN/` vorkommen. Nur `sb_publishable_FUb6TXV9cV1eKF5MG0RuCg_ZGFy1UN4` gehört dorthin.
- **Pacing der Zeitleiste, unveränderlich:** Halten 760 ms · Dauer 860 ms ·
  `cubic-bezier(.50, 0, .12, 1)` · nach Mausaustritt 1100 ms · Schwelle 120 px ·
  Hochscrollen öffnet sofort.
- **Zeitleiste optisch:** Segmente **mit ~6 px Abstand und abgerundet** (nicht lückenlos),
  Etiketten **feste Breite 172 px** mit Umbruch, Führungslinien blass `#DAD6CA` ohne Haken,
  Timecode freistehend. Die lückenlose Variante wurde geprüft und abgelehnt — nicht erneut bauen.
- **Farben:** `--ink #0D1821` · `--navy #344966` · `--sky #B4CDED` · `--paper #F0F4EF` ·
  `--sage #BFCC94` · `--line #D5D9D2` · `--muted #6E7873` · Brief-Untergrund `#FBFAF6` ·
  persönliche Abschnitte `#D6D3C4`.
- **Schriften:** Tropi (Überschriften), Space Grotesk (Fließtext), Space Mono (Kleinkram) —
  aus `assets/fonts.css`, keine neuen Schriften.
- **Alle Pfade in HTML absolut** (`/assets/…`), niemals relativ. Unter `/welt/slug` zeigen
  relative Pfade sonst ins Leere. Das ist schon einmal passiert.
- **`[hidden]` braucht `!important`** in `site.css` — eigene `display`-Regeln schlagen es sonst.
  Diese Regel muss erhalten bleiben.
- **Rasterkinder brauchen `min-width: 0`**, sonst schrumpfen sie nicht unter ihre Inhaltsbreite.
- **Geprüft wird unter den echten Adressen** über den Nachbau-Server (`/`, `/welt/slug`),
  nicht als Datei und nicht nur im Wurzelverzeichnis.
- **Handy-Ansicht mindestens 520 px breit prüfen.** Darunter liefert Chrome nur einen Ausschnitt
  und das Ergebnis täuscht.
- **Bewegung respektiert `prefers-reduced-motion`.** Jede Animation braucht diesen Ausweg.
- **Nach jeder Aufgabe wird festgeschrieben** (`git commit`).

---

## Dateiaufbau

**Neu**

| Datei | Verantwortung |
|---|---|
| `tests/chrome.mjs` | Chrome starten und fernsteuern, ohne fremde Pakete |
| `tests/server.mjs` | Netlify nachbauen: statische Dateien + `_redirects`-Umschreibungen |
| `tests/pruefe-bestand.mjs` | Grundprüfung, dass das Gerüst funktioniert |
| `tests/pruefe-leiste.mjs` | Zeitleiste: Aufbau, Pacing, Etiketten, Fehlerbehebung |
| `tests/pruefe-brief.mjs` | Brief: Inhalt 1:1, Abschnitte, Türchen |
| `tests/pruefe-welten.mjs` | Welten unter der echten Adresse |
| `tests/feste/leiste-probe.html` | Feste Prüfseite für die Zeitleiste, ohne Datenbank |
| `HOCHLADEN/assets/leiste.js` | Die Zeitleiste als Bauteil. Kennt nur Abschnitte, keine Daten |
| `HOCHLADEN/assets/leiste.css` | Gestaltung der Zeitleiste |
| `HOCHLADEN/assets/brief.js` | Setzt die Abschnitte aus `settings` und `projects` zusammen |
| `HOCHLADEN/assets/brief.css` | Gestaltung des Briefes |
| `HOCHLADEN/assets/tueren.js` | Türchen: Vorschau, besuchte Türen, Geheimtür |
| `HOCHLADEN/welt.html` | Hülle für eine Welt |
| `HOCHLADEN/assets/welt.css` | Farbstimmungen der Welten |

**Geändert**

| Datei | Änderung |
|---|---|
| `HOCHLADEN/index.html` | wird zum Brief; Kontaktformular bleibt fest eingebaut |
| `HOCHLADEN/assets/db.js` | `farbe` bei Welten mitlesen |
| `HOCHLADEN/assets/shared.js` | Türchen-Schreibweise im Umsetzer |
| `HOCHLADEN/_redirects` | `/welt/:slug` |
| `HOCHLADEN/assets/seed.js` | am Ende neu erzeugt |
| `.gitignore` | `tests/.profil/` |

**Entfällt** (erst in Aufgabe 9, wenn der Brief nachweislich läuft):
`HOCHLADEN/assets/start.js`, `HOCHLADEN/assets/start.css`, `HOCHLADEN/beitrag.html`,
`HOCHLADEN/blog.html`, `HOCHLADEN/assets/blog.js`

---

## Aufgabe 1: Prüfgerüst

Zuerst, weil ohne Prüfung jede weitere Aufgabe blind wäre. Das Gerüst wird gegen die **heutige**
Seite bewiesen, bevor irgendetwas verändert wird.

**Dateien:**
- Neu: `tests/chrome.mjs`
- Neu: `tests/server.mjs`
- Neu: `tests/pruefe-bestand.mjs`
- Ändern: `.gitignore`

**Schnittstellen:**
- Liefert: `starteChrome({port}) → {beenden()}` · `oeffne(url, {breite, hoehe}) → Seite` mit
  `seite.werte(ausdruck)`, `seite.warte(ms)`, `seite.bild(pfad)`,
  `seite.fehlerAufSeite() → string[]` (Ausnahmen und fehlgeschlagene Ladevorgänge), `seite.zu()` ·
  `starteServer({wurzel, port}) → {beenden()}` · `pruefe(name, bedingung, zusatz)` und
  `bericht()` aus `tests/chrome.mjs`.

- [ ] **Schritt 1: `tests/chrome.mjs` anlegen**

```js
/* Chrome fernsteuern — ohne eine einzige fremde Abhängigkeit.
   Node bringt WebSocket seit v22 mit, Chrome spricht das DevTools-Protokoll. */
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PROFIL = new URL('./.profil/', import.meta.url).pathname;

export async function starteChrome({ port = 9333 } = {}) {
  rmSync(PROFIL, { recursive: true, force: true });
  mkdirSync(PROFIL, { recursive: true });
  const p = spawn(CHROME, [
    '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${PROFIL}`,
    '--no-first-run', '--no-default-browser-check', '--disable-gpu', 'about:blank',
  ], { stdio: 'ignore' });

  for (let i = 0; i < 50; i++) {
    try { await fetch(`http://127.0.0.1:${port}/json/version`); return { port, beenden(){ p.kill(); } }; }
    catch { await new Promise(r => setTimeout(r, 200)); }
  }
  throw new Error('Chrome ist nicht hochgekommen');
}

export async function oeffne(url, { port = 9333, breite = 1280, hoehe = 900 } = {}) {
  const ziel = await (await fetch(
    `http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' })).json();
  const ws = new WebSocket(ziel.webSocketDebuggerUrl);
  await new Promise(r => (ws.onopen = r));

  let n = 0; const offen = new Map(); const fehler = [];
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.id && offen.has(m.id)) { offen.get(m.id)(m); offen.delete(m.id); return; }
    /* Fehler der Seite mitschreiben. Log.entryAdded meldet auch Dateien, die
       nicht geladen werden konnten — genau der Fehler, der die Blog-Seiten
       schon einmal ohne CSS ausgeliefert hat. */
    if (m.method === 'Runtime.exceptionThrown')
      fehler.push(m.params?.exceptionDetails?.exception?.description
               || m.params?.exceptionDetails?.text || 'Ausnahme');
    if (m.method === 'Log.entryAdded' && m.params?.entry?.level === 'error')
      fehler.push(m.params.entry.text + (m.params.entry.url ? ' — ' + m.params.entry.url : ''));
  };
  const ruf = (method, params = {}) => new Promise(res => {
    const id = ++n; offen.set(id, res); ws.send(JSON.stringify({ id, method, params })); });

  await ruf('Page.enable'); await ruf('Runtime.enable'); await ruf('Log.enable');
  /* Feste Fenstergröße — sonst misst jeder Rechner etwas anderes.
     Unter 520 px liefert Chrome nur einen Ausschnitt, nie schmaler prüfen. */
  await ruf('Emulation.setDeviceMetricsOverride',
    { width: breite, height: hoehe, deviceScaleFactor: 1, mobile: breite < 768 });

  return {
    async werte(ausdruck) {
      const r = await ruf('Runtime.evaluate',
        { expression: ausdruck, returnByValue: true, awaitPromise: true });
      if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description
        || r.result.exceptionDetails.text);
      return r.result.result.value;
    },
    warte: ms => new Promise(r => setTimeout(r, ms)),
    async bild(pfad) {
      const r = await ruf('Page.captureScreenshot', { format: 'png' });
      writeFileSync(pfad, Buffer.from(r.result.data, 'base64'));
      return pfad;
    },
    /* Alles, was die Seite an Fehlern gemeldet hat, seit sie geöffnet wurde. */
    fehlerAufSeite() { return fehler.slice(); },
    async zu() { ws.close(); await fetch(`http://127.0.0.1:${port}/json/close/${ziel.id}`); },
  };
}

/* ---- kleine Behauptungssammlung ---- */
const ergebnisse = [];
export function pruefe(name, bedingung, zusatz = '') {
  ergebnisse.push({ name, ok: !!bedingung, zusatz });
  console.log(`${bedingung ? '  ok  ' : ' FEHL '} ${name}${zusatz ? '  — ' + zusatz : ''}`);
}
export function bericht() {
  const schlecht = ergebnisse.filter(e => !e.ok);
  console.log(`\n${ergebnisse.length - schlecht.length} von ${ergebnisse.length} bestanden`);
  if (schlecht.length) { process.exitCode = 1; }
  return schlecht.length === 0;
}
```

- [ ] **Schritt 2: `tests/server.mjs` anlegen — Netlify nachbauen**

Wichtig: Netlify schreibt `/welt/xy` auf `/welt.html` um und liefert **Status 200**, nicht 301.
Wer das nicht nachbaut, testet etwas anderes als das, was live passiert.

```js
/* Netlify-Nachbau: statische Dateien plus die Umschreibungen aus _redirects. */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';

const TYPEN = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8',
  '.js':'text/javascript; charset=utf-8', '.mjs':'text/javascript; charset=utf-8',
  '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png',
  '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.webp':'image/webp', '.gif':'image/gif',
  '.woff2':'font/woff2', '.txt':'text/plain; charset=utf-8' };

async function regeln(wurzel) {
  try {
    const roh = await readFile(join(wurzel, '_redirects'), 'utf8');
    return roh.split('\n').map(z => z.trim())
      .filter(z => z && !z.startsWith('#'))
      .map(z => { const [von, nach, code] = z.split(/\s+/); return { von, nach, code: +(code || 301) }; });
  } catch { return []; }
}

export async function starteServer({ wurzel, port = 8901 }) {
  const liste = await regeln(wurzel);

  const s = createServer(async (req, res) => {
    const pfad = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let datei = join(wurzel, pfad);

    try { if ((await stat(datei)).isDirectory()) datei = join(datei, 'index.html'); }
    catch {
      /* keine Datei -> Umschreibungen durchgehen, wie Netlify es tut */
      const treffer = liste.find(r => {
        const muster = '^' + r.von.replace(/:[A-Za-z_]+/g, '[^/]+').replace(/\*/g, '.*') + '$';
        return new RegExp(muster).test(pfad);
      });
      if (treffer && treffer.code === 200) datei = join(wurzel, treffer.nach);
      else if (treffer) { res.writeHead(treffer.code, { Location: treffer.nach }); return res.end(); }
      else datei = join(wurzel, '404.html');
    }

    try {
      const inhalt = await readFile(datei);
      res.writeHead(datei.endsWith('404.html') ? 404 : 200,
        { 'Content-Type': TYPEN[extname(datei)] || 'application/octet-stream' });
      res.end(inhalt);
    } catch { res.writeHead(404); res.end('weg'); }
  });

  await new Promise(r => s.listen(port, r));
  return { port, beenden: () => s.close() };
}
```

- [ ] **Schritt 3: `tests/pruefe-bestand.mjs` anlegen — Gerüst gegen die heutige Seite beweisen**

```js
import { starteChrome, oeffne, pruefe, bericht } from './chrome.mjs';
import { starteServer } from './server.mjs';

const wurzel = new URL('../HOCHLADEN/', import.meta.url).pathname;
const server = await starteServer({ wurzel, port: 8901 });
const chrome = await starteChrome({});

const s = await oeffne('http://127.0.0.1:8901/');
await s.warte(2500);
const d = JSON.parse(await s.werte(`JSON.stringify({
  titel: document.title,
  /* NICHT document.fonts.check() benutzen: das findet auch Schriften, die
     auf dem Rechner installiert sind. Auf Lucas' Mac liegt eine Schrift
     namens "Tropi Land" — die Prüfung meldete deshalb auch dann Erfolg,
     wenn fonts.css gar nicht geladen war. Stattdessen nachsehen, ob die
     Schrift wirklich aus einer @font-face-Regel der Seite stammt. */
  schrift: [...document.fonts].some(f => f.family === 'Tropi'),
  schriftQuelle: [...document.fonts].length + ' Schriftschnitte aus CSS',
  css: getComputedStyle(document.body).backgroundColor,
  hoehe: document.body.scrollHeight
})`));

pruefe('Seite lädt', d.titel.includes('mausemaus'), d.titel);
pruefe('Schrift Tropi kommt aus fonts.css', d.schrift, d.schriftQuelle);
pruefe('CSS greift (Untergrund nicht weiß)', d.css !== 'rgba(0, 0, 0, 0)' && d.css !== 'rgb(255, 255, 255)', d.css);
pruefe('Seite hat Höhe', d.hoehe > 1000, d.hoehe + ' px');
const f = s.fehlerAufSeite();
pruefe('keine Fehler auf der Seite', f.length === 0, f.join(' | ').slice(0, 200));

await s.zu(); chrome.beenden(); server.beenden();
bericht();
```

- [ ] **Schritt 4: Ausführen — muss bestehen**

```bash
node tests/pruefe-bestand.mjs
```

Erwartet: fünf Zeilen `ok`, dann `5 von 5 bestanden`.
Falls „CSS greift" fehlschlägt: Die Datei wurde als `file://` geöffnet statt über den Server,
oder `_redirects` fängt Anfragen ab, die es nicht sollte.

- [ ] **Schritt 5: `.gitignore` ergänzen**

```
.DS_Store
.superpowers/
node_modules/
tests/.profil/
tests/bilder/
```

- [ ] **Schritt 6: Festschreiben**

```bash
git add tests .gitignore
git commit -m "Prüfgerüst: Chrome fernsteuern und Netlify nachbauen, ohne fremde Pakete"
```

---

## Aufgabe 2: Farbe für Welten

**Dateien:**
- Datenbank: Spalte `posts.farbe`
- Ändern: `HOCHLADEN/assets/db.js`

**Schnittstellen:**
- Liefert: `mmLoadPosts(slug?)` gibt zusätzlich `farbe` (Text, z. B. `#E8863B`) zurück; `null`
  bedeutet Standardstimmung.

- [ ] **Schritt 1: Sicherung aller drei Tabellen ziehen**

Im Admin unter „Sicherung" die vorhandene Ausfuhr benutzen und die Datei außerhalb des
Projektordners ablegen. **Nicht überspringen** — auch eine additive Spalte wird an einer
laufenden Datenbank vorgenommen.

- [ ] **Schritt 2: Spalte hinzufügen**

```sql
alter table public.posts add column if not exists farbe text;
comment on column public.posts.farbe is
  'Farbstimmung der Welt, z. B. #E8863B. Leer = Standardstimmung wie der Brief.';
```

- [ ] **Schritt 3: Prüfen, dass keine Zeile angefasst wurde**

```sql
select id, slug, title, status, farbe from public.posts order by created_at;
```

Erwartet: beide vorhandenen Zeilen unverändert, `farbe` ist `null`.

- [ ] **Schritt 4: `db.js` — `select=*` liefert die Spalte bereits mit**

`mmLoadPosts` benutzt `select=*`, also kommt `farbe` ohne Codeänderung mit. Nur der
Zwischenspeicher-Schlüssel wird hochgezählt, damit alte Einträge ohne `farbe` nicht kleben
bleiben. In `HOCHLADEN/assets/db.js`:

```js
const CACHE_B = 'mm.posts.v2';
```

- [ ] **Schritt 5: Festschreiben**

```bash
git add HOCHLADEN/assets/db.js
git commit -m "Welten können eine Farbstimmung tragen"
```

---

## Aufgabe 3: Die Zeitleiste als eigenständiges Bauteil

Das Herzstück. Es wird **ohne Datenbank** gebaut und geprüft, damit die Mechanik gesichert ist,
bevor echte Inhalte dazukommen.

**Dateien:**
- Neu: `HOCHLADEN/assets/leiste.css`
- Neu: `HOCHLADEN/assets/leiste.js`
- Neu: `tests/feste/leiste-probe.html`
- Neu: `tests/pruefe-leiste.mjs`

**Schnittstellen:**
- Liefert: `window.mmLeiste(wurzelElement, abschnitte, {scroller})` →
  `{neuBerechnen(), zerstoeren()}`.
  `abschnitte` ist ein Feld aus `{id, titel, art, farbe, element}` mit `art` ∈ `'beruflich'|'persoenlich'|'kontakt'`.
  `element` ist der DOM-Knoten des Abschnitts im Brief.

- [ ] **Schritt 1: Prüfseite `tests/feste/leiste-probe.html` anlegen**

Feste Abschnitte, keine Datenbank, keine Netzabfragen.

```html
<!doctype html>
<meta charset="utf-8">
<title>Leiste — Prüfseite</title>
<link rel="stylesheet" href="/assets/fonts.css">
<link rel="stylesheet" href="/assets/leiste.css">
<style>
  body { margin:0; font-family:'Space Grotesk',sans-serif; }
  .buehne { display:flex; height:100vh; }
  .scroller { flex:1; overflow-y:auto; background:#FBFAF6; }
  .sp { max-width:520px; margin:0 auto; padding:56px 26px 210px; }
  .sp p { font-size:16.5px; line-height:1.8; margin:0 0 20px; }
  /* Der Scroll-Spielraum kommt aus Text, NICHT aus einem großen
     padding-bottom: Leerraum hinter dem letzten Abschnitt bläht
     scroller.scrollHeight auf, und dann bleibt das halbe Gleis leer. */
</style>
<div class="buehne">
  <div id="leiste"></div>
  <div class="scroller" id="scroller">
    <div class="sp" id="sp">
      <section data-titel="Hallo" data-art="persoenlich"><p>Eins. Ein kurzer Abschnitt zum Anfang.</p></section>
      <section data-titel="Wie ich angefangen hab" data-art="persoenlich"><p>Zwei. Etwas mehr Text, damit dieser Abschnitt länger wird als der erste und die Leiste etwas zu tun bekommt beim Verteilen der Etiketten.</p><p>Noch ein Absatz dazu.</p></section>
      <section data-titel="The Race — Staffel 3" data-art="beruflich" data-farbe="#3E5A78"><p>Drei. Ein beruflicher Abschnitt mit Farbe.</p></section>
      <section data-titel="Das Werkzeug, das ich mir gebaut habe" data-art="beruflich" data-farbe="#6E6E7A"><p>Vier. Ein sehr langer Titel, der umbrechen muss und nicht abgeschnitten werden darf.</p><p>Zweiter Absatz.</p></section>
      <section data-titel="Bastian Keller" data-art="beruflich" data-farbe="#8E4E9B"><p>Fünf. Kurz.</p></section>
      <section data-titel="Simplicissimus" data-art="beruflich" data-farbe="#A8913F"><p>Sechs. Auch kurz.</p></section>
      <section data-titel="Blender" data-art="persoenlich"><p>Sieben. Ein mittellanger Abschnitt, damit die Balken unterschiedlich hoch werden und die Etiketten etwas zu verteilen haben.</p></section>
      <section data-titel="Woher der Name kommt" data-art="persoenlich"><p>Acht. Auch dieser Abschnitt hat mehrere Zeilen, damit die Prüfseite den echten Seitenverhältnissen ähnelt.</p><p>Zweiter Absatz dazu.</p></section>
      <section data-titel="Schreib mir" data-art="kontakt" data-farbe="#BFCC94">
        <p>Neun. Der Schluss.</p>
        <p>Dieser letzte Abschnitt ist bewusst lang, damit die Seite genug Scroll-Spielraum hat, ohne dass hinter dem letzten Abschnitt leerer Raum steht.</p>
        <p>Stünde dort nur Leerraum, bliebe ein großer Teil des Gleises ungefüllt — die Balken werden gegen die gesamte scrollbare Höhe gerechnet, und Leerraum zählt dabei mit.</p>
        <p>Deshalb steht hier Text statt Polsterung. So bildet die Prüfseite ab, wie die echte Seite aussieht, auf der hinter dem Kontaktteil ebenfalls kaum Leerraum steht.</p>
        <p>Noch ein Absatz, damit der Spielraum sicher reicht.</p>
        <p>Und noch einer.</p>
      </section>
    </div>
  </div>
</div>
<script src="/assets/leiste.js"></script>
<script>
  const abschnitte = [...document.querySelectorAll('#sp section')].map((el, i) => ({
    id: 'a' + i, titel: el.dataset.titel, art: el.dataset.art,
    farbe: el.dataset.farbe || null, element: el,
  }));
  window.__leiste = window.mmLeiste(document.getElementById('leiste'), abschnitte,
    { scroller: document.getElementById('scroller') });
</script>
```

- [ ] **Schritt 2: Prüfung `tests/pruefe-leiste.mjs` schreiben — muss zuerst fehlschlagen**

```js
import { starteChrome, oeffne, pruefe, bericht } from './chrome.mjs';
import { starteServer } from './server.mjs';

const wurzel = new URL('../HOCHLADEN/', import.meta.url).pathname;
const server = await starteServer({ wurzel, port: 8902 });
const chrome = await starteChrome({ port: 9334 });
const s = await oeffne('http://127.0.0.1:8902/tests-feste/leiste-probe.html',
  { port: 9334, breite: 1280, hoehe: 900 });
await s.warte(1200);

/* --- Aufbau --- */
const a = JSON.parse(await s.werte(`(() => {
  const segs=[...document.querySelectorAll('.mml-seg')];
  const ets=[...document.querySelectorAll('.mml-et')];
  const eb=ets.map(e=>e.getBoundingClientRect());
  let ueberlappt=0;
  for(let i=1;i<eb.length;i++) if(eb[i].top-eb[i-1].bottom < 0) ueberlappt++;
  const luecken=[]; const sb=segs.map(x=>x.getBoundingClientRect());
  for(let i=1;i<sb.length;i++) luecken.push(Math.round(sb[i].top-sb[i-1].bottom));
  return JSON.stringify({
    segmente: segs.length, etiketten: ets.length, ueberlappt, luecken,
    abgeschnitten: ets.filter(e=>{const b=e.querySelector('.mml-titel');
      return b.scrollWidth > b.clientWidth + 1;}).length,
    etBreiten: [...new Set(ets.map(e=>Math.round(e.getBoundingClientRect().width)))],
    kurve: getComputedStyle(document.querySelector('.mml')).transitionTimingFunction,
    dauer: getComputedStyle(document.querySelector('.mml')).transitionDuration
  });
})()`));

pruefe('neun Segmente', a.segmente === 9, String(a.segmente));
pruefe('neun Etiketten', a.etiketten === 9, String(a.etiketten));
pruefe('keine Etiketten überlappen', a.ueberlappt === 0, a.ueberlappt + ' Überlappungen');
pruefe('kein Titel abgeschnitten', a.abgeschnitten === 0, a.abgeschnitten + ' abgeschnitten');
pruefe('Segmente haben Abstand (nicht lückenlos)', a.luecken.every(l => l >= 4 && l <= 9), a.luecken.join(','));
pruefe('Etiketten haben feste Breite', a.etBreiten.length === 1 && a.etBreiten[0] === 172, a.etBreiten.join(','));
pruefe('Kurve wie festgelegt', a.kurve.replace(/\s/g,'') === 'cubic-bezier(0.5,0,0.12,1)', a.kurve);
pruefe('Dauer 860 ms', a.dauer === '0.86s', a.dauer);

/* Das Gleis muss weitgehend belegt sein. Steht hinter dem letzten Abschnitt
   viel Leerraum, bleibt ein großer Teil der Leiste ungenutzt. */
const fuellung = JSON.parse(await s.werte(`(() => {
  const g = document.querySelector('.mml-gleis').getBoundingClientRect();
  const belegt = [...document.querySelectorAll('.mml-seg')]
    .reduce((n, x) => n + x.getBoundingClientRect().height, 0);
  return JSON.stringify({ anteil: Math.round(belegt / g.height * 100) });
})()`));
pruefe('das Gleis ist zu mindestens 85 % belegt', fuellung.anteil >= 85, fuellung.anteil + ' %');

/* --- Pacing: 760 ms halten, dann zu --- */
await s.werte(`document.getElementById('scroller').scrollTo({top:600,behavior:'instant'})`);
await s.warte(300);
pruefe('nach 300 ms noch offen',
  !JSON.parse(await s.werte(`document.querySelector('.mml').classList.contains('mml-zu')`)));
await s.warte(900);
pruefe('nach 1200 ms zugeklappt',
  JSON.parse(await s.werte(`document.querySelector('.mml').classList.contains('mml-zu')`)));

/* --- Hochscrollen öffnet sofort --- */
await s.werte(`document.getElementById('scroller').scrollTo({top:200,behavior:'instant'})`);
await s.warte(120);
pruefe('Hochscrollen öffnet ohne Warten',
  !JSON.parse(await s.werte(`document.querySelector('.mml').classList.contains('mml-zu')`)));

/* --- DER FEHLER, den der Auftraggeber gemeldet hat ---
   Wichtig: Der Klick muss NACH UNTEN springen. Ein Sprung nach oben wird
   ohnehin vom Zweig "hochscrollen = navigieren" aufgefangen und beweist
   über die Sperren gar nichts. Erst ein Sprung nach unten löst dieselbe
   Bedingung aus wie echtes Wegscrollen. */
await s.werte(`document.getElementById('scroller').scrollTo({top:200,behavior:'instant'})`);
await s.warte(200);
const zielIndex = JSON.parse(await s.werte(`(() => {
  const sc = document.getElementById('scroller');
  const ab = [...document.querySelectorAll('#sp section')];
  for (let i = ab.length - 1; i >= 0; i--)
    if (ab[i].offsetTop > sc.scrollTop + 400) return i;
  return -1;
})()`));
pruefe('es gibt einen Abschnitt weiter unten zum Anspringen', zielIndex > 0, 'Index ' + zielIndex);

await s.werte(`document.querySelector('.mml').dispatchEvent(new MouseEvent('mouseenter'))`);
await s.warte(150);
await s.werte(`document.querySelectorAll('.mml-et')[${zielIndex}].click()`);
await s.warte(1700);
const nachKlick = JSON.parse(await s.werte(`JSON.stringify({
  zu: document.querySelector('.mml').classList.contains('mml-zu'),
  stand: document.getElementById('scroller').scrollTop
})`));
pruefe('der Klick ist wirklich nach unten gesprungen', nachKlick.stand > 400, 'bei ' + nachKlick.stand + ' px');
pruefe('Klick in der Leiste klappt sie NICHT zu (Zeiger ist noch drin)', !nachKlick.zu);

/* Dasselbe über einen Klick auf den Balken statt auf das Etikett. */
await s.werte(`document.getElementById('scroller').scrollTo({top:200,behavior:'instant'})`);
await s.warte(200);
await s.werte(`document.querySelector('.mml').dispatchEvent(new MouseEvent('mouseenter'))`);
await s.werte(`document.querySelectorAll('.mml-seg')[${zielIndex}].click()`);
await s.warte(1700);
pruefe('auch ein Klick auf den Balken klappt sie nicht zu',
  !JSON.parse(await s.werte(`document.querySelector('.mml').classList.contains('mml-zu')`)));

/* --- Maus raus: 1100 ms warten, dann zu --- */
await s.werte(`document.querySelector('.mml').dispatchEvent(new MouseEvent('mouseleave'))`);
await s.warte(400);
pruefe('nach Mausaustritt erst noch offen',
  !JSON.parse(await s.werte(`document.querySelector('.mml').classList.contains('mml-zu')`)));
await s.warte(1000);
pruefe('nach 1400 ms zugeklappt',
  JSON.parse(await s.werte(`document.querySelector('.mml').classList.contains('mml-zu')`)));

await s.zu(); chrome.beenden(); server.beenden();
bericht();
```

- [ ] **Schritt 3: Prüfseite erreichbar machen**

Der Server liefert nur aus `HOCHLADEN/`. Die Prüfseite darf **nicht** mit hochgeladen werden.
Lösung: in `tests/pruefe-leiste.mjs` vor dem Start eine Verknüpfung anlegen und danach entfernen.
Ganz oben in der Datei, direkt nach den Einfuhren:

```js
import { symlinkSync, rmSync, existsSync } from 'node:fs';
const feste = new URL('../HOCHLADEN/tests-feste', import.meta.url).pathname;
if (existsSync(feste)) rmSync(feste, { recursive: true, force: true });
symlinkSync(new URL('./feste', import.meta.url).pathname, feste, 'dir');
process.on('exit', () => rmSync(feste, { recursive: true, force: true }));
```

Und in `.gitignore` ergänzen:

```
HOCHLADEN/tests-feste
```

- [ ] **Schritt 4: Ausführen — muss fehlschlagen**

```bash
node tests/pruefe-leiste.mjs
```

Erwartet: Abbruch mit „mmLeiste is not a function" oder lauter `FEHL`, weil `leiste.js` fehlt.

- [ ] **Schritt 5: `HOCHLADEN/assets/leiste.css` schreiben**

Alle Namen mit `mml-` vorangestellt, damit nichts mit `site.css` kollidiert.

```css
/* mausemaus — die Zeitleiste. Werte aus dem Entwurfsdokument, nicht raten. */
.mml {
  --mml-dauer: 860ms;
  --mml-kurve: cubic-bezier(.50, 0, .12, 1);
  flex: none; width: 252px; position: relative; background: #FBFAF6;
  border-right: 1px solid #EDEAE1; z-index: 6;
  transition: width var(--mml-dauer) var(--mml-kurve);
}
.mml-zu { width: 64px; }

.mml-marke { font-family:'Tropi',cursive,sans-serif; font-size:21px; line-height:1;
  padding:22px 20px 0; color:#0D1821; white-space:nowrap;
  transition: opacity var(--mml-dauer) var(--mml-kurve); }
.mml-marke em { font-style:normal; color:#BFCC94; }
.mml-zu .mml-marke { opacity:0; }
.mml-mini { position:absolute; top:23px; left:0; width:64px; text-align:center; opacity:0;
  font-family:'Tropi',cursive,sans-serif; font-size:22px; color:#0D1821;
  transition: opacity var(--mml-dauer) var(--mml-kurve); }
.mml-zu .mml-mini { opacity:1; }

.mml-gleis { position:absolute; left:28px; top:74px; bottom:82px; width:8px;
  border-radius:99px; background:#E9E6DC; }
/* Segmente mit Abstand und abgerundet — lückenlos wurde geprüft und abgelehnt. */
.mml-seg { position:absolute; left:0; width:8px; border-radius:99px; cursor:pointer; }
.mml-seg:after { content:''; position:absolute; left:-10px; right:-10px; top:0; bottom:0; }

.mml-etiketten { position:absolute; inset:0; pointer-events:none; }
.mml-et { position:absolute; left:52px; width:172px; padding:5px 9px; border-radius:6px;
  display:flex; gap:8px; align-items:flex-start; pointer-events:auto; cursor:pointer;
  transition: background .16s, transform .16s, opacity var(--mml-dauer) var(--mml-kurve); }
.mml-punkt { width:6px; height:6px; border-radius:50%; margin-top:5.5px; flex:none; }
.mml-titel { font-family:'Space Grotesk',sans-serif; font-weight:500; font-size:12.5px;
  line-height:1.32; color:#5b625f; min-width:0; }
.mml-et:hover { background:#F2EFE6; transform:translateX(2px); }
.mml-et:hover .mml-titel { color:#0D1821; }
.mml-et.mml-jetzt { background:#EFEDE2; }
.mml-et.mml-jetzt .mml-titel { color:#0D1821; font-weight:600; }

.mml-fuehrung { position:absolute; width:1px; background:#DAD6CA;
  transition: opacity var(--mml-dauer) var(--mml-kurve); }

.mml-kopf { position:absolute; left:22.5px; width:19px; height:19px; margin-top:-9.5px;
  z-index:5; pointer-events:none; }
.mml-rund { position:absolute; left:5px; top:5px; width:9px; height:9px; border-radius:50%;
  background:#0D1821; box-shadow:0 0 0 4.5px #FBFAF6, 0 0 0 6px rgba(13,24,33,.22); }
.mml-zeit { position:absolute; left:196px; top:2.5px; width:44px; text-align:right;
  font-family:'Space Mono',monospace; font-size:9px; color:#B3AFA2;
  font-variant-numeric: tabular-nums;
  transition: opacity var(--mml-dauer) var(--mml-kurve); }
.mml-sicht { position:absolute; left:26.5px; width:11px; border-radius:99px;
  background:rgba(13,24,33,.055); z-index:3; pointer-events:none; }

.mml-fuss { position:absolute; bottom:24px; left:28px;
  transition: opacity var(--mml-dauer) var(--mml-kurve); }
.mml-fuss div { display:flex; align-items:center; gap:7px; margin-bottom:5px;
  font-family:'Space Grotesk',sans-serif; font-size:9.5px; line-height:1.4; color:#A8A398; }
.mml-fuss span { width:8px; height:8px; border-radius:99px; }

.mml-griff { position:absolute; bottom:22px; right:11px; width:23px; height:23px;
  border-radius:7px; background:#F2EFE6; color:#9A9689; cursor:pointer; z-index:9;
  display:flex; align-items:center; justify-content:center;
  font-family:'Space Mono',monospace; font-size:11px;
  transition: right var(--mml-dauer) var(--mml-kurve), background .15s, color .15s; }
.mml-griff:hover { background:#BFCC94; color:#0D1821; }

.mml-zu .mml-et, .mml-zu .mml-fuehrung, .mml-zu .mml-fuss, .mml-zu .mml-zeit {
  opacity:0; pointer-events:none; }
.mml-zu .mml-griff { right:-11.5px; }

/* Wer weniger Bewegung eingestellt hat, bekommt keine. */
@media (prefers-reduced-motion: reduce) {
  .mml, .mml *, .mml-et, .mml-griff { transition-duration: 1ms !important; }
}
```

- [ ] **Schritt 6: `HOCHLADEN/assets/leiste.js` schreiben**

```js
/* mausemaus — Zeitleiste. Weiß nichts von Projekten, Supabase oder dem Brief:
   sie bekommt eine Liste von Abschnitten und einen Scroll-Bereich, sonst nichts. */
(() => {
  const HALTEN = 760;      // wie lang sie nach Scrollbeginn noch offen bleibt
  const NACH_MAUS = 1100;  // wie lang sie nach Mausaustritt noch offen bleibt
  const SCHWELLE = 120;    // ab wie viel Scrollen sie überhaupt zugeht
  const LUFT = 8;          // Mindestabstand zwischen zwei Etiketten
  const BLASS = '#D6D3C4';
  const LAENGE = 214;      // Sekunden, auf die der Timecode abgebildet wird

  window.mmLeiste = function (wurzel, abschnitte, { scroller }) {
    wurzel.className = 'mml';
    wurzel.innerHTML =
      '<div class="mml-marke">mausemaus<em>.</em></div>' +
      '<div class="mml-mini">m</div>' +
      '<div class="mml-gleis"></div>' +
      '<div class="mml-sicht"></div>' +
      '<div class="mml-etiketten"></div>' +
      '<div class="mml-kopf"><div class="mml-rund"></div><div class="mml-zeit">00:00</div></div>' +
      '<div class="mml-fuss">' +
        '<div><span style="background:#3E5A78"></span>berufliche Projekte</div>' +
        '<div><span style="background:' + BLASS + '"></span>persönliches</div>' +
      '</div>' +
      '<div class="mml-griff" title="offen halten">‹</div>';

    const gleis = wurzel.querySelector('.mml-gleis'),
          lage  = wurzel.querySelector('.mml-etiketten'),
          kopf  = wurzel.querySelector('.mml-kopf'),
          zeit  = wurzel.querySelector('.mml-zeit'),
          sicht = wurzel.querySelector('.mml-sicht'),
          griff = wurzel.querySelector('.mml-griff');

    let etiketten = [], angepinnt = false, uhr = null,
        letzterStand = 0, zeigerDrin = false, springtGerade = 0;

    const gh = () => gleis.getBoundingClientRect().height;
    const gt = () => gleis.offsetTop;   // gleis liegt in .mml (position:relative) — hier stimmt offsetTop
    const stopUhr = () => { clearTimeout(uhr); uhr = null; };

    /* ACHTUNG: element.offsetTop zählt ab dem nächsten POSITIONIERTEN Vorfahren,
       nicht ab dem Scroll-Bereich. Auf dem Handy scrollt das Fenster statt des
       Kastens, und dann stimmt offsetTop nicht mehr. Deshalb immer über die
       tatsächliche Lage rechnen — das gilt in beiden Fällen. */
    const amFenster = () => scroller === document.scrollingElement;
    const obenVon = el => amFenster()
      ? el.getBoundingClientRect().top + window.scrollY
      : el.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
    const hoeheVon = el => el.getBoundingClientRect().height;
    const standVon = () => amFenster() ? window.scrollY : scroller.scrollTop;

    function zumachen() { if (!angepinnt && !zeigerDrin) wurzel.classList.add('mml-zu'); }
    function aufmachen() { wurzel.classList.remove('mml-zu'); }

    /* Klick auf Etikett oder Segment: springen, ohne dass das Scrollen
       als Nutzer-Scrollen gewertet wird — sonst klappt die Leiste zu. */
    function springe(el) {
      springtGerade = Date.now();
      const ziel = Math.max(0, obenVon(el) - 16);
      if (amFenster()) window.scrollTo({ top: ziel, behavior: 'smooth' });
      else scroller.scrollTo({ top: ziel, behavior: 'smooth' });
    }

    function bauen() {
      gleis.querySelectorAll('.mml-seg').forEach(s => s.remove());
      lage.innerHTML = ''; etiketten = [];
      const ganz = scroller.scrollHeight, H = gh(), T = gt(), mitten = [];

      abschnitte.forEach(ab => {
        const s = document.createElement('div');
        s.className = 'mml-seg';
        const o = obenVon(ab.element) / ganz * 100;
        const h = Math.max(2.2, hoeheVon(ab.element) / ganz * 100);
        s.style.top = o + '%'; s.style.height = h + '%';
        s.style.background = ab.farbe || BLASS;
        s.onclick = () => springe(ab.element);
        gleis.appendChild(s);
        mitten.push(T + (o + h / 2) / 100 * H);
      });

      abschnitte.forEach(ab => {
        const e = document.createElement('div');
        e.className = 'mml-et';
        e.innerHTML = '<span class="mml-punkt" style="background:' + (ab.farbe || BLASS) + '"></span>' +
                      '<span class="mml-titel"></span>';
        e.querySelector('.mml-titel').textContent = ab.titel;
        e.onclick = () => springe(ab.element);
        lage.appendChild(e); etiketten.push(e);
      });

      /* Etiketten stoßen sich ab: erst nach unten durchschieben, dann,
         falls es unten rausläuft, von hinten wieder zurück. */
      const hh = etiketten.map(e => e.getBoundingClientRect().height);
      const z = mitten.map((m, i) => m - hh[i] / 2);
      const OBEN = T - 4, UNTEN = T + H + 4;
      for (let i = 1; i < z.length; i++) {
        const min = z[i - 1] + hh[i - 1] + LUFT;
        if (z[i] < min) z[i] = min;
      }
      if (z[z.length - 1] + hh[hh.length - 1] > UNTEN) {
        z[z.length - 1] = UNTEN - hh[hh.length - 1];
        for (let i = z.length - 2; i >= 0; i--) {
          const max = z[i + 1] - hh[i] - LUFT;
          if (z[i] > max) z[i] = max;
        }
      }
      if (z[0] < OBEN) z[0] = OBEN;

      etiketten.forEach((e, i) => {
        e.style.top = z[i] + 'px';
        const eigen = z[i] + hh[i] / 2, weg = eigen - mitten[i];
        if (Math.abs(weg) > 7) {
          const f = document.createElement('div');
          f.className = 'mml-fuehrung';
          f.style.left = '40px';
          f.style.top = Math.min(eigen, mitten[i]) + 'px';
          f.style.height = Math.abs(weg) + 'px';
          lage.appendChild(f);
        }
      });
    }

    const mmss = f => {
      const s = Math.round(f * LAENGE);
      return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
    };

    function aktualisieren() {
      const stand = standVon();
      const max = scroller.scrollHeight - scroller.clientHeight;
      const f = max > 0 ? Math.min(1, stand / max) : 0;
      const anteil = stand / scroller.scrollHeight;
      const sichtbar = scroller.clientHeight / scroller.scrollHeight;

      kopf.style.top = (gt() + anteil * gh()) + 'px';
      sicht.style.top = (gt() + anteil * gh()) + 'px';
      sicht.style.height = (sichtbar * gh()) + 'px';
      zeit.textContent = mmss(f);

      const mitte = stand + scroller.clientHeight * 0.45;
      let akt = 0;
      abschnitte.forEach((ab, i) => { if (obenVon(ab.element) <= mitte) akt = i; });
      /* Der letzte Abschnitt kann nie bis zur Schwelle hochscrollen,
         weil darunter kein Text mehr kommt — also ganz unten immer er. */
      if (max > 0 && stand >= max - 4) akt = abschnitte.length - 1;
      etiketten.forEach((e, i) => e.classList.toggle('mml-jetzt', i === akt));

      const runter = stand > letzterStand;
      letzterStand = stand;

      if (angepinnt) return;
      /* Zeiger in der Leiste -> niemals von selbst zuklappen.
         Ohne diese Sperre klappte die Leiste zu, sobald man in ihr ein
         Projekt anklickte: das ausgelöste Scrollen zählte als "runter". */
      if (zeigerDrin) { stopUhr(); return; }
      /* Ein durch Klick ausgelöster Sprung ist kein Nutzer-Scrollen. */
      if (Date.now() - springtGerade < 900) return;

      if (stand <= SCHWELLE) { stopUhr(); aufmachen(); return; }
      if (runter) {
        if (!wurzel.classList.contains('mml-zu') && !uhr)
          uhr = setTimeout(() => { uhr = null; zumachen(); }, HALTEN);
      } else { stopUhr(); aufmachen(); }   // hochscrollen = navigieren
    }

    const rein  = () => { zeigerDrin = true;  stopUhr(); aufmachen(); };
    const raus  = () => {
      zeigerDrin = false; stopUhr();
      if (!angepinnt && standVon() > SCHWELLE)
        uhr = setTimeout(() => { uhr = null; zumachen(); }, NACH_MAUS);
    };
    wurzel.addEventListener('mouseenter', rein);
    wurzel.addEventListener('mouseleave', raus);
    griff.onclick = () => {
      angepinnt = !angepinnt; griff.textContent = angepinnt ? '›' : '‹';
      stopUhr(); if (angepinnt) aufmachen();
    };
    /* Scrollt das Fenster, hängt das Ereignis am Fenster — nicht am Element. */
    const wo = amFenster() ? window : scroller;
    wo.addEventListener('scroll', aktualisieren, { passive: true });
    const beiGroesse = () => { bauen(); aktualisieren(); };
    window.addEventListener('resize', beiGroesse);

    bauen(); aktualisieren();

    return {
      neuBerechnen: beiGroesse,
      zerstoeren() {
        stopUhr();
        wurzel.removeEventListener('mouseenter', rein);
        wurzel.removeEventListener('mouseleave', raus);
        wo.removeEventListener('scroll', aktualisieren);
        window.removeEventListener('resize', beiGroesse);
        wurzel.innerHTML = '';
      },
    };
  };
})();
```

- [ ] **Schritt 7: Ausführen — muss jetzt vollständig bestehen**

```bash
node tests/pruefe-leiste.mjs
```

Erwartet: `18 von 18 bestanden`. Besonders die Zeilen
*„Klick in der Leiste klappt sie NICHT zu"* und *„auch ein Klick auf den Balken klappt sie
nicht zu"* — das ist der gemeldete Fehler.

**Beweise, dass diese Prüfung wirklich anschlägt:** Entferne in einer Kopie außerhalb des
Projektordners die Sperre `if (zeigerDrin) { stopUhr(); return; }` aus `leiste.js` und lass
die Prüfung erneut laufen. Sie **muss** dann fehlschlagen. Tut sie es nicht, prüft sie den
Fehler nicht — genau das war bei einer früheren Fassung dieser Prüfung der Fall: Sie klickte
ein Etikett an, das **oberhalb** der aktuellen Stelle lag, sprang also nach oben und wurde vom
Zweig „hochscrollen = navigieren" aufgefangen, ganz ohne die Sperren.

- [ ] **Schritt 8: Festschreiben**

```bash
git add HOCHLADEN/assets/leiste.js HOCHLADEN/assets/leiste.css tests .gitignore
git commit -m "Zeitleiste als eigenständiges Bauteil, mit Pacing und behobenem Zuklapp-Fehler"
```

---

## Aufgabe 4: Abschnitte aus vorhandenen Daten

**Dateien:**
- Neu: `HOCHLADEN/assets/brief.js`
- Neu: `tests/pruefe-brief.mjs`

**Schnittstellen:**
- Nutzt: `mmLoadProjects()`, `mmLoadSettings()` aus `db.js`; `window.mm.renderMarkdown`,
  `window.mm.videoEmbed` aus `shared.js`; `window.mmLeiste` aus `leiste.js`.
- Liefert: `window.mmBrief(zielElement, {settings, projekte}) → abschnitte[]` im Format,
  das `mmLeiste` erwartet.

- [ ] **Schritt 1: Prüfung schreiben — sie sichert vor allem, dass nichts umgeschrieben wird**

```js
import { starteChrome, oeffne, pruefe, bericht } from './chrome.mjs';
import { starteServer } from './server.mjs';

const wurzel = new URL('../HOCHLADEN/', import.meta.url).pathname;
const server = await starteServer({ wurzel, port: 8903 });
const chrome = await starteChrome({ port: 9335 });
const s = await oeffne('http://127.0.0.1:8903/', { port: 9335 });
await s.warte(3000);

const d = JSON.parse(await s.werte(`(async () => {
  const projekte = (await window.mmLoadProjects()).filter(p => p.status === 'published');
  const abschnitte = [...document.querySelectorAll('#brief section')];
  const text = document.body.innerText;
  return JSON.stringify({
    projekte: projekte.length,
    abschnitte: abschnitte.length,
    /* jeder Projekttext muss WÖRTLICH auf der Seite stehen */
    fehlendeTexte: projekte.filter(p => p.summary && !text.includes(p.summary.trim()))
                           .map(p => p.slug),
    fehlendeTitel: projekte.filter(p => !text.includes(p.title)).map(p => p.slug),
    /* jedes Coverbild muss vorkommen */
    fehlendeBilder: projekte.filter(p => p.cover_url &&
        !document.querySelector('img[src="'+p.cover_url+'"]')).map(p => p.slug),
    leiste: document.querySelectorAll('.mml-seg').length,
    beruflich: document.querySelectorAll('.mml-seg').length -
               [...document.querySelectorAll('.mml-punkt')]
                 .filter(x => getComputedStyle(x).backgroundColor === 'rgb(214, 211, 196)').length
  });
})()`));

pruefe('fünf veröffentlichte Projekte gefunden', d.projekte === 5, String(d.projekte));
pruefe('Abschnitte = Einstieg + Profil + Projekte + Kontakt', d.abschnitte === d.projekte + 3, String(d.abschnitte));
pruefe('KEIN Projekttext wurde verändert', d.fehlendeTexte.length === 0, d.fehlendeTexte.join(','));
pruefe('KEIN Projekttitel wurde verändert', d.fehlendeTitel.length === 0, d.fehlendeTitel.join(','));
pruefe('KEIN Coverbild fehlt', d.fehlendeBilder.length === 0, d.fehlendeBilder.join(','));

/* Alles, was auf der alten Startseite stand, muss auch im Brief stehen.
   Ohne diese Prüfung verschwinden Eckdaten, Werkzeugliste und Kundenliste
   still — sie hängen nicht an den Projekten, sondern an den Einstellungen. */
const alt = JSON.parse(await s.werte(`(async () => {
  const e = await window.mmLoadSettings();
  const text = document.body.innerText;
  const fehlt = [];
  (e.infos || []).forEach(i => { if (i.zeile1 && !text.includes(i.zeile1)) fehlt.push('info:' + i.titel); });
  (e.werkzeuge || []).forEach(w => { if (!text.includes(w.name)) fehlt.push('werkzeug:' + w.name); });
  (e.kunden || []).forEach(k => { if (!text.includes(k)) fehlt.push('kunde:' + k); });
  if (e.profil_text && !text.includes(e.profil_text.slice(0, 40))) fehlt.push('profil_text');
  if (e.hero_intro && !text.includes(e.hero_intro.slice(0, 40))) fehlt.push('hero_intro');
  if (e.email && !text.includes(e.email)) fehlt.push('email');
  if (e.telefon && !text.includes(e.telefon)) fehlt.push('telefon');
  return JSON.stringify({ fehlt });
})()`));
pruefe('KEIN Inhalt der alten Startseite fehlt', alt.fehlt.length === 0, alt.fehlt.join(','));

/* Verweise von Projekten auf Beiträge dürfen nicht verschwinden. */
const verweise = JSON.parse(await s.werte(`(async () => {
  const ps = (await window.mmLoadProjects()).filter(p => p.status === 'published' && p.more_url);
  return JSON.stringify({ soll: ps.map(p => p.more_url),
    ist: [...document.querySelectorAll('.br-mehr a')].map(a => a.getAttribute('href')) });
})()`));
pruefe('Verweise auf Beiträge bleiben erhalten',
  verweise.soll.every(u => verweise.ist.includes(u)),
  'soll ' + verweise.soll.join(',') + ' / ist ' + verweise.ist.join(','));
pruefe('Leiste hat für jeden Abschnitt ein Segment', d.leiste === d.abschnitte, String(d.leiste));

/* Jedes Projekt braucht eine EIGENE Farbe — sonst sind Balken nicht unterscheidbar.
   Aus `accent` abgeleitet wären "The Race" und "Rockstar Selfish" beide sky. */
const farben = JSON.parse(await s.werte(`JSON.stringify(
  [...document.querySelectorAll('.mml-seg')].map(x => getComputedStyle(x).backgroundColor))`));
const beruflich = farben.slice(1, -1);   // ohne Einstieg und Kontakt
pruefe('jedes Projekt hat eine eigene Farbe',
  new Set(beruflich).size === beruflich.length, beruflich.join(' '));

await s.zu(); chrome.beenden(); server.beenden();
bericht();
```

- [ ] **Schritt 2: Ausführen — muss fehlschlagen**

```bash
node tests/pruefe-brief.mjs
```

Erwartet: Fehler, weil `index.html` noch die alte Startseite ist und `#brief` nicht existiert.

- [ ] **Schritt 3: `HOCHLADEN/assets/brief.js` schreiben**

```js
/* mausemaus — setzt den Brief aus dem zusammen, was schon in der Datenbank steht.
   Es wird NICHTS umformuliert: Titel, Texte, Bilder und Videos kommen wörtlich
   aus den Projekten. Verbindende Sätze schreibt Lucas später selbst dazu. */
(() => {
  /* Jedes Projekt bekommt eine eigene Farbe, der Reihe nach.
     NICHT aus `accent` ableiten: dort gibt es nur vier Werte, und
     "The Race" und "Rockstar Selfish" teilen sich beide `sky` — zwei
     gleichfarbige Balken in der Zeitleiste wären unbrauchbar.
     Die Reihenfolge kommt aus `sort_order`, ist also stabil. */
  const FARBEN = ['#3E5A78', '#8E4E9B', '#A8913F', '#6E6E7A', '#7F8F55',
                  '#B5654A', '#4E7F7A', '#8A5A8E'];
  const farbeVon = (p, i) => FARBEN[i % FARBEN.length];

  window.mmBrief = function (ziel, { settings, projekte }) {
    const e = settings || {};
    const abschnitte = [];
    ziel.innerHTML = '';

    const neuerAbschnitt = (titel, art, farbe) => {
      const s = document.createElement('section');
      s.className = 'br-abschnitt';
      ziel.appendChild(s);
      abschnitte.push({ id: 'a' + abschnitte.length, titel, art, farbe: farbe || null, element: s });
      return s;
    };

    /* ---- Einstieg: aus den vorhandenen Startseiten-Texten ---- */
    const eins = neuerAbschnitt('Hallo', 'persoenlich', null);
    eins.innerHTML =
      '<h1 class="br-gruss">' + window.mm.esc(e.hero_line1 || 'Hallo ich bin') +
        '<em>' + window.mm.esc(e.hero_line2 || 'Lucas :)') + '</em></h1>' +
      '<p class="br-kicker">' + window.mm.esc(e.hero_eyebrow || '') + '</p>' +
      '<div class="br-text">' + window.mm.renderMarkdown(e.hero_intro || '') + '</div>' +
      /* Die vier Eckdaten (Basis, Status, Schwerpunkt, Ausbildung) standen auf der
         alten Startseite und dürfen nicht verschwinden. */
      (Array.isArray(e.infos) && e.infos.length
        ? '<dl class="br-infos">' + e.infos.map(i =>
            '<div' + (i.punkt ? ' class="br-punkt"' : '') + '>' +
            '<dt>' + window.mm.esc(i.titel || '') + '</dt>' +
            '<dd>' + window.mm.esc(i.zeile1 || '') +
            (i.zeile2 ? '<span>' + window.mm.esc(i.zeile2) + '</span>' : '') + '</dd></div>').join('') +
          '</dl>'
        : '');

    /* ---- Wer schneidet da: der vorhandene Profiltext samt Werkzeugliste ---- */
    if (e.profil_text || e.profil_titel) {
      const pr = neuerAbschnitt(e.profil_kicker || 'Über mich', 'persoenlich', null);
      pr.innerHTML =
        (e.profil_kicker ? '<p class="br-rolle">' + window.mm.esc(e.profil_kicker) + '</p>' : '') +
        (e.profil_titel
          ? '<h2 class="br-titel">' + window.mm.esc(e.profil_titel).replace(/\n/g, '<br>') + '</h2>'
          : '') +
        (e.profil_text ? '<div class="br-text">' + window.mm.renderMarkdown(e.profil_text) + '</div>' : '') +
        (Array.isArray(e.werkzeuge) && e.werkzeuge.length
          ? '<dl class="br-werkzeuge">' + e.werkzeuge.map(w =>
              '<div><dt>' + window.mm.esc(w.name || '') + '</dt>' +
              '<dd>' + window.mm.esc(w.stufe || '') + '</dd></div>').join('') + '</dl>'
          : '') +
        (Array.isArray(e.kunden) && e.kunden.length
          ? '<p class="br-kunden">' + e.kunden.map(k =>
              '<span>' + window.mm.esc(k) + '</span>').join('') + '</p>'
          : '');
    }

    /* ---- Ein Abschnitt je Projekt, Inhalt unverändert ---- */
    projekte.forEach((p, i) => {
      const s = neuerAbschnitt(p.title, 'beruflich', farbeVon(p, i));
      let h = '';
      if (p.role) h += '<p class="br-rolle">' + window.mm.esc(p.role) + '</p>';
      h += '<h2 class="br-titel">' + window.mm.esc(p.title) +
           (p.is_live ? '<span class="br-laeuft">läuft aktuell</span>' : '') + '</h2>';
      if (p.summary) h += '<div class="br-text">' + window.mm.renderMarkdown(p.summary) + '</div>';

      /* Das Coverbild ist immer sichtbar und dient als Vorschaubild.
         Einbettbare Videos laden erst beim Klick — sonst holt die Startseite
         fünf fremde Abspieler auf einmal. Nicht einbettbare (z. B. "The Race"
         bei Joyn, `embed_ok = false`) führen nach außen. */
      if (p.cover_url) {
        const einbettbar = p.link_url && p.embed_ok !== false;
        h += '<figure class="br-bild' + (einbettbar ? ' br-spielbar' : '') + '"' +
             (einbettbar ? ' data-video="' + window.mm.esc(p.link_url) + '"' : '') + '>' +
             '<img src="' + window.mm.esc(p.cover_url) + '" alt="' + window.mm.esc(p.title) +
             '" loading="lazy" style="object-position:' +
             window.mm.esc(p.cover_pos || '50% 50%') + '">' +
             (einbettbar
               ? '<button class="br-play" type="button" aria-label="Video abspielen">▶</button>'
               : (p.link_url ? '<a class="br-raus" href="' + window.mm.esc(p.link_url) +
                   '" target="_blank" rel="noopener">' + window.mm.esc(p.link_label || 'Ansehen') +
                   ' →</a>' : '')) +
             '</figure>';
      } else if (p.link_url && p.embed_ok !== false) {
        h += '<div class="br-film">' + window.mm.videoEmbed(p.link_url) + '</div>';
      }
      if (p.body) h += '<div class="br-text">' + window.mm.renderMarkdown(p.body) + '</div>';
      if (p.tags && p.tags.length)
        h += '<p class="br-marken">' + p.tags.map(t => '<span>' + window.mm.esc(t) + '</span>').join('') + '</p>';
      /* "The Race" verweist über more_url auf die Werkzeug-Seite. Ohne diese
         Zeile ginge der Verweis beim Umbau still verloren. */
      if (p.more_url)
        h += '<p class="br-mehr"><a class="mm-tuer" href="' + window.mm.esc(p.more_url) + '">' +
             window.mm.esc(p.more_label || 'Mehr dazu') + '</a></p>';
      s.innerHTML = h;
    });

    /* ---- Schluss: der vorhandene Kontaktteil ---- */
    const k = neuerAbschnitt(e.kontakt_titel || 'Schreib mir', 'kontakt', '#BFCC94');
    k.innerHTML =
      '<h2 class="br-titel">' + window.mm.esc(e.kontakt_titel || 'Schreib mir') + '</h2>' +
      (e.kontakt_zusatz ? '<div class="br-text">' + window.mm.renderMarkdown(e.kontakt_zusatz) + '</div>' : '') +
      '<p class="br-kontakt">' +
        (e.email ? '<a href="mailto:' + window.mm.esc(e.email) + '">' + window.mm.esc(e.email) + '</a>' : '') +
        (e.telefon ? '<a href="tel:' + window.mm.esc(e.telefon.replace(/\s/g, '')) + '">' +
          window.mm.esc(e.telefon) + '</a>' : '') +
      '</p>';

    /* Erst auf Klick den fremden Abspieler holen. */
    ziel.querySelectorAll('.br-spielbar').forEach(f => {
      f.addEventListener('click', () => {
        const url = f.dataset.video;
        if (!url) return;
        f.classList.remove('br-spielbar');
        f.innerHTML = window.mm.videoEmbed(url);
        f.classList.add('br-film');
      }, { once: true });
    });

    return abschnitte;
  };
})();
```

- [ ] **Schritt 4: Festschreiben (der Test läuft erst nach Aufgabe 5)**

```bash
git add HOCHLADEN/assets/brief.js tests/pruefe-brief.mjs
git commit -m "Brief setzt seine Abschnitte aus den vorhandenen Projekten zusammen"
```

---

## Aufgabe 5: `index.html` wird zum Brief

**Dateien:**
- Ändern: `HOCHLADEN/index.html` (vollständig ersetzen)
- Neu: `HOCHLADEN/assets/brief.css`

**Schnittstellen:**
- Nutzt: `mmBrief`, `mmLeiste`, `mmLoadProjects`, `mmLoadSettings`.

- [ ] **Schritt 1: `HOCHLADEN/assets/brief.css` schreiben**

```css
/* mausemaus — der Brief. Warm und hell, wie der Name es verspricht. */
.br-buehne { display:flex; min-height:100vh; }
.br-scroller { flex:1; min-width:0; overflow-y:auto; height:100vh;
  background:#FBFAF6; scroll-behavior:smooth; }
.br-spalte { max-width:560px; margin:0 auto; padding:64px 26px 220px; }

.br-abschnitt { scroll-margin-top:20px; }
.br-gruss { font-family:'Tropi',cursive,sans-serif; font-weight:400; font-size:clamp(38px,6vw,52px);
  line-height:1.04; color:#0D1821; margin:0 0 10px; }
.br-gruss em { display:block; font-style:normal; color:#BFCC94; }
.br-kicker { font-family:'Space Mono',monospace; font-size:10.5px; letter-spacing:.16em;
  text-transform:uppercase; color:#A8A79C; margin:0 0 28px; }

.br-text { font-family:'Space Grotesk',sans-serif; font-size:16.5px; line-height:1.8; color:#232c31; }
.br-text p { margin:0 0 20px; }
.br-rolle { font-family:'Space Mono',monospace; font-size:10px; letter-spacing:.16em;
  text-transform:uppercase; color:#A8A79C; margin:44px 0 6px; }
.br-titel { font-family:'Tropi',cursive,sans-serif; font-weight:400; font-size:30px; line-height:1.1;
  color:#0D1821; margin:0 0 14px; display:flex; align-items:center; gap:11px; flex-wrap:wrap; }
.br-laeuft { font-family:'Space Mono',monospace; font-size:9px; letter-spacing:.14em;
  text-transform:uppercase; color:#0D1821; background:#BFCC94;
  padding:5px 9px; border-radius:99px; }

.br-film, .br-bild { margin:24px 0; border-radius:8px; overflow:hidden;
  box-shadow:0 9px 26px rgba(13,24,33,.14); }
.br-film iframe { display:block; width:100%; aspect-ratio:16/9; border:0; }
.br-bild { position:relative; margin:24px 0; }
.br-bild img { display:block; width:100%; aspect-ratio:16/9; object-fit:cover; }
.br-bild.br-klein { max-width:260px; }

/* Einbettbare Videos: Coverbild als Vorschau, Abspieler erst beim Klick.
   Sonst holt die Startseite fünf fremde Abspieler auf einmal. */
.br-spielbar { cursor:pointer; }
.br-spielbar img { transition:transform .5s cubic-bezier(.50,0,.12,1); }
.br-spielbar:hover img { transform:scale(1.02); }
.br-play { position:absolute; inset:0; margin:0; width:100%; height:100%;
  display:flex; align-items:center; justify-content:center;
  border:0; background:rgba(13,24,33,.22); color:#FBFAF6; font-size:30px;
  cursor:pointer; transition:background .2s; }
.br-play:hover { background:rgba(13,24,33,.36); }
@media (prefers-reduced-motion: reduce) { .br-spielbar:hover img { transform:none; } }
.br-raus { position:absolute; right:12px; bottom:12px; background:#FBFAF6; color:#0D1821;
  text-decoration:none; border-radius:99px; padding:9px 15px;
  font-family:'Space Mono',monospace; font-size:10px; letter-spacing:.13em; text-transform:uppercase; }

.br-marken { display:flex; flex-wrap:wrap; gap:7px; margin:16px 0 0; }
.br-marken span { font-family:'Space Mono',monospace; font-size:9px; letter-spacing:.13em;
  text-transform:uppercase; color:#6E7873; border:1px solid #E2DFD3;
  border-radius:99px; padding:6px 11px; }

/* Eckdaten, Werkzeuge, Kunden — alles, was von der alten Startseite mitkommt. */
.br-infos, .br-werkzeuge { display:grid; gap:0; margin:26px 0 0; border-top:1px solid #E7E3D6; }
.br-infos > div, .br-werkzeuge > div { display:flex; justify-content:space-between;
  align-items:baseline; gap:16px; padding:11px 0; border-bottom:1px solid #E7E3D6; }
.br-infos dt { font-family:'Space Mono',monospace; font-size:9.5px;
  letter-spacing:.15em; text-transform:uppercase; color:#A8A79C; }
.br-werkzeuge dt { font-family:'Space Grotesk',sans-serif; font-size:14.5px; color:#232c31; }
.br-infos dd { font-family:'Space Grotesk',sans-serif; font-size:14.5px; color:#232c31; text-align:right; }
.br-werkzeuge dd { font-family:'Space Mono',monospace; font-size:9.5px;
  letter-spacing:.14em; text-transform:uppercase; color:#A8A79C; }
.br-infos dd span { display:block; font-size:12.5px; color:#6E7873; }
.br-punkt dd { position:relative; padding-left:15px; }
.br-punkt dd:before { content:''; position:absolute; left:0; top:7px; width:7px; height:7px;
  border-radius:50%; background:#BFCC94; }
.br-kunden { display:flex; flex-wrap:wrap; gap:7px; margin:22px 0 0; }
.br-kunden span { font-family:'Space Mono',monospace; font-size:9px; letter-spacing:.14em;
  text-transform:uppercase; color:#6E7873; }
.br-kunden span + span:before { content:'·'; margin-right:8px; color:#CFCBBC; }
.br-mehr { margin:18px 0 0; font-family:'Space Grotesk',sans-serif; font-size:15px; }

.br-kontakt { display:flex; flex-direction:column; gap:6px; margin:18px 0 0; }
.br-kontakt a { font-family:'Space Grotesk',sans-serif; font-size:17px; color:#0D1821; }

/* Das Anfrageformular bleibt fest im HTML — Netlify durchsucht die
   hochgeladenen Dateien und findet nur, was dort wirklich steht. */
.br-formular { margin:26px 0 0; display:grid; gap:12px; max-width:440px; }
.br-formular input, .br-formular textarea { font:400 15px/1.5 'Space Grotesk',sans-serif;
  padding:12px 14px; border:1px solid #E2DFD3; border-radius:8px; background:#fff;
  color:#0D1821; width:100%; }
.br-formular button { font-family:'Space Mono',monospace; font-size:11px; letter-spacing:.14em;
  text-transform:uppercase; padding:14px 20px; border:0; border-radius:99px;
  background:#0D1821; color:#F0F4EF; cursor:pointer; justify-self:start; }
.versteckt { position:absolute; left:-9999px; }

@media (prefers-reduced-motion: reduce) { .br-scroller { scroll-behavior:auto; } }
```

- [ ] **Schritt 2: `HOCHLADEN/index.html` ersetzen**

Alle Pfade absolut. Das Formular steht **fest** im HTML, nicht per JavaScript erzeugt.

```html
<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>mausemaus — Lucas Schönwald</title>
<meta name="description" content="Lucas Schönwald — Video Editor und Motion Designer in Köln.">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta property="og:title" content="mausemaus — Lucas Schönwald">
<meta property="og:image" content="/og-bild.jpg">
<meta property="og:type" content="website">
<link rel="stylesheet" href="/assets/fonts.css">
<link rel="stylesheet" href="/assets/site.css">
<link rel="stylesheet" href="/assets/leiste.css">
<link rel="stylesheet" href="/assets/brief.css">
</head>
<body>

<div class="br-buehne">
  <div id="leiste"></div>
  <div class="br-scroller" id="scroller">
    <div class="br-spalte">
      <div id="brief"></div>

      <form name="anfrage" method="POST" data-netlify="true"
            netlify-honeypot="bot-feld" action="/?danke=1#anfragen"
            class="br-formular" id="anfragen">
        <input type="hidden" name="form-name" value="anfrage">
        <p class="versteckt"><label>Bitte leer lassen: <input name="bot-feld"></label></p>
        <label><input type="text" name="name" placeholder="Dein Name" required></label>
        <label><input type="email" name="email" placeholder="Deine E-Mail" required></label>
        <label><textarea name="nachricht" rows="4" placeholder="Worum geht's?" required></textarea></label>
        <button type="submit">Anfrage senden →</button>
      </form>
    </div>
  </div>
</div>

<script src="/assets/config.js"></script>
<script src="/assets/seed.js"></script>
<script src="/assets/shared.js"></script>
<script src="/assets/db.js"></script>
<script src="/assets/leiste.js"></script>
<script src="/assets/brief.js"></script>
<script>
(async () => {
  const [settings, alle] = await Promise.all([
    window.mmLoadSettings(), window.mmLoadProjects(),
  ]);
  const projekte = (alle || []).filter(p => p.status === 'published')
                               .sort((a, b) => a.sort_order - b.sort_order);
  const abschnitte = window.mmBrief(document.getElementById('brief'), { settings, projekte });

  /* Bilder können die Höhen verschieben — erst danach die Leiste rechnen lassen. */
  const leiste = window.mmLeiste(document.getElementById('leiste'), abschnitte,
    { scroller: document.getElementById('scroller') });
  await Promise.all([...document.images]
    .filter(i => !i.complete)
    .map(i => new Promise(r => { i.onload = i.onerror = r; })));
  leiste.neuBerechnen();

  if (new URLSearchParams(location.search).has('danke')) {
    const f = document.getElementById('anfragen');
    f.innerHTML = '<p class="br-text">Angekommen — ich melde mich, meistens noch am selben Tag.</p>';
  }
})();
</script>
</body>
</html>
```

- [ ] **Schritt 3: Prüfung ausführen — muss bestehen**

```bash
node tests/pruefe-brief.mjs
```

Erwartet: `6 von 6 bestanden`. Schlägt „KEIN Projekttext wurde verändert" fehl, ist
entweder ein Text gekürzt worden (verboten) oder der Umsetzer hat Sonderzeichen verändert —
in dem Fall den Vergleich prüfen, **nicht den Text anpassen**.

- [ ] **Schritt 4: Mit eigenen Augen ansehen**

```bash
node -e "import('./tests/chrome.mjs').then(async m=>{const s=await import('./tests/server.mjs');const srv=await s.starteServer({wurzel:'./HOCHLADEN',port:8904});const c=await m.starteChrome({port:9336});const p=await m.oeffne('http://127.0.0.1:8904/',{port:9336,breite:1280,hoehe:900});await p.warte(3000);await p.bild('tests/bilder/brief.png');await p.zu();c.beenden();srv.beenden();console.log('tests/bilder/brief.png')})"
```

Das Bild ansehen und gegen `docs/superpowers/prototypen/leiste-final.html` halten.

- [ ] **Schritt 5: Festschreiben**

```bash
git add HOCHLADEN/index.html HOCHLADEN/assets/brief.css
git commit -m "Startseite ist der Brief"
```

---

## Aufgabe 6: Hintertürchen

**Dateien:**
- Neu: `HOCHLADEN/assets/tueren.js`
- Ändern: `HOCHLADEN/assets/shared.js`
- Ändern: `HOCHLADEN/index.html` (Datei einbinden)

**Schnittstellen:**
- Schreibweise im Text: `[[Wort|slug|Vorschautitel|Vorschautext]]` — die letzten beiden
  dürfen fehlen.
- Liefert: `window.mmTueren(wurzel)` — hängt Vorschau, Merkung besuchter Türen und
  die Geheimtür an.

- [ ] **Schritt 1: Umsetzer in `shared.js` erweitern**

In `HOCHLADEN/assets/shared.js`, Funktion `inline`, **direkt nach `let s = esc(t);`** und
**vor** der `**fett**`-Zeile einfügen.

Wichtig: `s` ist an dieser Stelle **schon maskiert**. Deshalb wird hier **nicht noch einmal
`esc()` aufgerufen** — sonst würde aus einem `&` im Vorschautext `&amp;amp;`. Nur
Anführungszeichen müssen raus, damit sie die Attribute nicht sprengen (`esc` wandelt sie
bereits in `&quot;` um, deshalb genügt hier eine Sicherung gegen rohe Zeichen).

```js
  /* Hintertürchen: [[Wort|slug|Titel|Text]] — führt in eine Welt.
     Muss vor allen anderen Regeln stehen: sonst frisst die Link-Regel
     die inneren Klammern. s ist hier bereits durch esc() gelaufen. */
  s = s.replace(/\[\[([^\]|]+)\|([^\]|]+)(?:\|([^\]|]*))?(?:\|([^\]|]*))?\]\]/g,
    (_, wort, slug, titel, text) => {
      const rein = x => String(x || '').trim().replace(/"/g, '&quot;');
      const ziel = rein(slug).replace(/[^a-z0-9-]/gi, '');
      if (!ziel) return wort;
      return '<a class="mm-tuer" href="/welt/' + ziel + '"' +
             ' data-titel="' + rein(titel) + '"' +
             ' data-text="' + rein(text) + '">' + wort.trim() + '</a>';
    });
```

- [ ] **Schritt 2: `HOCHLADEN/assets/tueren.js` schreiben**

```js
/* mausemaus — Hintertürchen. Zeigen vorher, wohin sie führen, aber nicht alles.
   Besuchte Türen sehen anders aus. Eine Tür ist unmarkiert. */
(() => {
  const MERK = 'mm.tueren.besucht.v1';

  const gelesen = () => { try { return new Set(JSON.parse(localStorage.getItem(MERK) || '[]')); }
                          catch { return new Set(); } };
  const merken = slug => { const m = gelesen(); m.add(slug);
    try { localStorage.setItem(MERK, JSON.stringify([...m])); } catch {} };

  window.mmTueren = function (wurzel) {
    const besucht = gelesen();
    const kasten = document.createElement('div');
    kasten.className = 'mm-vorschau';
    kasten.hidden = true;
    document.body.appendChild(kasten);

    wurzel.querySelectorAll('a.mm-tuer').forEach(a => {
      const slug = (a.getAttribute('href') || '').split('/').pop();
      if (besucht.has(slug)) a.classList.add('mm-tuer-besucht');
      a.addEventListener('click', () => merken(slug));

      a.addEventListener('mouseenter', () => {
        const t = a.dataset.titel, x = a.dataset.text;
        if (!t && !x) return;
        kasten.innerHTML =
          '<i>Hintertürchen</i>' +
          (t ? '<b></b>' : '') + (x ? '<span></span>' : '');
        if (t) kasten.querySelector('b').textContent = t;
        if (x) kasten.querySelector('span').textContent = x;
        kasten.hidden = false;
        const r = a.getBoundingClientRect();
        const breite = 214;
        kasten.style.left = Math.max(10,
          Math.min(window.innerWidth - breite - 10, r.left + r.width / 2 - breite / 2)) + 'px';
        kasten.style.top = (r.top - kasten.offsetHeight - 11) + 'px';
      });
      a.addEventListener('mouseleave', () => { kasten.hidden = true; });
    });
  };
})();
```

- [ ] **Schritt 3: Gestaltung in `brief.css` ergänzen**

```css
/* Türchen: zarte Unterlegung, kleines Blümchen, Zeiger wird zum Blümchen. */
.mm-tuer { color:#0D1821; text-decoration:none;
  background:linear-gradient(transparent 62%, #E4EBCF 62%);
  cursor:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24'><text y='18' font-size='16'>❀</text></svg>") 6 6, pointer; }
.mm-tuer:after { content:'❀'; font-size:9px; color:#BFCC94; vertical-align:super; margin-left:2px; }
/* Schon durchgegangen: das Blümchen verblasst. */
.mm-tuer-besucht:after { color:#D6D3C4; }
.mm-tuer-besucht { background:linear-gradient(transparent 62%, #EFEFE6 62%); }
/* Die unmarkierte Tür: kein Blümchen, leuchtet nur beim Darüberfahren auf. */
.mm-tuer-geheim { background:none; }
.mm-tuer-geheim:after { content:none; }
.mm-tuer-geheim:hover { background:linear-gradient(transparent 62%, #E4EBCF 62%); }

.mm-vorschau { position:fixed; z-index:60; width:214px; background:#0D1821; color:#F0F4EF;
  border-radius:8px; padding:11px 13px; box-shadow:0 10px 28px rgba(13,24,33,.34);
  pointer-events:none; }
.mm-vorschau i { display:block; font-family:'Space Mono',monospace; font-size:8px;
  letter-spacing:.16em; text-transform:uppercase; color:#BFCC94; font-style:normal; }
.mm-vorschau b { display:block; font-family:'Tropi',cursive,sans-serif; font-weight:400;
  font-size:16px; line-height:1.15; margin:6px 0 4px; }
.mm-vorschau span { font-family:'Space Grotesk',sans-serif; font-size:10.5px;
  line-height:1.45; color:#AEB6B2; }
```

- [ ] **Schritt 4: In `index.html` einbinden und aufrufen**

Nach `<script src="/assets/brief.js"></script>` einfügen:

```html
<script src="/assets/tueren.js"></script>
```

Und im Startskript nach `leiste.neuBerechnen();`:

```js
  window.mmTueren(document.getElementById('brief'));
```

- [ ] **Schritt 5: Prüfung an `tests/pruefe-brief.mjs` anhängen**

```js
/* --- Türchen --- */
const t = JSON.parse(await s.werte(`(() => {
  const d = document.createElement('div');
  d.innerHTML = window.mm.renderMarkdown(
    'Ich sitze viel in [[Blender|blender|Was ich in 3D anstelle|Eigene Welt, dunkel und orange]].');
  const a = d.querySelector('a.mm-tuer');
  return JSON.stringify({
    gefunden: !!a, ziel: a && a.getAttribute('href'),
    wort: a && a.textContent, titel: a && a.dataset.titel
  });
})()`));
pruefe('Türchen-Schreibweise wird umgesetzt', t.gefunden);
pruefe('Türchen zeigt auf /welt/…', t.ziel === '/welt/blender', String(t.ziel));
pruefe('nur das Wort steht im Text', t.wort === 'Blender', String(t.wort));
pruefe('Vorschautitel kommt mit', t.titel === 'Was ich in 3D anstelle', String(t.titel));
```

- [ ] **Schritt 6: Ausführen — muss bestehen**

```bash
node tests/pruefe-brief.mjs
```

Erwartet: `10 von 10 bestanden`.

- [ ] **Schritt 7: Festschreiben**

```bash
git add HOCHLADEN/assets/tueren.js HOCHLADEN/assets/shared.js HOCHLADEN/assets/brief.css HOCHLADEN/index.html tests/pruefe-brief.mjs
git commit -m "Hintertürchen mit Vorschau, besuchten Türen und Geheimtür"
```

---

## Aufgabe 7: Die Welten

**Dateien:**
- Neu: `HOCHLADEN/welt.html`
- Neu: `HOCHLADEN/assets/welt.css`
- Ändern: `HOCHLADEN/_redirects`
- Neu: `tests/pruefe-welten.mjs`

- [ ] **Schritt 1: `_redirects` ergänzen**

Die vorhandenen Zeilen bleiben, damit alte Blog-Adressen weiter funktionieren.

```
/welt/*   /welt.html   200
/blog/*   /welt.html   200
```

- [ ] **Schritt 2: `HOCHLADEN/assets/welt.css` schreiben**

Die Farbstimmung kommt aus einer einzigen Variablen, die das Skript setzt.

```css
/* mausemaus — eine Welt. Farbstimmung kommt aus --welt und färbt alles mit. */
.welt {
  --welt: #BFCC94;
  --welt-grund: #FBFAF6;
  --welt-schrift: #232c31;
  --welt-leise: #6E7873;
  min-height:100vh; background:var(--welt-grund); color:var(--welt-schrift);
}
.welt.dunkel { --welt-grund:#1b1b20; --welt-schrift:#EDEDF2; --welt-leise:#A5A5B0; }
.welt-spalte { max-width:620px; margin:0 auto; padding:44px 26px 120px; }
.welt-zurueck { display:inline-flex; align-items:center; gap:7px; text-decoration:none;
  font-family:'Space Mono',monospace; font-size:10px; letter-spacing:.14em;
  text-transform:uppercase; color:var(--welt-leise); margin-bottom:34px; }
.welt-zurueck:hover { color:var(--welt); }
.welt-kicker { font-family:'Space Mono',monospace; font-size:9px; letter-spacing:.18em;
  text-transform:uppercase; color:var(--welt); margin:0 0 9px; }
.welt-titel { font-family:'Tropi',cursive,sans-serif; font-weight:400;
  font-size:clamp(30px,5vw,44px); line-height:1.05; margin:0 0 16px; }
.welt-text { font-family:'Space Grotesk',sans-serif; font-size:16.5px; line-height:1.8; }
.welt-text p { margin:0 0 20px; }
.welt-text img { max-width:100%; height:auto; border-radius:8px; }
.welt-text a { color:var(--welt); }
.welt-cover { width:100%; aspect-ratio:16/9; object-fit:cover; border-radius:9px; margin:0 0 28px; }

/* Der Farbwechsel schwappt herein, statt hart umzuschalten. */
@keyframes welt-rein { from { opacity:0; } to { opacity:1; } }
.welt { animation: welt-rein .5s cubic-bezier(.50,0,.12,1) both; }
@media (prefers-reduced-motion: reduce) { .welt { animation:none; } }
```

- [ ] **Schritt 3: `HOCHLADEN/welt.html` schreiben**

```html
<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>mausemaus</title>
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/assets/fonts.css">
<link rel="stylesheet" href="/assets/site.css">
<link rel="stylesheet" href="/assets/brief.css">
<link rel="stylesheet" href="/assets/welt.css">
</head>
<body>
<div class="welt" id="welt">
  <div class="welt-spalte">
    <a class="welt-zurueck" href="/">← zurück in den Brief</a>
    <div id="inhalt"></div>
  </div>
</div>

<script src="/assets/config.js"></script>
<script src="/assets/shared.js"></script>
<script src="/assets/db.js"></script>
<script src="/assets/tueren.js"></script>
<script>
(async () => {
  /* Netlify schreibt /welt/xy auf diese Datei um — der Name steht in der Adresse. */
  const slug = decodeURIComponent(location.pathname.split('/').filter(Boolean).pop() || '');
  const ziel = document.getElementById('inhalt');
  const welt = document.getElementById('welt');

  const [seite] = await window.mmLoadPosts(slug);
  if (!seite) {
    document.title = 'Nicht gefunden — mausemaus';
    ziel.innerHTML = '<h1 class="welt-titel">Hier ist nichts.</h1>' +
      '<p class="welt-text">Diese Tür führt ins Leere. Zurück in den Brief?</p>';
    return;
  }

  document.title = seite.title + ' — mausemaus';
  if (seite.farbe) {
    welt.style.setProperty('--welt', seite.farbe);
    /* Dunkle Farbstimmung, wenn die Farbe dunkel ist. */
    const h = seite.farbe.replace('#', '');
    if (h.length === 6) {
      const [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
      if (0.2126 * r + 0.7152 * g + 0.0722 * b < 110) welt.classList.add('dunkel');
    }
  }

  ziel.innerHTML =
    (seite.subtitle ? '<p class="welt-kicker">' + window.mm.esc(seite.subtitle) + '</p>' : '') +
    '<h1 class="welt-titel">' + window.mm.esc(seite.title) + '</h1>' +
    (seite.cover_url ? '<img class="welt-cover" src="' + window.mm.esc(seite.cover_url) +
      '" alt="" style="object-position:' + window.mm.esc(seite.cover_pos || '50% 50%') + '">' : '') +
    '<div class="welt-text">' + window.mm.renderMarkdown(seite.body || '') + '</div>';

  window.mmTueren(ziel);
})();
</script>
</body>
</html>
```

- [ ] **Schritt 4: `tests/pruefe-welten.mjs` schreiben und ausführen**

Geprüft wird unter der **echten** Adresse, nicht als Datei — genau dort ist der Pfadfehler
von neulich aufgetreten.

```js
import { starteChrome, oeffne, pruefe, bericht } from './chrome.mjs';
import { starteServer } from './server.mjs';

const wurzel = new URL('../HOCHLADEN/', import.meta.url).pathname;
const server = await starteServer({ wurzel, port: 8905 });
const chrome = await starteChrome({ port: 9337 });

/* Einen echten Slug aus der Datenbank holen. */
const start = await oeffne('http://127.0.0.1:8905/', { port: 9337 });
await start.warte(2500);
const slug = await start.werte(`window.mmLoadPosts().then(l => (l[0]||{}).slug || '')`);
await start.zu();
pruefe('mindestens eine Welt vorhanden', !!slug, slug);

const s = await oeffne('http://127.0.0.1:8905/welt/' + slug, { port: 9337 });
await s.warte(2500);
const d = JSON.parse(await s.werte(`JSON.stringify({
  titel: document.title,
  grund: getComputedStyle(document.getElementById('welt')).backgroundColor,
  schrift: document.fonts.check('16px Tropi'),
  ueberschrift: (document.querySelector('.welt-titel')||{}).textContent || '',
  stylesheets: [...document.styleSheets].length,
  zurueck: !!document.querySelector('.welt-zurueck')
})`));

pruefe('Welt lädt unter /welt/' + slug, !d.titel.includes('Nicht gefunden'), d.titel);
pruefe('CSS greift unter tiefer Adresse', d.stylesheets >= 4, d.stylesheets + ' Stylesheets');
pruefe('Schrift lädt unter tiefer Adresse', d.schrift);
pruefe('Überschrift vorhanden', d.ueberschrift.length > 0, d.ueberschrift);
pruefe('Rückweg in den Brief vorhanden', d.zurueck);

/* Unbekannte Welt darf nicht abstürzen. */
const f = await oeffne('http://127.0.0.1:8905/welt/gibtesnicht', { port: 9337 });
await f.warte(2000);
pruefe('unbekannte Welt zeigt eine freundliche Seite',
  (await f.werte(`document.body.innerText`)).includes('Hier ist nichts'));

await s.zu(); await f.zu(); chrome.beenden(); server.beenden();
bericht();
```

```bash
node tests/pruefe-welten.mjs
```

Erwartet: `7 von 7 bestanden`. Schlägt „CSS greift unter tiefer Adresse" fehl, ist irgendwo
ein relativer Pfad stehen geblieben.

- [ ] **Schritt 5: Festschreiben**

```bash
git add HOCHLADEN/welt.html HOCHLADEN/assets/welt.css HOCHLADEN/_redirects tests/pruefe-welten.mjs
git commit -m "Welten unter /welt/:slug mit eigener Farbstimmung"
```

---

## Aufgabe 8: Handy

Auf dem Handy ist kein Platz für eine Spalte. Die Zeitleiste wird dort zu einem Streifen am
oberen Rand, der sich auf Tippen zu einer Liste öffnet.

**Dateien:**
- Ändern: `HOCHLADEN/assets/leiste.css`
- Ändern: `tests/pruefe-leiste.mjs`

- [ ] **Schritt 1: Prüfung ergänzen — zuerst fehlschlagen lassen**

Ans Ende von `tests/pruefe-leiste.mjs`, vor `bericht()`:

```js
/* --- Handy: 520 px ist die schmalste Breite, die Chrome ehrlich abbildet --- */
const h = await oeffne('http://127.0.0.1:8902/tests-feste/leiste-probe.html',
  { port: 9334, breite: 520, hoehe: 900 });
await h.warte(1200);
const m = JSON.parse(await h.werte(`JSON.stringify({
  waagerecht: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  leisteBreite: Math.round(document.querySelector('.mml').getBoundingClientRect().width),
  leisteHoehe: Math.round(document.querySelector('.mml').getBoundingClientRect().height),
  textBreite: Math.round(document.querySelector('.sp').getBoundingClientRect().width)
})`));
pruefe('kein waagerechtes Scrollen auf dem Handy', !m.waagerecht);
pruefe('Leiste ist ein Streifen oben, keine Spalte', m.leisteHoehe < 90, m.leisteHoehe + ' px hoch');
pruefe('Leiste nimmt die volle Breite', m.leisteBreite >= 500, m.leisteBreite + ' px');
pruefe('Text bekommt Platz', m.textBreite > 400, m.textBreite + ' px');
await h.zu();
```

```bash
node tests/pruefe-leiste.mjs
```

Erwartet: die vier neuen Zeilen schlagen fehl.

- [ ] **Schritt 2: Handy-Regeln an `leiste.css` anhängen**

```css
/* ===== Handy: aus der Spalte wird ein Streifen oben ===== */
@media (max-width: 760px) {
  .br-buehne { flex-direction: column; }
  .br-scroller { height: auto; overflow: visible; }

  .mml, .mml-zu { width: 100%; height: 62px; border-right: 0;
    border-bottom: 1px solid #EDEAE1; position: sticky; top: 0; overflow: hidden;
    transition: height var(--mml-dauer) var(--mml-kurve); }
  .mml-offen { height: 62vh; overflow-y: auto; }

  .mml-marke { opacity: 1 !important; padding: 20px 18px 0; font-size: 19px; }
  .mml-mini { display: none; }

  /* Das Gleis legt sich quer und wird zum dünnen Fortschrittsband. */
  .mml-gleis { left: 0; right: 0; top: auto; bottom: 0; width: auto; height: 4px;
    border-radius: 0; }
  .mml-seg { top: auto !important; bottom: 0; height: 4px !important; width: auto;
    border-radius: 0; }
  .mml-kopf, .mml-sicht, .mml-fuehrung, .mml-zeit { display: none; }

  /* Etiketten erst sichtbar, wenn aufgeklappt — dann als schlichte Liste. */
  .mml-etiketten { position: static; padding: 12px 14px 18px; }
  .mml-et { position: static !important; width: auto; margin-bottom: 2px; opacity: 0;
    pointer-events: none; }
  .mml-offen .mml-et { opacity: 1; pointer-events: auto; }
  .mml-fuss { display: none; }
  .mml-griff { top: 18px; right: 14px; bottom: auto; width: 34px; height: 26px;
    border-radius: 99px; }
  .mml-offen .mml-griff { right: 14px; }
}
```

- [ ] **Schritt 3: Aufklappen auf dem Handy in `leiste.js` ergänzen**

Die Maus-Ereignisse gibt es auf dem Handy nicht. Direkt vor `bauen(); aktualisieren();`
einfügen:

```js
    /* Auf dem Handy gibt es kein Überfahren — dort klappt der Griff die Liste auf. */
    const schmal = () => window.matchMedia('(max-width: 760px)').matches;
    griff.addEventListener('click', () => {
      if (schmal()) wurzel.classList.toggle('mml-offen');
    });
    lage.addEventListener('click', () => {
      if (schmal()) wurzel.classList.remove('mml-offen');
    });
```

Und in `springe()` ergänzen, damit die Liste sich nach dem Sprung schließt: als erste Zeile
`wurzel.classList.remove('mml-offen');`.

Auf dem Handy scrollt das Fenster selbst, nicht der Kasten. Der Scroll-Bereich wird deshalb
in `index.html` je nach Breite gewählt — im Startskript vor `mmLeiste`:

```js
  const scroller = window.matchMedia('(max-width: 760px)').matches
    ? document.scrollingElement : document.getElementById('scroller');
```

und `{ scroller }` statt `{ scroller: document.getElementById('scroller') }` übergeben.

**In `leiste.js` ist dafür nichts zu tun** — die Helfer `amFenster`, `obenVon` und `standVon`
aus Aufgabe 3 decken beide Fälle bereits ab, und das Scroll-Ereignis hängt schon am richtigen
Ort. Das war Absicht: Beide Fälle von Anfang an zu behandeln ist billiger, als `offsetTop`
später überall herauszuoperieren.

- [ ] **Schritt 4: Beide Prüfungen laufen lassen**

```bash
node tests/pruefe-leiste.mjs && node tests/pruefe-brief.mjs && node tests/pruefe-welten.mjs
```

Erwartet: alle drei vollständig bestanden.

- [ ] **Schritt 5: Bild vom Handy machen und ansehen**

```bash
node -e "import('./tests/chrome.mjs').then(async m=>{const s=await import('./tests/server.mjs');const srv=await s.starteServer({wurzel:'./HOCHLADEN',port:8906});const c=await m.starteChrome({port:9338});const p=await m.oeffne('http://127.0.0.1:8906/',{port:9338,breite:520,hoehe:900});await p.warte(3000);await p.bild('tests/bilder/handy.png');await p.zu();c.beenden();srv.beenden();console.log('tests/bilder/handy.png')})"
```

- [ ] **Schritt 6: Festschreiben**

```bash
git add HOCHLADEN/assets/leiste.css HOCHLADEN/assets/leiste.js HOCHLADEN/index.html tests/pruefe-leiste.mjs
git commit -m "Zeitleiste auf dem Handy: Streifen oben statt Spalte"
```

---

## Aufgabe 9: Aufräumen, Notfalldaten, Hochladen

**Dateien:**
- Löschen: `HOCHLADEN/assets/start.js`, `HOCHLADEN/assets/start.css`,
  `HOCHLADEN/beitrag.html`, `HOCHLADEN/blog.html`, `HOCHLADEN/assets/blog.js`
- Ändern: `HOCHLADEN/assets/seed.js`

- [ ] **Schritt 1: Prüfen, dass die alten Dateien wirklich niemand mehr braucht**

```bash
grep -rn "start\.js\|start\.css\|blog\.js\|beitrag\.html\|blog\.html" HOCHLADEN --include=*.html --include=*.js | grep -v "^HOCHLADEN/assets/blog.js" | grep -v "^HOCHLADEN/blog.html" | grep -v "^HOCHLADEN/beitrag.html"
```

Erwartet: **keine Ausgabe**. Gibt es Treffer, zuerst diese Verweise entfernen.

- [ ] **Schritt 2: Löschen**

```bash
git rm HOCHLADEN/assets/start.js HOCHLADEN/assets/start.css \
       HOCHLADEN/beitrag.html HOCHLADEN/blog.html HOCHLADEN/assets/blog.js
```

- [ ] **Schritt 3: Alle Prüfungen laufen lassen**

```bash
node tests/pruefe-bestand.mjs && node tests/pruefe-leiste.mjs && \
node tests/pruefe-brief.mjs && node tests/pruefe-welten.mjs
```

Erwartet: alles bestanden. `pruefe-bestand.mjs` prüft jetzt den Brief statt der alten Seite —
das ist richtig so.

- [ ] **Schritt 4: `seed.js` aus der laufenden Datenbank neu erzeugen**

Die Notfalldaten müssen den heutigen Stand tragen, sonst zeigt die Seite bei einer Störung
alte Texte. Über den Admin-Bereich die Ausfuhr benutzen und in
`HOCHLADEN/assets/seed.js` in der bestehenden Form ablegen:

```js
window.SEED_PROJECTS = [ /* … aus der Ausfuhr … */ ];
```

Danach gegenprüfen:

```bash
node -e "
const fs=require('fs');
const t=fs.readFileSync('HOCHLADEN/assets/seed.js','utf8');
const m=t.match(/window\.SEED_PROJECTS\s*=\s*(\[[\s\S]*?\]);/);
const d=JSON.parse(m[1]);
console.log('Projekte in seed.js:', d.length);
console.log('veröffentlicht:', d.filter(p=>p.status==='published').length);
"
```

Erwartet: dieselbe Anzahl wie in der Datenbank, fünf veröffentlicht.

- [ ] **Schritt 5: Prüfen, dass kein geheimer Schlüssel mit hochgeht**

```bash
grep -rn "sb_secret\|service_role" HOCHLADEN/ && echo "STOPP — geheimer Schlüssel gefunden" || echo "sauber"
```

Erwartet: `sauber`.

- [ ] **Schritt 6: Festschreiben**

```bash
git add -A
git commit -m "Alte Startseite und Blog entfernt, Notfalldaten aufgefrischt"
```

- [ ] **Schritt 7: Hochladen (macht Lucas)**

Den Ordner `HOCHLADEN` auf die **Deploys**-Seite des mausemaus-Projekts bei Netlify ziehen,
nicht auf die Übersichtsseite.

Danach einmalig unter **Forms** die Benachrichtigung an die eigene E-Mail einschalten.

- [ ] **Schritt 8: Nach dem Hochladen gegen die echte Adresse prüfen**

```bash
node -e "import('./tests/chrome.mjs').then(async m=>{const c=await m.starteChrome({port:9339});
for (const u of ['https://mausemaus.com/','https://mausemaus.com/welt/verteidiger']) {
  const p=await m.oeffne(u,{port:9339}); await p.warte(3500);
  console.log(u, await p.werte('JSON.stringify({titel:document.title, css:[...document.styleSheets].length, abschnitte:document.querySelectorAll(\".mml-seg\").length})'));
  await p.zu(); } c.beenden(); })"
```

Erwartet: beide Adressen mit Titel, mindestens vier Stylesheets und Segmenten in der Leiste.

---

## Selbstprüfung dieses Plans

**Abdeckung gegen das Entwurfsdokument**

| Abschnitt des Entwurfs | Aufgabe |
|---|---|
| 2 — Brief, Inhalt 1:1 | 4, 5 |
| 3 — Zeitleiste, Pacing, Fehler | 3, 8 |
| 4 — Türchen und Welten | 6, 7 |
| 5 — Bewegung auf der Seite | **Plan 3** (bewusst) |
| 6 — Blockeditor und Anleitung | **Plan 2** (bewusst) |
| 7 — Datenmodell und Wanderung | **Plan 2** (bewusst, siehe Abweichung oben) |
| 8 — Technik, Rückfall, Schlüssel | 9 |
| 9 — Feinschliff-Maßstab | in jeder Aufgabe, Bilder in 5 und 8 |
| 10 — Reihenfolge, früh hochladen | 9 |

**Offen und bewusst nicht in diesem Plan:** Startanimation, Tageszeit im ersten Satz, zweiter
Besuch, Dackel, Schalter für Bewegung, Blockeditor, Anleitung im Admin, Datenwanderung.
`prefers-reduced-motion` wird trotzdem schon überall beachtet.

**Stand der Daten, am 21.08.2026 nachgesehen:**

- **5 veröffentlichte Projekte** (`sort_order` 1–5) plus eine archivierte Zeile `test`,
  die nirgends auftauchen darf. Die Prüfung filtert auf `status === 'published'`.
- **`accent` taugt nicht als Segmentfarbe.** Es gibt nur vier Werte, und `the-race-staffel-3`
  und `absent-musikvideo` tragen beide `sky`. Deshalb vergibt Aufgabe 4 die Farben der Reihe
  nach aus einer festen Liste. `accent` bleibt unangetastet.
- **`the-race-staffel-3` hat `embed_ok = false`** — Joyn und ProSieben lassen die Einbettung
  nicht zu. Dieses Projekt zeigt Coverbild und einen Verweis nach außen, kein Abspielfenster.
  Das ist kein Fehler, sondern geprüft und so gewollt.
- Alle fünf haben Coverbild und Verweis; die Fließtexte sind 731 bis 1843 Zeichen lang.
  Die Abschnitte sind also unterschiedlich lang — genau der Fall, für den die Etiketten
  in der Leiste sich abstoßen müssen.

**Bekannte Schwachstelle:** Kommen später mehr als acht Projekte dazu, wiederholen sich die
Farben. Ab dann gehört die Farbe ins Datenfeld, nicht in eine Liste im Code — das kommt
mit dem Blockeditor in Plan 2.
