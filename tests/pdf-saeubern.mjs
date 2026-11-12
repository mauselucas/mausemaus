/* Macht aus einer PDF eine Fassung ohne jede Herkunftsspur -- für Dokumente
   auf der Leseseite (/lesen.html, Ablage HOCHLADEN/dokumente/).

     node tests/pdf-saeubern.mjs ~/Desktop/Zeugnis.pdf zeugnis-firma

   Warum nicht einfach exiftool? Bei PDFs hängt exiftool die Löschung nur
   hinten an; die alte Fassung mit allen Angaben bleibt in der Datei und
   lässt sich wiederherstellen. Hier wird die PDF stattdessen NEU gebaut:

   - Gedacht für PDFs, deren Seiten je ein Bild sind (Scan, Screenshot,
     "Als PDF sichern" eines Bildes). Für alles andere bricht es ab, statt
     still etwas Halbes zu liefern -- dann bitte Claude fragen.
   - Aus jedem Bild fliegen Exif (Datum, Gerät, "Screenshot"), Farbprofil
     und Kommentare raus; die Bilddaten selbst bleiben Bit für Bit gleich.
   - Die neue PDF hat keine Info, kein XMP, keine ID, kein Programm.

   Danach: tests/pruefe-lesen.mjs prüft jede PDF in /dokumente/ genau darauf.
   Der Link im Admin lautet dann
     [Text](/lesen.html?d=zeugnis-firma&t=Arbeitszeugnis%20Firma) */
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const werkzeug = fileURLToPath(new URL('./.werkzeug/', import.meta.url));
const req = createRequire(werkzeug + 'x.js');
let lib;
try { lib = req('pdf-lib'); } catch {
  execSync(`npm install --no-save --no-audit --no-fund --prefix "${werkzeug}" pdf-lib@1.17.1`, { stdio: 'ignore' });
  lib = req('pdf-lib');
}
const { PDFDocument, PDFName, PDFRawStream, PDFDict } = lib;

const [ein, name] = process.argv.slice(2);
if (!ein || !/^[a-z0-9-]{1,80}$/.test(name || '')) {
  console.error('Aufruf: node tests/pdf-saeubern.mjs <datei.pdf> <name-nur-a-z-0-9-bindestrich>');
  process.exit(1);
}

function nacktesJpeg(roh) {
  if (roh[0] !== 0xFF || roh[1] !== 0xD8) throw new Error('Bild ist kein JPEG');
  const teile = [roh.subarray(0, 2)];
  let i = 2;
  while (i < roh.length) {
    if (roh[i] !== 0xFF) throw new Error('JPEG unlesbar');
    const m = roh[i + 1];
    if (m === 0xDA) { teile.push(roh.subarray(i)); break; }
    const len = roh.readUInt16BE(i + 2);
    if (!((m >= 0xE0 && m <= 0xEF) || m === 0xFE)) teile.push(roh.subarray(i, i + 2 + len));
    i += 2 + len;
  }
  return Buffer.concat(teile);
}

const alt = await PDFDocument.load(readFileSync(ein), { updateMetadata: false });
const neu = await PDFDocument.create({ updateMetadata: false });
for (const [n, seite] of alt.getPages().entries()) {
  const { width, height } = seite.getSize();
  const res = seite.node.Resources();
  const xo = res && res.lookup(PDFName.of('XObject'), PDFDict);
  const bilder = xo ? xo.entries().map(([, ref]) => alt.context.lookup(ref))
    .filter(o => o instanceof PDFRawStream && String(o.dict.get(PDFName.of('Subtype'))) === '/Image') : [];
  const schrift = res && res.lookup(PDFName.of('Font'));
  if (bilder.length !== 1 || schrift) {
    throw new Error(`Seite ${n + 1} ist kein einzelnes Bild (${bilder.length} Bilder${schrift ? ', mit Text' : ''}). Dieses Werkzeug ist dafür nicht gebaut.`);
  }
  const filter = String(bilder[0].dict.get(PDFName.of('Filter')));
  if (filter !== '/DCTDecode') throw new Error(`Seite ${n + 1}: Bildformat ${filter} wird nicht unterstützt (nur JPEG).`);
  const bild = await neu.embedJpg(nacktesJpeg(Buffer.from(bilder[0].contents)));
  neu.addPage([width, height]).drawImage(bild, { x: 0, y: 0, width, height });
}
const ziel = fileURLToPath(new URL(`../HOCHLADEN/dokumente/${name}.pdf`, import.meta.url));
writeFileSync(ziel, await neu.save({ useObjectStreams: false }));
console.log(`Sauber gespeichert: HOCHLADEN/dokumente/${name}.pdf (${alt.getPageCount()} Seite(n))`);
