/* Alles, was VOR dem Hochladen auf Netlify passieren muss — ein Befehl.

       node tests/hochladen.mjs

   Der Reihe nach:
     1. Versionsstempel setzen (tests/stempel.mjs, unveraendert uebernommen)
     2. Daten aus Supabase holen
     3. je veroeffentlichter Welt eine vorgebaute Seite mit echten
        Teilen-Vorschau-Angaben schreiben (HOCHLADEN/welt/<slug>.html)
     4. _redirects mit ausdruecklichen Zeilen fuer diese Seiten
     5. assets/seed.js neu schreiben (die Notfall-Daten)
     6. sitemap.xml schreiben

   WARUM die vorgebauten Seiten noetig sind: welt.html baut ihren Inhalt erst
   im Browser zusammen. Im Quelltext steht nur ein leeres <div>. Google fuehrt
   JavaScript aus, aber WhatsApp, LinkedIn, Slack und Twitter tun das NICHT --
   ihre Vorschau zeigte deshalb immer nur das allgemeine og-bild.jpg statt des
   Projekts. Die vorgebaute Fassung traegt dieselben Angaben schon im <head>.
   Das Nachtragen im Browser bleibt trotzdem drin und setzt exakt dieselben
   Werte noch einmal -- es gibt also keine zweite Darstellungslogik, die
   auseinanderlaufen koennte.

   BEKANNTE EINSCHRAENKUNG: Aendert Lucas danach etwas nur im Admin, ohne neu
   hochzuladen, bleibt die Teilen-Vorschau auf dem alten Stand. Die Seite
   selbst ist sofort aktuell -- die kommt weiterhin live aus der Datenbank.

   SICHERHEIT: Erst werden ALLE Daten geholt und geprueft, danach wird
   geschrieben. Ist die Datenbank nicht erreichbar, bricht das Skript ab und
   laesst jede Datei unangetastet -- ein halb geschriebenes seed.js waere
   schlimmer als ein altes. */

import { readFile, writeFile, readdir, mkdir, unlink } from 'node:fs/promises';

const HOCH = new URL('../HOCHLADEN/', import.meta.url);
const WELT_ORDNER = new URL('./welt/', HOCH);
/* Seit dem Umzug von Netlify auf GitHub Pages gibt es keine Umschreibungs-
   regeln mehr: _redirects ist dort eine gewoehnliche Datei ohne Wirkung.
   GitHub Pages liefert dafuer von sich aus <name>.html unter /<name> aus.
   Damit die alte Adressform /blog/<slug> -- unter der Links verschickt
   wurden -- weiter funktioniert, wird jede Welt ZWEIMAL geschrieben. Die
   zweite Datei ist Byte fuer Byte dieselbe; welt.html liest den Slug aus
   dem letzten Stueck der Adresse und stoert sich nicht am Ordnernamen. */
const BLOG_ORDNER = new URL('./blog/', HOCH);
const BASIS = 'https://mausemaus.com';

/* ---------- 1. Stempel ---------- */
/* Der Stempel muss VOR dem Vorbauen laufen: die vorgebauten Seiten sind
   Kopien von welt.html und erben dessen frisch gestempelte Adressen. */
console.log('1. Versionsstempel');
await import('./stempel.mjs');

/* ---------- 2. Daten holen ---------- */

const cfg = await readFile(new URL('./assets/config.js', HOCH), 'utf8');
const hole = (feld) => (cfg.match(new RegExp(feld + ":\\s*'([^']*)'")) || [])[1];
const URL_DB = hole('url'), KEY = hole('key');
if (!URL_DB || !KEY || URL_DB.startsWith('HIER_')) {
  console.error('\nFEHLER: In HOCHLADEN/assets/config.js stehen keine Zugangsdaten.');
  process.exit(1);
}

/* Dieselbe Spaltenliste wie assets/db.js -- `notiz` ist fuer "anon" per
   REVOKE gesperrt, ein select=* auf den Bloecken liefert einen Rechtefehler.
   Diese Liste ist Teil des Vertrags mit der Datenbank, nicht nur Zierde. */
const BLOCK_SPALTEN = 'id,seite_id,typ,inhalt,breite,sort_order,created_at,updated_at';
const EINGEBETTET = `select=*,bloecke(${BLOCK_SPALTEN})`;

async function frage(suchteil) {
  const r = await fetch(`${URL_DB}/rest/v1/seiten?${suchteil}&${EINGEBETTET}`,
    { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } });
  if (!r.ok) throw new Error(`HTTP ${r.status} — ${(await r.text()).slice(0, 200)}`);
  return (await r.json()).map(s => {
    if (Array.isArray(s.bloecke)) s.bloecke.sort((a, b) => a.sort_order - b.sort_order);
    return s;
  });
}

console.log('\n2. Daten aus der Datenbank');
let brief, projekte, welten;
try {
  [[brief], projekte, welten] = await Promise.all([
    frage('typ=eq.brief&slug=eq.brief&status=eq.published'),
    frage('typ=eq.projekt&status=eq.published&order=sort_order.asc'),
    frage('typ=eq.welt&status=eq.published&order=sort_order.asc'),
  ]);
} catch (e) {
  console.error('\nFEHLER: Datenbank nicht erreichbar — ' + e.message);
  console.error('Es wurde NICHTS geschrieben. Bitte Netz pruefen und noch einmal versuchen.');
  process.exit(1);
}

/* Lieber abbrechen als eine leere Seite ausliefern: ein seed.js ohne Brief
   waere im Notfall wertlos, und eine sitemap ohne Welten faellt bei Google
   als Rueckschritt auf. */
if (!brief) {
  console.error('\nFEHLER: Keine veroeffentlichte Brief-Seite gefunden. Nichts geschrieben.');
  process.exit(1);
}
console.log(`   Brief: ${brief.bloecke.length} Bloecke`);
console.log(`   Projekte: ${projekte.length}`);
console.log(`   Welten: ${welten.length}${welten.length ? ' (' + welten.map(w => w.slug).join(', ') + ')' : ''}`);

/* ---------- 3. Welten vorbauen ---------- */

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/* Ersetzt den Wert EINES Attributs in genau dem Tag, das die gesuchte id
   traegt. Bewusst eng gefasst: nur bis zum naechsten ">", damit die
   Ersetzung nie ueber das Tag hinausgreift. */
function setzeAttribut(html, id, attr, wert) {
  const muster = new RegExp(`(<[^>]*\\bid="${id}"[^>]*>)`);
  const treffer = html.match(muster);
  if (!treffer) throw new Error(`Tag mit id="${id}" nicht in welt.html gefunden`);
  const neu = treffer[1].replace(new RegExp(`\\b${attr}="[^"]*"`), `${attr}="${esc(wert)}"`);
  return html.replace(muster, neu);
}

console.log('\n3. Welten vorbauen');
const vorlage = await readFile(new URL('./welt.html', HOCH), 'utf8');
await mkdir(WELT_ORDNER, { recursive: true });
await mkdir(BLOG_ORDNER, { recursive: true });

const STANDARD_BILD = `${BASIS}/og-bild.jpg`;
const STANDARD_TEXT = 'Video Editor und Motion Designer in Köln.';

/* Welches Bild die Teilen-Vorschau zeigt. Erste Wahl ist das Coverbild der
   Seite. Hat die Welt keins -- was auf beide heutigen Welten zutrifft --,
   waere die Vorschau trotz aller Muehe wieder das allgemeine og-bild.jpg.
   Deshalb als zweite Wahl das ERSTE Bild aus dem Inhalt: es ist fast immer
   ein besserer Vorgeschmack als das Ausweichbild. GIFs werden dabei
   uebersprungen, weil die Vorschau-Dienste nur das erste Einzelbild zeigen
   und das haeufig schwarz ist. */
const BILD_ZEILE = /!\[[^\]]*\]\(([^)\s]+)\)/;
function vorschauBild(seite) {
  if (seite.cover_url) return seite.cover_url;
  for (const b of seite.bloecke || []) {
    const roh = (b.inhalt && b.inhalt.roh) || '';
    const t = roh.match(BILD_ZEILE);
    if (t && !/\.gif(\?|#|$)/i.test(t[1])) {
      return /^https?:/.test(t[1]) ? t[1] : BASIS + (t[1].startsWith('/') ? '' : '/') + t[1];
    }
  }
  return STANDARD_BILD;
}

for (const w of welten) {
  const titel = `${w.titel} — mausemaus`;
  const adresse = `${BASIS}/welt/${w.slug}`;
  let html = vorlage;
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${esc(titel)}</title>`);
  html = setzeAttribut(html, 'og-title', 'content', titel);
  html = setzeAttribut(html, 'og-description', 'content', w.untertitel || STANDARD_TEXT);
  const bild = vorschauBild(w);
  html = setzeAttribut(html, 'og-image', 'content', bild);
  html = setzeAttribut(html, 'og-url', 'content', adresse);
  html = setzeAttribut(html, 'og-canonical', 'href', adresse);
  html = setzeAttribut(html, 'tw-title', 'content', titel);
  html = setzeAttribut(html, 'tw-description', 'content', w.untertitel || STANDARD_TEXT);
  html = setzeAttribut(html, 'tw-image', 'content', bild);
  await writeFile(new URL(`./${w.slug}.html`, WELT_ORDNER), html);
  await writeFile(new URL(`./${w.slug}.html`, BLOG_ORDNER), html);
  console.log(`   ${w.slug}.html  ${bild === STANDARD_BILD ? '(Ausweichbild — diese Welt hat kein Bild)' : (w.cover_url ? '(Coverbild)' : '(erstes Bild aus dem Inhalt)')}`);
}

/* Welten, die zurueckgezogen oder umbenannt wurden, duerfen nicht als
   verwaiste Datei liegen bleiben -- sie waeren ueber ihre alte Adresse
   weiter erreichbar, obwohl sie nicht mehr veroeffentlicht sind. */
const gewollt = new Set(welten.map(w => w.slug + '.html'));
for (const ordner of [WELT_ORDNER, BLOG_ORDNER]) {
  for (const name of await readdir(ordner)) {
    if (name.endsWith('.html') && !gewollt.has(name)) {
      await unlink(new URL('./' + name, ordner));
      console.log(`   entfernt (nicht mehr veroeffentlicht): ${name}`);
    }
  }
}

/* ---------- 4. _redirects ---------- */

/* WARUM ausdrueckliche Zeilen statt Verlass auf den Dateivorrang:
   Netlify bevorzugt zwar eine echte Datei gegenueber einer Umschreibungs-
   Regel, aber der Nachbau in tests/server.mjs tut das nicht (gemessen) --
   und damit haetten Test und Wirklichkeit unterschiedlich geantwortet. Eine
   ausdrueckliche Zeile ueber der Sammelregel wirkt auf BEIDEN gleich und
   haengt an keiner Feinheit der Vorrangregeln. Unbekannte Slugs fallen
   weiterhin auf die Sammelregel zurueck: eine im Admin neu angelegte Welt
   ist also sofort erreichbar, nur eben ohne eigene Teilen-Vorschau. */
console.log('\n4. _redirects');
const ANFANG = '# --- vorgebaute Welten (erzeugt von tests/hochladen.mjs) ---';
const ENDE   = '# --- Ende vorgebaute Welten ---';
const breite = Math.max(18, ...welten.map(w => w.slug.length + 7));
const zeilen = welten.flatMap(w => ['welt', 'blog'].map(
  pfad => `/${pfad}/${w.slug}`.padEnd(breite + 1) + `/welt/${w.slug}.html`.padEnd(breite + 7) + '200'));
const block = [ANFANG, ...zeilen, ENDE, ''].join('\n');

const pfadR = new URL('./_redirects', HOCH);
let roh = await readFile(pfadR, 'utf8');
roh = roh.includes(ANFANG)
  ? roh.replace(new RegExp(`${ANFANG}[\\s\\S]*?${ENDE}\\n?`), block)
  : block + roh;
await writeFile(pfadR, roh);
console.log(`   ${zeilen.length} Zeilen fuer ${welten.length} Welten`);

/* ---------- 5. seed.js ---------- */

console.log('\n5. seed.js (Notfall-Daten)');
const alt = await readFile(new URL('./assets/seed.js', HOCH), 'utf8');
/* SEED_SETTINGS und SEED_PROJECTS gehoeren zum alten Datenmodell und werden
   von der heutigen Seite nicht mehr gelesen. Sie bleiben trotzdem erhalten:
   sie stehen im alten seed.js und kosten nichts -- und sie zu entfernen ist
   Aufgabe des Aufraeumens, nicht dieses Skripts. */
const altteil = alt.slice(alt.indexOf('window.SEED_SETTINGS'), alt.indexOf('window.SEED_SEITEN'));
const heute = new Date().toLocaleDateString('de-DE');
const neu = `/* mausemaus — Notfall-Daten.
   Werden NUR benutzt, wenn die Datenbank nicht erreichbar ist und auch kein
   Zwischenspeicher im Browser vorliegt. Damit geht die Seite nie leer auf.

   Automatisch erzeugt von tests/hochladen.mjs — Stand: ${heute}.
   NICHT von Hand aendern: der naechste Aufruf ueberschreibt alles. */

${altteil}window.SEED_SEITEN = ${JSON.stringify({ brief, projekte, welten }, null, 2)};
`;
await writeFile(new URL('./assets/seed.js', HOCH), neu);
console.log(`   ${Math.round(neu.length / 1024)} kB (vorher ${Math.round(alt.length / 1024)} kB)`);

/* ---------- 6. sitemap.xml ---------- */

console.log('\n6. sitemap.xml');
const eintrag = (ort, wann) => '  <url>\n    <loc>' + esc(ort) + '</loc>\n' +
  (wann ? `    <lastmod>${String(wann).slice(0, 10)}</lastmod>\n` : '') + '  </url>';
const neueste = [brief, ...projekte].map(s => s.updated_at).filter(Boolean).sort().pop();
const sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  [eintrag(BASIS + '/', neueste), ...welten.map(w => eintrag(`${BASIS}/welt/${w.slug}`, w.updated_at))].join('\n') +
  '\n</urlset>\n';
await writeFile(new URL('./sitemap.xml', HOCH), sitemap);
console.log(`   ${welten.length + 1} Adressen`);

console.log('\nFertig. Jetzt committen und pushen — GitHub Pages veroeffentlicht von selbst.');
