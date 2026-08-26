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

   Die Prüfung läuft rein auf den Dateien, ohne Browser: Wo immer der
   Blumen-Pfad direkt im Quelltext steht, muss die kanonische viewBox
   danebenstehen, und Breite/Höhe müssen zum echten Seitenverhältnis passen
   (die Blume ist BREITER als hoch, nicht höher als breit). */
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

/* Nachgemessen mit getBBox() im Browser, nicht geschätzt. */
const VIEWBOX = '0 0 303.13 275.3';
const VERHAELTNIS = 303.13 / 275.3;         // 1.101 -- breiter als hoch
const ANFANG = 'M133.16,237.99';            // Beginn des Blumen-Pfades

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
  if (!t.includes(ANFANG) && !t.includes('#bl-a')) continue;

  /* Jedes <svg …>, das entweder den Pfad direkt enthält oder das Symbol
     benutzt, muss die kanonische viewBox tragen. */
  for (const m of t.matchAll(/<svg\b([^>]*)>([\s\S]{0,3000}?)<\/svg>/g)) {
    const attr = m[1], inhalt = m[2];
    if (!inhalt.includes(ANFANG) && !inhalt.includes('#bl-a')) continue;
    /* Definitionsbloecke (<defs>) werden nie dargestellt -- sie halten nur
       die Formen bereit, damit <use> sie holen kann. Eine viewBox waere
       dort sinnlos. Ausnehmen, sonst meldet die Pruefung einen Fehler, wo
       keiner ist. */
    if (inhalt.includes('<defs')) continue;
    gefunden++;

    const vb = (attr.match(/viewBox="([^"]+)"/) || [])[1];
    if (vb !== VIEWBOX) falscheBox.push(`${name}: viewBox="${vb || '(fehlt)'}"`);

    const b = Number((attr.match(/\bwidth="(\d+(?:\.\d+)?)"/) || [])[1]);
    const h = Number((attr.match(/\bheight="(\d+(?:\.\d+)?)"/) || [])[1]);
    if (b && h) {
      const ist = b / h;
      /* 3% Toleranz: gerundete Pixelwerte dürfen leicht abweichen. */
      if (Math.abs(ist - VERHAELTNIS) / VERHAELTNIS > 0.03)
        falschesVerhaeltnis.push(`${name}: ${b}×${h} (${ist.toFixed(3)} statt ${VERHAELTNIS.toFixed(3)})`);
    }
  }
}

pruefe('es gibt überhaupt Blumen zu prüfen (sonst wäre die Prüfung hohl)',
  gefunden >= 5, gefunden + ' gefunden');
pruefe(`jede Blume benutzt die nachgemessene viewBox "${VIEWBOX}"`,
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
