/* Wandelt das Katzen-GIF fuers Anfrageformular in ein animiertes WebP und
   ein Standbild.

       node tests/katze-wandeln.mjs

   Nur noetig, wenn das GIF ausgetauscht wird. Beim zweiten Aufruf mit
   demselben GIF meldet sich das Skript ab, statt dieselben Dateien noch
   einmal zu erzeugen.

   WARUM nicht das GIF selbst: 2,3 MB fuer anderthalb Sekunden Katze. Ein
   GIF kennt nur 256 Farben und keine echte Kompression zwischen den Bildern
   -- deshalb ist es fuer bewegte Bilder das teuerste Format, das es gibt.

   WARUM animiertes WebP und nicht <video>: Das GIF ist zu 58,6 % durch-
   sichtig -- die Katze schwebt frei, sie sitzt nicht in einem weissen
   Kasten. Ein Video kann das nur mit Klimmzuegen: VP9 kann Alpha (Chrome,
   Firefox), Safari braucht dafuer HEVC mit Alphaebene, und der Versuch,
   das hier zu erzeugen, warf die Alphaebene still weg (gemessen: pix_fmt
   kam als yuv420p zurueck, ohne Alpha). Ein Video mit weissem Grund haette
   einen sichtbaren Kasten auf dem Papierton der Seite ergeben.
   Animiertes WebP kann Alpha, koennen alle drei Browser, und es laedt
   ohnehin erst NACH dem Absenden -- beim Seitenaufruf kostet es null Byte.

   Die drei Stellschrauben und was sie gebracht haben (gemessen):
     Ausgangsdatei                      2.323.051 B
     nur kleiner (320 statt 484 px)       235.546 B
     dazu 25 statt 50 Bilder/Sekunde      139.328 B   <- das hier
   Also rund ein Siebzehntel. 25 Bilder pro Sekunde reichen fuer eine
   Schleife von 1,7 Sekunden voellig; das GIF hatte 50, was man nicht sieht,
   aber bezahlt. */

import { readFile, readdir, mkdtemp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const lauf = promisify(execFile);
const HOCH = new URL('../HOCHLADEN/', import.meta.url);
const ASSETS = new URL('./assets/', HOCH);
/* Das GIF liegt bewusst NICHT in HOCHLADEN/: dort waere es oeffentlich
   abrufbar und 2,3 MB gross, obwohl es niemand je anfordert. quellen/ wird
   nicht veroeffentlicht. */
const QUELLE = new URL('../quellen/maxwell-meme-rainbow.gif', import.meta.url);

const BREITE = 320;      /* Anzeigebreite ist 160 px — das Doppelte fuer Retina */
const BILDER = 25;       /* pro Sekunde */
const GUETE = 40;        /* img2webp -q */

if (!existsSync(QUELLE.pathname)) {
  console.error(`FEHLER: ${QUELLE.pathname} fehlt. Ohne Quelldatei gibt es nichts zu wandeln.`);
  process.exit(1);
}

for (const werkzeug of ['ffmpeg', 'ffprobe', 'img2webp', 'cwebp']) {
  try { await lauf('which', [werkzeug]); }
  catch {
    console.error(`FEHLER: "${werkzeug}" ist nicht installiert. brew install ffmpeg webp`);
    process.exit(1);
  }
}

const gif = await readFile(QUELLE);
const fp = createHash('sha256').update(gif).digest('hex').slice(0, 8);
const bewegt = new URL(`./katze-${fp}.webp`, ASSETS);
const ruhig  = new URL(`./katze-${fp}-standbild.webp`, ASSETS);

if (existsSync(bewegt.pathname) && existsSync(ruhig.pathname)) {
  console.log(`Schon gewandelt: katze-${fp}.webp — nichts zu tun.`);
  process.exit(0);
}

/* ---------- 1. bewegt ---------- */
/* Der Umweg ueber eine PNG-Folge ist Absicht und kein Zufall: PNG traegt den
   Alphakanal, ein Paletten-GIF nicht (siehe Falle oben). img2webp setzt die
   Bilder dann zu einem animierten WebP zusammen. */
const ordner = await mkdtemp(join(tmpdir(), 'katze-'));
await lauf('ffmpeg', ['-y', '-v', 'error', '-i', QUELLE.pathname,
  '-vf', `fps=${BILDER},scale=${BREITE}:-2:flags=lanczos`, join(ordner, 'f%03d.png')]);
const einzelbilder = (await readdir(ordner)).filter(n => n.endsWith('.png')).sort()
  .map(n => join(ordner, n));
if (!einzelbilder.length) { console.error('FEHLER: ffmpeg hat keine Einzelbilder erzeugt.'); process.exit(1); }
await lauf('img2webp', ['-loop', '0', '-lossy', '-q', String(GUETE), '-m', '6',
  '-d', String(Math.round(1000 / BILDER)), ...einzelbilder, '-o', bewegt.pathname]);

/* ---------- 2. Standbild ---------- */
/* Fuer alle, die "Bewegung reduzieren" eingeschaltet haben. Bewusst nicht
   das erste Bild: bei vielen GIFs ist das leer oder halb aufgebaut.
   Stattdessen aus der Mitte. */
const dauer = Number((await lauf('ffprobe', ['-v', 'error', '-show_entries',
  'format=duration', '-of', 'default=nw=1:nk=1', QUELLE.pathname])).stdout.trim());
const einzel = join(ordner, 'standbild.png');
await lauf('ffmpeg', ['-y', '-v', 'error', '-ss', String(dauer / 2), '-i', QUELLE.pathname,
  '-frames:v', '1', '-vf', `scale=${BREITE}:-2:flags=lanczos`, einzel]);
/* -alpha_q 100: die Durchsichtigkeit verlustfrei, sonst franst der Rand aus. */
await lauf('cwebp', ['-q', '80', '-alpha_q', '100', '-quiet', einzel, '-o', ruhig.pathname]);

await rm(ordner, { recursive: true, force: true });

/* ---------- 2b. Nachpruefen, dass die Durchsichtigkeit da ist ----------
   Ohne diese Zeilen faellt ein weisser Kasten erst auf der fertigen Seite
   auf. Im WebP-Kopf steht ein Merkmalsfeld; Bit 4 des Bytes an Stelle 20
   sagt "hat Alpha". */
for (const [was, datei] of [['bewegt', bewegt], ['Standbild', ruhig]]) {
  const kopf = (await readFile(datei)).subarray(0, 24);
  const hatVP8X = kopf.subarray(12, 16).toString() === 'VP8X';
  const hatAlpha = hatVP8X && (kopf[20] & 0x10) !== 0;
  if (!hatAlpha) {
    console.error(`FEHLER: ${was} hat KEINEN Alphakanal — die Katze bekaeme einen weissen Kasten.`);
    process.exit(1);
  }
}

/* ---------- 3. Bericht ---------- */
const masse = (await lauf('ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height',
  '-of', 'csv=p=0:s=x', bewegt.pathname])).stdout.trim();
const gr = async (u) => (await readFile(u)).length;
const [aB, bB, sB] = [gif.length, await gr(bewegt), await gr(ruhig)];

console.log(`\nQuelle    quellen/maxwell-…gif        ${aB.toLocaleString('de-DE')} B`);
console.log(`bewegt    katze-${fp}.webp            ${bB.toLocaleString('de-DE')} B` +
  `   (${(aB / bB).toFixed(1)}× kleiner, ${masse})`);
console.log(`Standbild katze-${fp}-standbild.webp  ${sB.toLocaleString('de-DE')} B`);
console.log('\nDie beiden Dateinamen gehoeren nach HOCHLADEN/index.html — der');
console.log('Fingerabdruck aendert sich, sobald das GIF ausgetauscht wird.');
