/* Alles, was VOR dem Hochladen passieren muss — ein Befehl.

       node tests/hochladen.mjs

   Der Reihe nach:
     1. Versionsstempel setzen (tests/stempel.mjs, unveraendert uebernommen)
     2. Daten aus Supabase holen
     3. je veroeffentlichter Welt eine vorgebaute Seite mit echten
        Teilen-Vorschau-Angaben schreiben (HOCHLADEN/welt/<slug>.html)
     4. assets/seed.js neu schreiben (die Notfall-Daten)
     5. sitemap.xml schreiben

   KEINE _redirects mehr: GitHub Pages liest die Datei nicht. Die schoenen
   Adressen /welt/<slug> und /blog/<slug> funktionieren, weil der Hoster von
   sich aus <name>.html anhaengt -- gemessen, siehe tests/server.mjs.

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
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const lauf = promisify(execFile);

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
const VORSCHAU_ORDNER = new URL('./vorschau/', HOCH);
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
  if (!treffer) throw new Error(`Tag mit id="${id}" nicht gefunden`);
  const neu = treffer[1].replace(new RegExp(`\\b${attr}="[^"]*"`), `${attr}="${esc(wert)}"`);
  return html.replace(muster, neu);
}

/* Die preconnect-Zeile mit assets/config.js gleichziehen. Sie nennt dieselbe
   Datenbankadresse ein zweites Mal -- und zwei Stellen, die dasselbe sagen,
   laufen frueher oder spaeter auseinander. Hier wird die zweite aus der
   ersten gesetzt, statt sich darauf zu verlassen, dass jemand daran denkt. */
for (const name of ['index.html', 'welt.html']) {
  const pfad = new URL('./' + name, HOCH);
  const vorher = await readFile(pfad, 'utf8');
  const nachher = setzeAttribut(vorher, 'db-preconnect', 'href', URL_DB);
  if (nachher !== vorher) { await writeFile(pfad, nachher); console.log(`   preconnect in ${name} angeglichen`); }
}

console.log('\n3. Welten vorbauen');
const vorlage = await readFile(new URL('./welt.html', HOCH), 'utf8');
await mkdir(WELT_ORDNER, { recursive: true });
await mkdir(BLOG_ORDNER, { recursive: true });
await mkdir(VORSCHAU_ORDNER, { recursive: true });

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

/* Aus dem Vorschaubild ein JPEG in 1200x630 machen.

   WARUM: Die Bilder aus dem Admin liegen als WebP in Supabase. WhatsApp,
   Facebook und LinkedIn zeigen WebP als og:image unzuverlaessig bis gar
   nicht -- und genau das ist das Bild, das Lucas sieht, wenn er einen
   Projektlink verschickt. Auf der Seite SELBST bleibt das WebP; nur die
   Teilen-Vorschau bekommt eine JPEG-Fassung.

   1200x630 ist das Format, das alle Dienste erwarten. Zugeschnitten statt
   verzerrt: erst so weit vergroessern, dass beide Seiten reichen, dann aus
   der Mitte ausschneiden.

   Faellt ffmpeg aus oder ist das Bild nicht erreichbar, wird die
   Originaladresse weiterverwendet und eine Warnung gedruckt -- lieber eine
   WebP-Vorschau als ein Abbruch mitten im Hochladen. */
let ffmpegDa = true;
try { await lauf('which', ['ffmpeg']); } catch { ffmpegDa = false; }
if (!ffmpegDa) console.log('   HINWEIS: ffmpeg fehlt — Vorschaubilder bleiben, wie sie sind (brew install ffmpeg)');

async function vorschauJpeg(slug, quelle) {
  if (!ffmpegDa || quelle === STANDARD_BILD) return quelle;   /* og-bild.jpg ist schon 1200x630 JPEG */
  const ziel = new URL(`./${slug}.jpg`, VORSCHAU_ORDNER);
  try {
    const a = await fetch(quelle);
    if (!a.ok) throw new Error('HTTP ' + a.status);
    const roh = join(tmpdir(), `vorschau-${slug}`);
    await writeFile(roh, Buffer.from(await a.arrayBuffer()));
    await lauf('ffmpeg', ['-y', '-v', 'error', '-i', roh,
      '-vf', 'scale=1200:630:force_original_aspect_ratio=increase,crop=1200:630',
      '-q:v', '4', ziel.pathname]);
    await unlink(roh).catch(() => {});
    return `${BASIS}/vorschau/${slug}.jpg`;
  } catch (e) {
    console.log(`   WARNUNG: Vorschaubild fuer ${slug} nicht gewandelt (${e.message}) — nehme das Original`);
    return quelle;
  }
}

for (const w of welten) {
  const titel = `${w.titel} — mausemaus`;
  const adresse = `${BASIS}/welt/${w.slug}`;
  let html = vorlage;
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${esc(titel)}</title>`);
  html = setzeAttribut(html, 'og-title', 'content', titel);
  html = setzeAttribut(html, 'og-description', 'content', w.untertitel || STANDARD_TEXT);
  html = setzeAttribut(html, 'meta-description', 'content', w.untertitel || STANDARD_TEXT);
  const quelle = vorschauBild(w);
  const bild = await vorschauJpeg(w.slug, quelle);
  html = setzeAttribut(html, 'og-image', 'content', bild);
  html = setzeAttribut(html, 'og-url', 'content', adresse);
  html = setzeAttribut(html, 'og-canonical', 'href', adresse);
  html = setzeAttribut(html, 'tw-title', 'content', titel);
  html = setzeAttribut(html, 'tw-description', 'content', w.untertitel || STANDARD_TEXT);
  html = setzeAttribut(html, 'tw-image', 'content', bild);
  await writeFile(new URL(`./${w.slug}.html`, WELT_ORDNER), html);
  await writeFile(new URL(`./${w.slug}.html`, BLOG_ORDNER), html);
  const woher = quelle === STANDARD_BILD ? 'Ausweichbild — diese Welt hat kein Bild'
    : (w.cover_url ? 'Coverbild' : 'erstes Bild aus dem Inhalt');
  console.log(`   ${w.slug}.html  (${woher}${bild.endsWith('.jpg') && quelle !== STANDARD_BILD ? ', als JPEG fuer die Teilen-Vorschau' : ''})`);
}

/* Welten, die zurueckgezogen oder umbenannt wurden, duerfen nicht als
   verwaiste Datei liegen bleiben -- sie waeren ueber ihre alte Adresse
   weiter erreichbar, obwohl sie nicht mehr veroeffentlicht sind. */
const gewollt = new Set(welten.flatMap(w => [w.slug + '.html', w.slug + '.jpg']));
for (const ordner of [WELT_ORDNER, BLOG_ORDNER, VORSCHAU_ORDNER]) {
  for (const name of await readdir(ordner)) {
    if (/\.(html|jpg)$/.test(name) && !gewollt.has(name)) {
      await unlink(new URL('./' + name, ordner));
      console.log(`   entfernt (nicht mehr veroeffentlicht): ${name}`);
    }
  }
}

/* ---------- 4. seed.js ---------- */

console.log('\n4. seed.js (Notfall-Daten)');
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

/* ---------- 5. sitemap.xml ---------- */

console.log('\n5. sitemap.xml');
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
