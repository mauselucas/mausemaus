/* Holt die Schriften aus assets/fonts.css heraus und legt sie als eigene
   Dateien unter assets/schriften/ ab.

       node tests/schriften-loesen.mjs

   Einmalig noetig -- danach ist fonts.css klein und bleibt es.

   WARUM: fonts.css trug alle sechs Schnitte als base64 IM Stylesheet, war
   dadurch 172 kB gross und stand als <link> im <head>. Ein Stylesheet im
   <head> blockiert das Zeichnen der Seite, und zwar VOLLSTAENDIG: der
   Browser zeigt keinen einzigen Buchstaben, bevor er alle 172 kB geholt und
   verarbeitet hat -- auch die drei Schnitte, die auf der Startseite gar
   nicht vorkommen. Als eigene Dateien laden die Schriften nebenher, jede
   fuer sich, und der Text steht sofort.

   Dazu font-display:swap -- ohne diese Angabe wartet der Browser bis zu drei
   Sekunden mit dem Text, falls eine Schrift haengt. Mit swap steht der Text
   sofort in der Ersatzschrift und wechselt nach.

   Das Skript ist absichtlich nur EINMAL noetig und meldet sich beim zweiten
   Aufruf ab, statt eine schon herausgeloeste Datei erneut zu zerlegen. */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const ASSETS = new URL('../HOCHLADEN/assets/', import.meta.url);
const ZIEL = new URL('./schriften/', ASSETS);

const roh = await readFile(new URL('./fonts.css', ASSETS), 'utf8');
if (!roh.includes('base64,')) {
  console.log('fonts.css enthaelt keine eingebetteten Schriften mehr — nichts zu tun.');
  process.exit(0);
}

await mkdir(ZIEL, { recursive: true });

/* Welche Schnitte oberhalb der Falz stehen, also sofort gebraucht werden:
   der grosse Gruss (Tropi) und der Fliesstext (Space Grotesk 400). Nur
   diese beiden werden spaeter vorgeladen -- alles vorzuladen hiesse, den
   Vorteil wieder herzugeben. */
const SOFORT = [['TropiWeb', 400], ['Manrope', 400]];

const bloecke = [...roh.matchAll(/@font-face\s*\{([^}]*)\}/g)];
const neu = [];
const vorladen = [];
/* Gleicher Inhalt -> gleiche Datei. Die drei Space-Grotesk-Schnitte (400,
   500, 700) sind byte-identisch: dreimal dieselbe Schrift unter drei Namen,
   also 44 kB, die ein Besucher zweimal umsonst holt. Ueber den
   Fingerabdruck faellt das von selbst auf, und alle drei @font-face-Regeln
   zeigen danach auf EINE Datei. Am Aussehen aendert das nichts -- es sind
   dieselben Bytes. */
const schonDa = new Map();

for (const [, blk] of bloecke) {
  const fam = (blk.match(/font-family:\s*'([^']*)'/) || [])[1];
  const stil = (blk.match(/font-style:\s*(\w+)/) || [, 'normal'])[1];
  const gew = (blk.match(/font-weight:\s*(\d+)/) || [, '400'])[1];
  const b64 = (blk.match(/base64,([A-Za-z0-9+/=]+)/) || [])[1];
  if (!fam || !b64) { console.warn('  uebersprungen (kein Name oder keine Daten)'); continue; }

  const daten = Buffer.from(b64, 'base64');
  /* Ein Stueck des Inhalts-Fingerabdrucks steckt im Dateinamen. Grund:
     _headers gibt allem unter /assets/ ein Jahr "immutable" mit. Fuer CSS
     und JS ist das sicher, weil tests/stempel.mjs ihnen ein ?v= anhaengt --
     Schriften bekommen diesen Stempel aber NICHT (das Skript stempelt nur
     .css und .js). Ohne den Fingerabdruck im Namen bliebe eine je
     ausgetauschte Schrift bei allen Besuchern ein Jahr lang die alte.
     Aendert sich die Datei, aendert sich der Name -- und damit die Adresse. */
  const fp = createHash('sha256').update(daten).digest('hex').slice(0, 8);
  let name = schonDa.get(fp);
  if (name) {
    console.log(`  ${(fam + ' ' + gew).padEnd(26)}      -> dieselbe Datei wie ${name}`);
  } else {
    name = fam.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + gew +
           (stil !== 'normal' ? '-' + stil : '') + '-' + fp + '.woff2';
    schonDa.set(fp, name);
    await writeFile(new URL('./' + name, ZIEL), daten);
    console.log(`  ${name.padEnd(32)} ${String(Math.round(daten.length / 1024)).padStart(4)} kB`);
  }

  neu.push(`@font-face { font-family: '${fam}'; font-style: ${stil}; font-weight: ${gew};` +
           `\n  src: url(/assets/schriften/${name}) format('woff2'); font-display: swap; }`);
  if (SOFORT.some(([f, g]) => f === fam && String(g) === gew)) vorladen.push(name);
}

const kopf = `/* mausemaus — Schriften (Tropi, Space Grotesk, Space Mono).
   Wird von index.html, welt.html, admin.html UND 404.html geladen.

   Die Schnitte lagen frueher als base64 IN dieser Datei -- 172 kB, die das
   Zeichnen der Seite vollstaendig blockierten, bevor ein einziger Buchstabe
   stand. Jetzt liegen sie als eigene Dateien in assets/schriften/ und laden
   nebenher. Erzeugt von tests/schriften-loesen.mjs.

   font-display:swap heisst: der Text steht SOFORT in der Ersatzschrift und
   wechselt nach, sobald die richtige da ist. Ohne diese Angabe wartet der
   Browser bis zu drei Sekunden -- und zeigt so lange gar nichts. */

`;
await writeFile(new URL('./fonts.css', ASSETS), kopf + neu.join('\n') + '\n');

console.log(`\nfonts.css: ${Math.round(roh.length / 1024)} kB -> ` +
  `${Math.round((kopf + neu.join('\n')).length / 1024)} kB`);
console.log('\nDiese zwei Schnitte gehoeren als <link rel="preload"> in index.html:');
vorladen.forEach(n => console.log(`  /assets/schriften/${n}`));
