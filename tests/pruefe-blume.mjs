/* Prüft, dass die Blume nirgends abgeschnitten wird.

   Der Fehler, aus dem diese Prüfung entstanden ist: Beim Ladeschirm und in
   der Designfibel habe ich die viewBox mit "0 0 290 300" angegeben -- eine
   Zahl, die ich geschätzt und nie nachgemessen habe. Die echten Ausmaße des
   Pfades sind 303.13 × 275.3. Die falsche Angabe schnitt rechts 13.13
   Einheiten ab und hängte unten 24.69 leere an. Die Blume war dadurch an
   zwei Kanten flach abgesägt.

   Besonders ärgerlich: Ich habe in dieser Zeit mehrfach Bildschirmfotos vom
   Ladeschirm gemacht und die abgeschnittene Blume angesehen, ohne sie zu
   bemerken -- Lucas musste dreimal darauf zeigen. Ein Maß, das man einmal
   nachmisst, kostet zehn Sekunden; ein geschätztes Maß kostet Wochen, in
   denen es jemandem auffällt und man es wegsieht.

   Die Prüfung läuft rein auf den Dateien, ohne Browser: Wo immer eine der
   drei Blumenformen im Quelltext steht (direkt als Pfad oder über <use>),
   muss die kanonische viewBox danebenstehen, und Breite/Höhe müssen zum
   echten Seitenverhältnis passen (bl-a ist BREITER als hoch, nicht höher
   als breit).

   Anfangs kannte diese Prüfung nur bl-a. Bei bl-b und bl-c hätte dieselbe
   geratene Zahl also unbemerkt danebenliegen können -- genau der Fehler,
   um den es hier geht. Jetzt sind alle drei drin.
   Die von assets/blumen.js zur Laufzeit erzeugten Blumen kann eine
   Textprüfung nicht sehen (dort steht eine Variable statt einer Zahl); die
   werden im Browser nachgemessen, siehe tests/pruefe-blumen.mjs. */
import { readdir, readFile } from 'node:fs/promises';

const ergebnisse = [];
function pruefe(name, bedingung, zusatz = '') {
  ergebnisse.push({ name, ok: !!bedingung, zusatz });
  console.log(`${bedingung ? '  ok  ' : ' FEHL '} ${name}${zusatz ? '  — ' + zusatz : ''}`);
}
function bericht() {
  const schlecht = ergebnisse.filter(e => !e.ok);
  console.log(`\n${ergebnisse.length - schlecht.length} von ${ergebnisse.length} bestanden`);
  if (schlecht.length) process.exitCode = 1;
}

/* Nachgemessen mit getBBox() im Browser, nicht geschätzt.
   anfang = die ersten Zeichen des jeweiligen Pfades, daran wird die Form im
   Quelltext erkannt, wenn sie direkt eingesetzt ist. */
const FORMEN = [
  { id: 'bl-a', box: '0 0 303.13 275.3',  b: 303.13, h: 275.3,  anfang: 'M133.16,237.99' },
  { id: 'bl-b', box: '0 0 349.23 339.2',  b: 349.23, h: 339.2,  anfang: 'M256.5,328.87' },
  { id: 'bl-c', box: '0 0 474.6 413.62',  b: 474.6,  h: 413.62, anfang: 'M304.65,412.67' },
];
const VIEWBOX = FORMEN[0].box;
const VERHAELTNIS = FORMEN[0].b / FORMEN[0].h;   // 1.101 -- breiter als hoch
const ANFANG = FORMEN[0].anfang;                 // Beginn des Blumen-Pfades

/* Alle ausgelieferten Seiten und Skripte plus die Designfibel. */
const wurzeln = [
  new URL('../HOCHLADEN/', import.meta.url),
  new URL('../HOCHLADEN/assets/', import.meta.url),
  new URL('../docs/', import.meta.url),
];
const dateien = [];
for (const w of wurzeln) {
  for (const n of await readdir(w)) {
    if (/\.(html|js|css)$/.test(n)) dateien.push({ name: n, url: new URL(n, w) });
  }
}

const falscheBox = [];
const falschesVerhaeltnis = [];
let gefunden = 0;

for (const { name, url } of dateien) {
  const t = await readFile(url, 'utf8');
  const zeigtForm = (text) => FORMEN.find(f => text.includes(f.anfang) || text.includes('#' + f.id));
  if (!zeigtForm(t)) continue;

  /* Jedes <svg …>, das eine der drei Formen direkt enthält oder über <use>
     holt, muss DEREN kanonische viewBox tragen. */
  for (const m of t.matchAll(/<svg\b([^>]*)>([\s\S]{0,3000}?)<\/svg>/g)) {
    const attr = m[1], inhalt = m[2];
    const form = zeigtForm(inhalt);
    if (!form) continue;
    /* Definitionsbloecke (<defs>) werden nie dargestellt -- sie halten nur
       die Formen bereit, damit <use> sie holen kann. Eine viewBox waere
       dort sinnlos. Ausnehmen, sonst meldet die Pruefung einen Fehler, wo
       keiner ist. */
    if (inhalt.includes('<defs')) continue;
    gefunden++;

    const vb = (attr.match(/viewBox="([^"]+)"/) || [])[1];
    if (vb !== form.box) falscheBox.push(`${name} (${form.id}): viewBox="${vb || '(fehlt)'}"`);

    const b = Number((attr.match(/\bwidth="(\d+(?:\.\d+)?)"/) || [])[1]);
    const h = Number((attr.match(/\bheight="(\d+(?:\.\d+)?)"/) || [])[1]);
    if (b && h) {
      const soll = form.b / form.h;
      const ist = b / h;
      /* 3% Toleranz: gerundete Pixelwerte dürfen leicht abweichen. */
      if (Math.abs(ist - soll) / soll > 0.03)
        falschesVerhaeltnis.push(`${name} (${form.id}): ${b}×${h} (${ist.toFixed(3)} statt ${soll.toFixed(3)})`);
    }
  }
}

pruefe('es gibt überhaupt Blumen zu prüfen (sonst wäre die Prüfung hohl)',
  gefunden >= 5, gefunden + ' gefunden');
pruefe('jede Blume benutzt die nachgemessene viewBox IHRER Form (bl-a, bl-b oder bl-c)',
  falscheBox.length === 0, falscheBox.join(' | '));
pruefe('Breite und Höhe passen zum echten Seitenverhältnis (breiter als hoch)',
  falschesVerhaeltnis.length === 0, falschesVerhaeltnis.join(' | '));

/* GEGENBEWEIS: genau die falsche Angabe von damals würde erkannt. */
{
  const kaputt = '<svg viewBox="0 0 290 300" width="60" height="62"><path d="M133.16,237.99z"/></svg>';
  const vb = (kaputt.match(/viewBox="([^"]+)"/) || [])[1];
  const b = Number((kaputt.match(/\bwidth="(\d+)"/) || [])[1]);
  const h = Number((kaputt.match(/\bheight="(\d+)"/) || [])[1]);
  pruefe('GEGENBEWEIS: die alte falsche viewBox "0 0 290 300" würde auffallen',
    vb !== VIEWBOX);
  pruefe('GEGENBEWEIS: …und das umgedrehte Seitenverhältnis 60×62 ebenfalls',
    Math.abs(b / h - VERHAELTNIS) / VERHAELTNIS > 0.03,
    `${b}×${h} ergibt ${(b / h).toFixed(3)}, erwartet ${VERHAELTNIS.toFixed(3)}`);
}

bericht();
