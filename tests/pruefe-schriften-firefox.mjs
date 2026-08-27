/* Die Webschriften in FIREFOX -- dem einzigen Browser, in dem sie ausfielen.

   Der Hergang: Nach dem Umzug auf GitHub Pages meldete Lucas, die Schriften
   luden nicht. In Chrome und Safari war alles richtig, die Dateien lagen
   live mit derselben Pruefsumme wie lokal, HTTP 200, font/woff2, und
   document.fonts meldete "loaded". Gesucht war also nicht ein Fehler in der
   Datei, sondern einer in der Umgebung.

   Es war das Scroll-Animations-Polyfill (flackr/scroll-timeline). Es liest
   beim Start jedes Stylesheet ein, schreibt es um und haengt es als
   blob:-Adresse wieder ein -- und die @font-face-Regeln ueberleben das
   nicht. Chrome und Safari sind nie betroffen: dort laedt das Polyfill
   gar nicht erst. Ein Fehler, den nur Firefox zeigt, und den keine
   Chrome-Pruefung je gefunden haette. Genau dafuer gibt es tests/firefox.mjs.

   Gemessen wird ueber ein Canvas, nicht ueber Elementbreiten: eine Breite
   haengt am Layout und war in ersten Versuchen schlicht die Breite des
   Elternelements -- eine Zahl, die mit der Schrift nichts zu tun hat.
   Gefaerbte Pixel eines gezeichneten Wortes haengen dagegen nur an der
   Schrift selbst. */
import { messeInFirefox, firefoxDa } from './firefox.mjs';
import { pruefe, bericht } from './chrome.mjs';

if (!firefoxDa()) {
  console.log('Firefox ist nicht installiert — diese Prüfung wird übersprungen.');
  process.exit(0);
}

const MESSER = `
  const abdruck = (fam) => {
    const c = document.createElement('canvas'); c.width = 900; c.height = 160;
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 900, 160);
    x.fillStyle = '#000'; x.font = '100px ' + fam; x.textBaseline = 'top';
    x.fillText('Hallo Lucas', 5, 10);
    const d = x.getImageData(0, 0, 900, 160).data; let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] < 128) n++; return n; };`;

const skript = `
(async () => {
  ${MESSER}
  await document.fonts.ready; await new Promise(r => setTimeout(r, 2500));
  const nutz = JSON.stringify({
    TropiWeb: abdruck('"TropiWeb"'), Manrope: abdruck('"Manrope"'),
    SpaceMono: abdruck('"Space Mono"'), serif: abdruck('serif'),
    polyfill: document.documentElement.className.indexOf('mm-bewegung') >= 0
  });
  fetch('/ergebnis', { method: 'POST', body: nutz });
})();`;

/* messeInFirefox liefert bereits ein Objekt -- nicht noch einmal parsen. */
const d = await messeInFirefox(skript, { port: 8971 });

/* Ohne diese Zusicherung waere alles Weitere wertlos: laeuft das Polyfill
   nicht, kann es auch nichts kaputtmachen und die Pruefung waere hohl. */
pruefe('das Polyfill läuft in Firefox überhaupt', d.polyfill === true, String(d.polyfill));

for (const [name, wert] of [['TropiWeb', d.TropiWeb], ['Manrope', d.Manrope], ['Space Mono', d.SpaceMono]]) {
  pruefe(`${name} zeichnet in Firefox — nicht die Ersatzschrift`,
    wert !== d.serif, `${wert} Pixel (Ersatzschrift: ${d.serif})`);
}
pruefe('die drei Schriften unterscheiden sich auch voneinander',
  new Set([d.TropiWeb, d.Manrope, d.SpaceMono]).size === 3,
  `${d.TropiWeb} / ${d.Manrope} / ${d.SpaceMono}`);

/* Gegenprobe: ohne den Rettungsanker MUSS es wieder brechen. Bleibt es
   auch dann gruen, misst diese Datei etwas anderes als sie behauptet. */
const ohneRettung = (html) => html.replace(/document\.write\('<script src="\/assets\/schriften-retten\.js[^']*'\);/, '');
const o = await messeInFirefox(skript, { port: 8972, verbiegen: ohneRettung });
pruefe('ohne schriften-retten.js fallen sie nachweislich aus',
  o.TropiWeb === o.serif && o.Manrope === o.serif,
  `TropiWeb ${o.TropiWeb}, Manrope ${o.Manrope}, Ersatzschrift ${o.serif}`);

bericht();
