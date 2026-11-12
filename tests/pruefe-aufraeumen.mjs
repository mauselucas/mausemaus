/* Online geht nicht HOCHLADEN selbst, sondern eine aufgeräumte Fassung
   ohne Kommentare (tests/aufraeumen.mjs, läuft auf GitHub bei jedem Push).
   Diese Prüfung stellt sicher, dass das Aufräumen nichts kaputtmacht:

   - In der aufgeräumten Fassung steht kein einziger Kommentar mehr.
   - Die aufgeräumte Seite zeigt WÖRTLICH denselben Text wie das Original,
     auf Deutsch und auf Englisch, und wirft keine Fehler.
   - Welt-Seite, Fehlerseite und Admin laden ebenfalls fehlerfrei. */
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, extname, relative } from 'node:path';
import { starteChrome, oeffne, pruefe, bericht } from './chrome.mjs';
import { starteServer } from './server.mjs';
import { aufraeumen } from './aufraeumen.mjs';

const quelle = new URL('../HOCHLADEN/', import.meta.url).pathname;
const ziel = await mkdtemp(join(tmpdir(), 'mm-aufgeraeumt-'));
const liste = await aufraeumen(quelle, ziel);
pruefe('das Aufräumen läuft durch', liste.length > 30, `${liste.length} Dateien`);

/* ================= Keine Kommentare mehr ================= */
const reste = [];
async function suche(ordner) {
  for (const e of await readdir(ordner, { withFileTypes: true })) {
    const pfad = join(ordner, e.name);
    if (e.isDirectory()) { await suche(pfad); continue; }
    const rel = relative(ziel, pfad);
    if (/vendor\/|scroll-timeline\.js$|\.min\./.test(rel)) continue;
    const endung = extname(e.name);
    if (!['.js', '.mjs', '.css', '.html', '.svg'].includes(endung)) continue;
    const zeilen = (await readFile(pfad, 'utf8')).split('\n');
    zeilen.forEach((z, i) => {
      if (/<!--/.test(z) || /^\s*(\/\*|\/\/)/.test(z) || /\*\/\s*$/.test(z)) reste.push(`${rel}:${i + 1}`);
    });
  }
}
await suche(ziel);
pruefe('kein Kommentar mehr in HTML, CSS und JavaScript', reste.length === 0, reste.slice(0, 5).join(', '));
const index = await readFile(join(ziel, 'index.html'), 'utf8');
pruefe('…aber die Seite selbst ist noch da (Sprachumschalter, Formular)',
  index.includes('id="mm-sprache"') && index.includes('id="anfragen"'));

/* ================= Gleiche Seite wie das Original ================= */
const original = await starteServer({ wurzel: quelle, port: 8941 });
const sauber = await starteServer({ wurzel: ziel, port: 8942 });
const chrome = await starteChrome({ port: 9381 });
const ORIG = 'http://127.0.0.1:8941/', NEU = 'http://127.0.0.1:8942/';

const briefText = `JSON.stringify({ text: document.getElementById('brief')?.innerText || '',
  lang: document.documentElement.lang, karten: document.querySelectorAll('.br-abschnitt').length })`;
async function lies(adresse, bereit, ausdruck) {
  const s = await oeffne(adresse, { port: 9381, breite: 1440, hoehe: 900 });
  await s.bisWahr(bereit, 20000);
  const wert = await s.werte(ausdruck);
  const fehler = s.fehlerAufSeite();
  await s.zu();
  return { wert, fehler };
}
const BRIEF_BEREIT = `!document.getElementById('mm-laden') && !!window.mmProjekte`;

for (const [name, pfad] of [['Deutsch', ''], ['Englisch', '?lang=en']]) {
  const a = await lies(ORIG + pfad, BRIEF_BEREIT, briefText);
  const b = await lies(NEU + pfad, BRIEF_BEREIT, briefText);
  const A = JSON.parse(a.wert), B = JSON.parse(b.wert);
  pruefe(`${name}: aufgeräumte Seite zeigt denselben Brief wie das Original`,
    A.text.length > 200 && A.text === B.text && A.karten === B.karten, `${A.text.length} / ${B.text.length} Zeichen`);
  pruefe(`${name}: …in der richtigen Sprache`, B.lang === (pfad ? 'en' : 'de'), B.lang);
  pruefe(`${name}: …ohne JS-Fehler`, b.fehler.length === 0, b.fehler.join(' | '));
}

/* Eine vorgebaute Welt, die Fehlerseite und das Admin. */
const welt = (await readdir(join(ziel, 'welt'))).find(n => n.endsWith('.html'));
const seiten = [
  ['Welt-Seite', 'welt/' + welt, `document.readyState === 'complete' && document.body.innerText.length > 100`],
  ['Fehlerseite', '404.html', `document.readyState === 'complete'`],
  ['Admin', 'admin.html', `document.readyState === 'complete' && !!document.getElementById('login-form')`],
];
for (const [name, pfad, bereit] of seiten) {
  const text = `document.title + '|' + (document.querySelector('main, #login, body')?.innerText || '').slice(0, 2000)`;
  const a = await lies(ORIG + pfad, bereit, text);
  const b = await lies(NEU + pfad, bereit, text);
  pruefe(`${name}: aufgeräumt wie das Original`, a.wert === b.wert && a.wert.length > 5, `${a.wert.length} / ${b.wert.length}`);
  pruefe(`${name}: …ohne JS-Fehler`, b.fehler.length === 0, b.fehler.join(' | '));
}

chrome.beenden(); original.beenden(); sauber.beenden();
await rm(ziel, { recursive: true, force: true });
bericht();
