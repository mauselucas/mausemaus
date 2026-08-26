/* Versionsstempel für alle eigenen Dateien in den HTML-Seiten setzen.

   Warum das nötig ist: Ohne `?v=…` merkt sich der Browser eine einmal
   geladene CSS- oder JS-Datei und benutzt sie weiter -- auch wenn auf dem
   Server längst eine neue liegt. Eine Reparatur ist dann zwar hochgeladen,
   kommt aber tagelang nicht beim Besucher an. Genau das ist hier passiert:
   admin.html hatte Stempel, index.html und welt.html nicht.

   Aufruf vor jedem Hochladen:   node tests/stempel.mjs
   Danach zeigt es, was sich geändert hat.

   Absichtlich KEIN Zufallswert und kein Zeitstempel bei jedem Aufruf: Der
   Stempel ist die höchste Änderungszeit aller gestempelten Dateien. Wer
   nichts ändert, bekommt denselben Stempel -- sonst würde jeder Aufruf den
   Zwischenspeicher aller Besucher wegwerfen, ohne dass es einen Grund gäbe. */
import { readdir, readFile, writeFile, stat } from 'node:fs/promises';

const HOCH = new URL('../HOCHLADEN/', import.meta.url);
const assets = new URL('./assets/', HOCH);

/* Höchste Änderungszeit über alle Dateien, die überhaupt gestempelt werden. */
const dateien = (await readdir(assets)).filter(n => n.endsWith('.css') || n.endsWith('.js'));
let neueste = 0;
for (const n of dateien) {
  const s = await stat(new URL(n, assets));
  if (s.mtimeMs > neueste) neueste = s.mtimeMs;
}
const stempel = Math.floor(neueste / 1000);

const seiten = (await readdir(HOCH)).filter(n => n.endsWith('.html'));
let geaendert = 0;

for (const name of seiten) {
  const pfad = new URL(name, HOCH);
  const vorher = await readFile(pfad, 'utf8');
  /* Nur EIGENE Dateien unter /assets/ stempeln -- fremde Adressen (CDN,
     Schriftdienste) haben ihre eigene Zwischenspeicher-Regelung und
     dürfen nicht angefasst werden. */
  const nachher = vorher.replace(
    /(["'])(\/assets\/[A-Za-z0-9._-]+\.(?:css|js))(?:\?v=\d+)?\1/g,
    (_, q, datei) => `${q}${datei}?v=${stempel}${q}`);
  if (nachher !== vorher) {
    await writeFile(pfad, nachher);
    geaendert++;
    console.log('  gestempelt: ' + name);
  } else {
    console.log('  unverändert: ' + name);
  }
}

console.log(`\nStempel: ?v=${stempel}  (${new Date(neueste).toLocaleString('de-DE')})`);
console.log(`${geaendert} von ${seiten.length} Seiten angepasst.`);
