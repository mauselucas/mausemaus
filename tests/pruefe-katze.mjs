/* Die Katze, die nach dem Absenden des Anfrageformulars erscheint.

   ACHTUNG, wie in tests/pruefe-formular.mjs: Hier geht NIE eine echte
   Anfrage raus. window.fetch wird vorher ersetzt. Liefe der Test scharf,
   bekaeme Lucas bei jedem Durchlauf eine Mail und das Freikontingent bei
   Formspree (50 im Monat) waere schnell weg.

   Worauf es ankommt und was hier deshalb wirklich gemessen wird:
     1. Vor dem Absenden darf KEIN Byte davon geholt werden. Die Katze ist
        139 kB; wer nur den Brief liest, soll sie nie bezahlen.
     2. Sie darf nichts verschieben, wenn sie auftaucht -- also feste Masse.
     3. Wer "Bewegung reduzieren" eingeschaltet hat, bekommt ein Standbild,
        und zwar OHNE dass die bewegte Fassung nebenher geladen wird.
     4. Ein Screenreader soll den Satz hoeren, nicht das Bild.

   Punkt 1 und 3 sind an den wirklich geholten Dateien gemessen
   (performance.getEntriesByType('resource')), nicht am Markup: ein <img>,
   das im Dokument steht, beweist nicht, dass die Datei geholt wurde -- und
   umgekehrt. */
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { starteChrome, oeffne, pruefe, bericht } from './chrome.mjs';
import { starteServer } from './server.mjs';
import { messeInFirefox, firefoxDa } from './firefox.mjs';

const HOCH = new URL('../HOCHLADEN/', import.meta.url);
const wurzel = HOCH.pathname;
const server = await starteServer({ wurzel, port: 8921 });
const chrome = await starteChrome({ port: 9351 });

/* ---------- 1. Die Dateien gibt es, und die Seite meint dieselben ---------- */

const seite = await readFile(new URL('./index.html', HOCH), 'utf8');
const adressen = [...seite.matchAll(/\/assets\/(katze-[A-Za-z0-9-]+\.webp)/g)].map(m => m[1]);
pruefe('index.html nennt zwei Katzen-Dateien (bewegt und Standbild)',
  new Set(adressen).size === 2, [...new Set(adressen)].join(', ') || 'keine');
for (const name of new Set(adressen)) {
  pruefe(`…und ${name} liegt wirklich da`,
    existsSync(new URL('./assets/' + name, HOCH).pathname));
}
/* Der Fingerabdruck im Namen ersetzt den ?v=-Stempel. Beide Dateien muessen
   denselben tragen, sonst gehoeren sie zu verschiedenen GIFs. */
const fp = [...new Set(adressen)].map(n => (n.match(/katze-([0-9a-f]{8})/) || [])[1]);
pruefe('beide Dateien stammen aus demselben GIF', fp.length === 2 && fp[0] === fp[1],
  fp.join(' / '));

/* ---------- 2. Vor dem Absenden: nichts geholt ---------- */

const s = await oeffne('http://127.0.0.1:8921/', { port: 9351 });
await s.warte(2500);

const vorher = JSON.parse(await s.werte(`JSON.stringify({
  geholt: performance.getEntriesByType('resource').filter(e => e.name.includes('katze-')).map(e => e.name),
  imDokument: document.querySelectorAll('#anfrage-katze img').length,
  platzhalterDa: !!document.getElementById('anfrage-katze'),
  ariaVersteckt: (document.getElementById('anfrage-katze')||{}).getAttribute
    ? document.getElementById('anfrage-katze').getAttribute('aria-hidden') : null,
  hoeheVorher: Math.round(document.querySelector('.br-formular-rueckmeldung').getBoundingClientRect().height)
})`));
pruefe('der Platz fuer die Katze ist im Dokument vorbereitet', vorher.platzhalterDa);
pruefe('…und fuer Screenreader ausdruecklich unsichtbar',
  vorher.ariaVersteckt === 'true', 'aria-hidden=' + vorher.ariaVersteckt);
pruefe('vor dem Absenden steht kein Bild im Dokument', vorher.imDokument === 0, vorher.imDokument);
pruefe('vor dem Absenden ist auch KEIN Byte davon geholt',
  vorher.geholt.length === 0, vorher.geholt.join(', ') || '0 Dateien');
pruefe('…und der leere Platz nimmt keine Hoehe weg',
  vorher.hoeheVorher === 0, vorher.hoeheVorher + ' px');

/* ---------- 3. Nach dem Erfolg: bewegt, mit festen Massen ---------- */

const nach = JSON.parse(await s.werte(`(async () => {
  window.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  const f = document.getElementById('anfragen');
  f.querySelector('[name=name]').value = 'Test';
  f.querySelector('[name=email]').value = 'test@example.com';
  f.querySelector('[name=nachricht]').value = 'Hallo';
  f.requestSubmit();
  await new Promise(r => setTimeout(r, 700));
  const bild = document.querySelector('#anfrage-katze img');
  if (bild && !bild.complete) await new Promise(r => bild.addEventListener('load', r, {once:true}));
  const a = document.getElementById('anfrage-antwort');
  return JSON.stringify({
    da: !!bild,
    quelle: bild ? bild.currentSrc.split('/').pop() : '-',
    alt: bild ? bild.getAttribute('alt') : null,
    breiteAttr: bild ? bild.getAttribute('width') : '-',
    hoeheAttr: bild ? bild.getAttribute('height') : '-',
    wirklichBreit: bild ? Math.round(bild.getBoundingClientRect().width) : 0,
    wirklichHoch: bild ? Math.round(bild.getBoundingClientRect().height) : 0,
    geladen: bild ? bild.naturalWidth : 0,
    antwort: a.textContent,
    geholt: performance.getEntriesByType('resource').filter(e => e.name.includes('katze-')).map(e => e.name.split('/').pop())
  });
})()`));
pruefe('nach dem Erfolg steht die Katze da', nach.da);
pruefe('…und das Bild ist wirklich geladen, nicht nur verlinkt',
  nach.geladen > 0, nach.geladen + ' px Rohbreite');
pruefe('…es ist die BEWEGTE Fassung', /^katze-[0-9a-f]{8}\.webp$/.test(nach.quelle), nach.quelle);
pruefe('…das Standbild wurde dabei NICHT mitgeholt',
  !nach.geholt.some(n => n.includes('standbild')), nach.geholt.join(', '));
pruefe('…es traegt feste Masse gegen den Layoutsprung',
  nach.breiteAttr === '160' && nach.hoeheAttr === '116',
  nach.breiteAttr + 'x' + nach.hoeheAttr);
pruefe('…und wird auch wirklich so gross gezeichnet',
  nach.wirklichBreit === 160 && nach.wirklichHoch === 116,
  nach.wirklichBreit + 'x' + nach.wirklichHoch);
pruefe('…es ist als Zierde ausgewiesen (leeres alt)', nach.alt === '', JSON.stringify(nach.alt));
pruefe('die Erfolgsmeldung steht weiterhin daneben',
  nach.antwort.includes('Angekommen'), nach.antwort);

/* GEGENBEWEIS zur Messung oben: Waere "vorher nichts geholt" blind, muesste
   sie auch JETZT noch gruen sein. Ist sie nicht -- jetzt ist etwas da. */
pruefe('GEGENBEWEIS: nach dem Absenden ist sehr wohl etwas geholt worden',
  nach.geholt.length > 0, nach.geholt.join(', '));

/* Ein Fehlschlag darf keine Katze zeigen -- sonst feiert die Seite etwas,
   das nicht geklappt hat. */
const beiFehler = JSON.parse(await s.werte(`(async () => {
  window.fetch = () => Promise.resolve({ ok: false, json: () => Promise.resolve({ errors: [{ message: 'Feld fehlt' }] }) });
  const f = document.getElementById('anfragen');
  f.querySelector('[name=name]').value = 'Test';
  f.querySelector('[name=email]').value = 'test@example.com';
  f.querySelector('[name=nachricht]').value = 'Hallo';
  f.requestSubmit();
  await new Promise(r => setTimeout(r, 500));
  return JSON.stringify({ bilder: document.querySelectorAll('#anfrage-katze img').length,
    text: document.getElementById('anfrage-antwort').textContent });
})()`));
pruefe('nach einem Fehlschlag ist die Katze wieder weg',
  beiFehler.bilder === 0, beiFehler.bilder + ' Bilder');
pruefe('…und der Fehler steht da', beiFehler.text.includes('Feld fehlt'), beiFehler.text);

const jsF = s.fehlerAufSeite();
pruefe('keine JavaScript-Fehler', jsF.length === 0, jsF.join(' | '));
await s.zu();

/* ---------- 4. Mit "Bewegung reduzieren": das Standbild ---------- */

const r = await oeffne('http://127.0.0.1:8921/', { port: 9351 });
await r.medien({ 'prefers-reduced-motion': 'reduce' });
await r.warte(2500);
const ruhig = JSON.parse(await r.werte(`(async () => {
  window.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  const f = document.getElementById('anfragen');
  f.querySelector('[name=name]').value = 'Test';
  f.querySelector('[name=email]').value = 'test@example.com';
  f.querySelector('[name=nachricht]').value = 'Hallo';
  f.requestSubmit();
  await new Promise(r2 => setTimeout(r2, 700));
  const bild = document.querySelector('#anfrage-katze img');
  if (bild && !bild.complete) await new Promise(r2 => bild.addEventListener('load', r2, {once:true}));
  return JSON.stringify({
    quelle: bild ? bild.currentSrc.split('/').pop() : '-',
    geholt: performance.getEntriesByType('resource').filter(e => e.name.includes('katze-')).map(e => e.name.split('/').pop())
  });
})()`));
pruefe('bei "Bewegung reduzieren" kommt das Standbild',
  ruhig.quelle.includes('standbild'), ruhig.quelle);
pruefe('…und die bewegte Fassung wird dabei GAR NICHT geholt',
  !ruhig.geholt.some(n => /^katze-[0-9a-f]{8}\.webp$/.test(n)),
  ruhig.geholt.join(', '));
await r.zu();

chrome.beenden(); server.beenden();

/* ---------- 5. Firefox ----------
   Nicht aus Gruendlichkeit, sondern aus Erfahrung: In Firefox laeuft das
   Scroll-Polyfill mit, und das hat schon einmal saemtliche @font-face-Regeln
   zerstoert (Fallstrick 25). Was es sonst noch anfasst, weiss niemand --
   also wird jede neue Sache, die etwas ins Dokument haengt, dort einmal
   nachgesehen. Ist Firefox nicht installiert, wird das ausdruecklich
   gemeldet statt stillschweigend uebersprungen. */

if (!firefoxDa()) {
  pruefe('Firefox ist installiert (sonst bleibt der Polyfill-Fall ungeprueft)', false,
    'nicht gefunden — dieser Teil wurde NICHT geprueft');
} else {
  /* window.fetch wird gleich gefaelscht -- vorher das echte sichern, sonst
     kann sich die Messung selbst nicht mehr melden. */
  const skript = `
  (async () => {
    const echtesFetch = window.fetch.bind(window);
    await new Promise(r => setTimeout(r, 4000));
    window.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    const f = document.getElementById('anfragen');
    f.querySelector('[name=name]').value = 'T';
    f.querySelector('[name=email]').value = 't@e.de';
    f.querySelector('[name=nachricht]').value = 'H';
    f.requestSubmit();
    await new Promise(r => setTimeout(r, 3000));
    const b = document.querySelector('#anfrage-katze img');
    echtesFetch('/ergebnis', { method: 'POST', body: JSON.stringify({
      polyfill: document.documentElement.className.indexOf('mm-bewegung') >= 0,
      quelle: b ? b.currentSrc.split('/').pop() : '-',
      geladen: b ? b.naturalWidth : 0,
      breit: b ? Math.round(b.getBoundingClientRect().width) : 0,
      hoch: b ? Math.round(b.getBoundingClientRect().height) : 0,
      antwort: (document.getElementById('anfrage-antwort') || {}).textContent || ''
    })});
  })();`;
  /* messeInFirefox liefert bereits ein Objekt -- nicht noch einmal parsen. */
  const ff = await messeInFirefox(skript, { port: 8922 });
  pruefe('Firefox: das Polyfill laeuft dort ueberhaupt', ff.polyfill === true, String(ff.polyfill));
  pruefe('Firefox: die Katze ist geladen, trotz Polyfill',
    ff.geladen > 0, ff.quelle + ', ' + ff.geladen + ' px Rohbreite');
  pruefe('Firefox: …in denselben Massen wie in Chrome',
    ff.breit === 160 && ff.hoch === 116, ff.breit + 'x' + ff.hoch);
  pruefe('Firefox: die Erfolgsmeldung steht daneben',
    ff.antwort.includes('Angekommen'), ff.antwort);
}

bericht();
