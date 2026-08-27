/* Prüft, was die Seite beim ersten Aufschlagen kostet.

   Drei Dinge waren im Argen, und keines sieht man der Seite an:

     1. fonts.css trug alle sechs Schnitte als base64 in sich -- 172 kB, die
        als <link> im <head> das Zeichnen VOLLSTAENDIG blockierten. Kein
        Buchstabe stand, bevor alle 172 kB da waren, auch die drei Schnitte
        nicht, die auf der Startseite gar nicht vorkommen.
     2. seed.js (75 kB) lag als festes <script> in jeder Seite, obwohl es
        die dritte und letzte Rueckfallstufe ist und im Normalbetrieb nie
        gebraucht wird.
     3. Es gab keine Cache-Regeln. Jeder Besuch holte alles neu.

   Die Zahlen hier sind bewusst GEMESSEN und nicht geschaetzt -- und die
   Obergrenzen sind absichtlich grosszuegig gesetzt: Diese Pruefung soll
   anschlagen, wenn jemand versehentlich wieder ein Riesending in den
   blockierenden Pfad legt, nicht bei jedem Kilobyte Zuwachs meckern. */

import { readFile, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { starteChrome, oeffne, pruefe, bericht } from './chrome.mjs';
import { starteServer } from './server.mjs';

const HOCH = new URL('../HOCHLADEN/', import.meta.url);
const lies = (p) => readFile(new URL(p, HOCH), 'utf8');
const gibtEs = (p) => existsSync(new URL('.' + p, HOCH).pathname);

/* ---------- 1. Der blockierende Pfad ---------- */

const seite = await lies('./index.html');
const stylesheets = [...seite.matchAll(/<link rel="stylesheet" href="(\/assets\/[^"?]+)/g)].map(m => m[1]);
let blockierend = Buffer.byteLength(seite);
for (const s of stylesheets) blockierend += (await stat(new URL('.' + s, HOCH).pathname)).size;

pruefe('es werden überhaupt Stylesheets gefunden', stylesheets.length >= 4, stylesheets.length);
/* Vor dem Herausloesen der Schriften waren es 238 kB. */
pruefe('der Brief blockiert das Zeichnen mit weniger als 100 kB',
  blockierend < 100 * 1024, Math.round(blockierend / 1024) + ' kB (vorher 238 kB)');

/* ---------- 2. Schriften ---------- */

const fonts = await lies('./assets/fonts.css');
pruefe('fonts.css trägt keine eingebetteten Schriften mehr',
  !fonts.includes('base64,'), Math.round(fonts.length / 1024) + ' kB');
const faces = [...fonts.matchAll(/@font-face\s*\{([^}]*)\}/g)].map(m => m[1]);
/* Vier: Manrope (variabel, deckt 200-800 in EINER Datei ab), Space Mono
   400 und 700, Tropi. */
pruefe('es sind überhaupt Schriftschnitte da', faces.length >= 4, faces.length + ' Schnitte');
/* Ohne font-display wartet der Browser bis zu drei Sekunden mit dem Text --
   und zeigt so lange gar nichts. */
pruefe('jeder Schnitt hat font-display:swap',
  faces.every(f => /font-display:\s*swap/.test(f)),
  faces.filter(f => !/font-display:\s*swap/.test(f)).length + ' ohne');

const urls = [...fonts.matchAll(/url\((\/assets\/schriften\/[^)]+)\)/g)].map(m => m[1]);
pruefe('jede Schrift-Adresse in fonts.css zeigt auf eine vorhandene Datei',
  urls.length > 0 && urls.every(gibtEs), urls.filter(u => !gibtEs(u)).join(', ') || urls.length + ' Adressen');

/* Ein toter preload ist schlimmer als keiner: der Browser holt eine Datei,
   die er nie benutzt, und meldet es in der Konsole. */
for (const datei of ['./index.html', './welt.html']) {
  const h = await lies(datei);
  const pre = [...h.matchAll(/<link rel="preload" href="([^"]+)"/g)].map(m => m[1]);
  pruefe(`${datei.slice(2)}: jede vorgeladene Schrift ist wirklich da`,
    pre.length > 0 && pre.every(gibtEs), pre.filter(p => !gibtEs(p)).join(', ') || pre.length + ' vorgeladen');
  /* crossorigin fehlt -> der Browser holt die Datei ein ZWEITES Mal. */
  pruefe(`${datei.slice(2)}: jedes preload trägt crossorigin`,
    (h.match(/<link rel="preload"[^>]*>/g) || []).every(t => t.includes('crossorigin')));
  pruefe(`${datei.slice(2)}: nur die zwei sofort sichtbaren Schnitte werden vorgeladen`,
    pre.length === 2, pre.length + ' vorgeladen');
}

/* Gleiche Bytes unter zwei Namen laesst der Besucher zweimal ueber die
   Leitung -- die drei Space-Grotesk-Schnitte waren genau das. */
const dateien = await readdir(new URL('./assets/schriften/', HOCH));
const groessen = await Promise.all(dateien.map(async n =>
  (await stat(new URL('./assets/schriften/' + n, HOCH).pathname)).size));
pruefe('keine zwei Schriftdateien sind gleich groß (Hinweis auf Doppelte)',
  new Set(groessen).size === groessen.length || dateien.length <= 4,
  dateien.length + ' Dateien');

/* ---------- 3. Cache-Regeln ---------- */

const kopf = await lies('./_headers');
pruefe('_headers hält die eigenen Dateien lange fest', /\/assets\/\*[\s\S]*?immutable/.test(kopf));
/* seed.js traegt KEINEN ?v=-Stempel (es wird nachgeladen) und wird bei jedem
   Hochladen neu geschrieben -- mit "immutable" bekaeme ein Besucher ein Jahr
   lang die alten Notfall-Daten. */
/* ACHTUNG, hier steckte eine Falle, die der Sabotage-Durchlauf gefunden hat:
   Die erste Fassung lautete
       kopf.indexOf('/assets/seed.js') < kopf.indexOf('/assets/*')
   und war GRUEN, auch wenn der Eintrag ganz fehlte -- indexOf liefert dann
   -1, und -1 ist kleiner als jede echte Stelle. Erst ausdruecklich pruefen,
   DASS der Eintrag da ist, und dann, dass er vor der Sammelregel steht
   (Netlify nimmt die erste passende Regel). */
const seedStelle = kopf.indexOf('/assets/seed.js');
const sammelStelle = kopf.indexOf('/assets/*');
pruefe('…nennt seed.js überhaupt', seedStelle !== -1);
pruefe('…und zwar VOR der Sammelregel, sonst greift sie nie',
  seedStelle !== -1 && sammelStelle !== -1 && seedStelle < sammelStelle,
  'seed bei ' + seedStelle + ', Sammelregel bei ' + sammelStelle);
pruefe('…und nimmt es wirklich vom Festhalten aus',
  /\/assets\/seed\.js[\s\S]{0,600}?max-age=0/.test(kopf));
pruefe('_headers hält die HTML-Seiten NICHT fest', /\/\*\.html[\s\S]*?max-age=0/.test(kopf));
for (const z of ['Referrer-Policy', 'X-Content-Type-Options', 'X-Frame-Options']) {
  pruefe(`_headers setzt ${z}`, kopf.includes(z));
}

/* ---------- 3b. Besucherstatistik ----------
   GoatCounter: keine Cookies, keine personenbezogenen Daten, deshalb ohne
   Einwilligungsbanner zulaessig. Zwei Dinge duerfen dabei nie verrutschen:
   das Skript muss `async` sein (sonst haengt die Seite am Zaehldienst) und
   admin.html darf es NICHT bekommen -- Lucas' eigene Arbeit im Editor
   gehoert nicht in seine Besucherzahlen. */
const ZAEHLER = 'mauselucas.goatcounter.com/count';
for (const datei of ['./index.html', './welt.html']) {
  const h = await lies(datei);
  pruefe(`${datei.slice(2)}: zählt Besucher`, h.includes(ZAEHLER));
  pruefe(`${datei.slice(2)}: der Zähler blockiert die Seite nicht (async)`,
    /<script[^>]*goatcounter[^>]*>|<script[^>]*data-goatcounter[\s\S]{0,200}?async/.test(h) &&
    /data-goatcounter[\s\S]{0,200}?\basync\b/.test(h));
}
for (const datei of ['./admin.html']) {
  pruefe(`${datei.slice(2)}: zählt ausdrücklich NICHT mit`,
    !(await lies(datei)).includes('goatcounter'));
}

/* ---------- 4. Im echten Browser ---------- */

const server = await starteServer({ wurzel: HOCH.pathname, port: 8919 });
const chrome = await starteChrome({ port: 9359 });
const s = await oeffne('http://127.0.0.1:8919/', { port: 9359, breite: 1280, hoehe: 900 });
await s.warte(2800);

const m = JSON.parse(await s.werte(`(() => {
  const r = performance.getEntriesByType('resource');
  return JSON.stringify({
    seedGeholt: r.some(e => e.name.includes('seed.js')),
    briefLaenge: document.getElementById('brief').innerHTML.length,
    schriften: r.filter(e => e.name.includes('/schriften/')).map(e => e.name.split('/').pop()),
    regeln: [...document.fonts].length,
    geladen: [...document.fonts].filter(f => f.status === 'loaded').length,
  });
})()`));

/* Der ganze Zweck des Nachladens: im Normalbetrieb GAR NICHT holen. */
pruefe('seed.js wird im Normalbetrieb nicht geholt', !m.seedGeholt);
pruefe('…und der Brief steht trotzdem', m.briefLaenge > 200, m.briefLaenge + ' Zeichen');
pruefe('die Schriftregeln sind alle da', m.regeln >= 4, m.regeln + ' Regeln');
/* Nur die WIRKLICH benutzten Schnitte gehen ueber die Leitung -- das ist der
   Gewinn gegenueber dem einen 172-kB-Block, in dem alles drin war. */
pruefe('es werden weniger Schriftdateien geholt, als Regeln da sind',
  m.schriften.length > 0 && m.schriften.length < m.regeln,
  m.schriften.length + ' von ' + m.regeln + ': ' + m.schriften.join(', '));
pruefe('keine Schriftdatei wird doppelt geholt',
  new Set(m.schriften).size === m.schriften.length, m.schriften.join(', '));

/* ---------- 5. Bildmaße halten den Platz frei ----------

   Ein Bild ohne width/height ist fuer den Browser bis zum Laden 0 Pixel
   hoch: alles darunter springt beim Erscheinen nach unten, und die
   Zeitleiste muss sich neu vermessen. admin.js schreibt die Maße deshalb
   beim Hochladen in den Dateinamen (…-1600x900.webp), shared.js liest sie
   von dort ans <img>.

   Die eigentliche Falle sitzt aber im CSS: .br-text img setzte width:100%
   OHNE height:auto. Damit gaelte fuer die Breite das Stylesheet, fuer die
   Hoehe aber weiter das Attribut -- jedes neue Bild waere gestaucht. Das
   sieht man erst am fertigen Bild, deshalb wird hier GEMESSEN. */
const bild = JSON.parse(await s.werte(`(() => {
  const p = document.createElement('div');
  p.className = 'br-text';
  p.innerHTML = window.mm.renderMarkdown('![](/assets/probe-1600x900.webp)');
  document.querySelector('#brief').appendChild(p);
  const img = p.querySelector('img');
  const st = getComputedStyle(img);
  const r = img.getBoundingClientRect();
  const erg = {
    attrBreite: img.getAttribute('width'),
    attrHoehe: img.getAttribute('height'),
    cssHoehe: st.height,
    hoeheAuto: st.height !== '900px',
    verhaeltnis: r.width > 0 ? +(r.width / r.height).toFixed(2) : 0,
  };
  p.remove();
  return JSON.stringify(erg);
})()`));

pruefe('ein Bild mit Maßen im Namen trägt sie als width/height',
  bild.attrBreite === '1600' && bild.attrHoehe === '900',
  bild.attrBreite + '×' + bild.attrHoehe);
pruefe('…und wird dadurch NICHT auf die Attributhöhe gezwungen',
  bild.hoeheAuto, 'gezeichnete Höhe: ' + bild.cssHoehe);
/* 16:9 = 1,78. Waere height:auto vergessen, kaeme hier etwas anderes heraus. */
pruefe('…sondern behält sein Seitenverhältnis (16:9 ≈ 1,78)',
  Math.abs(bild.verhaeltnis - 1.78) < 0.06, bild.verhaeltnis + ':1');

const jsF = s.fehlerAufSeite();
pruefe('keine JavaScript-Fehler', jsF.length === 0, jsF.join(' | '));

await s.zu(); chrome.beenden(); server.beenden();
bericht();
