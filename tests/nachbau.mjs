/* Erzeugt bewegung-nachbau.css aus bewegung.css.

   WARUM ES DIESE DATEI ZWEIMAL GIBT
   Das Polyfill (scroll-timeline.js) liest den ROHTEXT der Stylesheets und
   parst ihn mit einem eigenen, sehr schlichten Parser. Gemessen am
   27.08.2026 in Firefox 154 steigt dieser Parser weder in @supports noch in
   @media hinab -- Regeln in einem At-Block erreichen ihn nie. Die Messung
   steht in docs/scroll-animationen-fuer-ox-alpha.md.

   Deshalb zwei Fassungen derselben Regeln:
     bewegung.css          @supports + @media, fuer Chrome und Safari.
                           Reines CSS, kein JavaScript, auf dem Compositor.
     bewegung-nachbau.css  flach und ohne At-Block, jede Regel mit
                           "html.mm-bewegung " davor. Wird NUR nachgeladen,
                           wo die Engine Scroll-Animationen nicht kennt.

   Doppelte Wahrheit ist eine Gefahr -- genau die Sorte, die in diesem
   Projekt schon zweimal auseinandergelaufen ist. Deshalb wird die zweite
   Fassung nicht von Hand gepflegt, sondern hier erzeugt, und
   pruefe-nachbau.mjs schlaegt Alarm, sobald die abgelegte Datei nicht mehr
   dem entspricht, was aus bewegung.css folgt. */
import { readFileSync } from 'node:fs';

export function baueNachbau(quelltext) {
  /* Den Rumpf des @media-Blocks innerhalb von @supports herausschneiden. */
  const a = quelltext.indexOf('@supports (animation-timeline: view())');
  if (a < 0) throw new Error('kein @supports-Block in bewegung.css gefunden');
  const m = quelltext.indexOf('@media (prefers-reduced-motion: no-preference)', a);
  if (m < 0) throw new Error('kein @media-Block in bewegung.css gefunden');

  let i = quelltext.indexOf('{', m), tiefe = 0, anfang = i + 1, ende = -1;
  for (; i < quelltext.length; i++) {
    if (quelltext[i] === '{') tiefe++;
    else if (quelltext[i] === '}') { tiefe--; if (tiefe === 0) { ende = i; break; } }
  }
  if (ende < 0) throw new Error('der @media-Block ist nicht geschlossen');
  const rumpf = quelltext.slice(anfang, ende);

  /* Jede Regel: Selektorliste einsammeln, jeden einzelnen Selektor mit
     "html.mm-bewegung " praefixen, Rumpf unveraendert uebernehmen.
     Kommentare fallen weg -- die Begruendungen stehen in bewegung.css, und
     eine erzeugte Datei soll nicht so aussehen, als pflege man sie. */
  const ohneKommentare = rumpf.replace(/\/\*[\s\S]*?\*\//g, '');
  const regeln = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let t;
  while ((t = re.exec(ohneKommentare))) {
    const selektoren = t[1].split(',').map(s => s.trim()).filter(Boolean);
    if (!selektoren.length) continue;
    const eigenschaften = t[2].split(';').map(s => s.trim()).filter(Boolean);
    regeln.push(
      selektoren.map(s => 'html.mm-bewegung ' + s).join(',\n') +
      ' {\n' + eigenschaften.map(e => '  ' + e + ';').join('\n') + '\n}');
  }
  if (!regeln.length) throw new Error('keine Regeln im @media-Block gefunden');

  return `/* ERZEUGT -- NICHT VON HAND AENDERN.
   Quelle: assets/bewegung.css · Erzeuger: tests/nachbau.mjs
   Aenderungen gehoeren in bewegung.css; danach:  node tests/nachbau.mjs --schreiben

   Diese Fassung ist fuer das Polyfill (scroll-timeline.js), dessen Parser
   nicht in @supports oder @media hineinsieht. Sie wird ausschliesslich in
   Browsern nachgeladen, die Scroll-Animationen selbst nicht koennen, und
   greift nur, wenn <html> die Klasse mm-bewegung traegt -- gesetzt wird die
   erst, wenn das Polyfill wirklich geladen ist und "Bewegung reduzieren"
   aus ist. Ohne JavaScript traegt sie niemand, dann ist die Seite statisch
   und VOLLSTAENDIG sichtbar. Die @keyframes stehen weiterhin nur in
   bewegung.css; die gelten dort ohnehin ohne At-Block. */

${regeln.join('\n\n')}
`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const wurzel = new URL('../HOCHLADEN/assets/', import.meta.url);
  const quelle = readFileSync(new URL('bewegung.css', wurzel), 'utf8');
  const erzeugt = baueNachbau(quelle);
  if (process.argv.includes('--schreiben')) {
    const { writeFileSync } = await import('node:fs');
    writeFileSync(new URL('bewegung-nachbau.css', wurzel), erzeugt);
    console.log('bewegung-nachbau.css geschrieben');
  } else process.stdout.write(erzeugt);
}
