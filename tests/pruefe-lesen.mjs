/* Die Leseseite für PDFs (/lesen.html, assets/lesen.js) und das
   Arbeitszeugnis in /dokumente/.

   1. Die PDF verrät nichts über ihre Herkunft: keine Metadaten (Info, XMP,
      ID), kein Datum, kein Gerät, und das Bild darin hat keine Exif-Daten.
   2. Sie taucht nicht bei Google auf (robots.txt, noindex).
   3. Der Link in der Projektkarte öffnet die Leseseite in einem neuen Tab.
   4. Die Leseseite zeichnet das Blatt, zoomt, zählt Seiten -- und bietet
      keinen Weg zum Herunterladen oder Drucken an.
   5. Kaputte Adressen enden freundlich statt mit einem leeren Fenster. */
import { readFileSync, readdirSync } from 'node:fs';
import { starteChrome, oeffne, pruefe, bericht } from './chrome.mjs';
import { starteServer } from './server.mjs';

const wurzel = new URL('../HOCHLADEN/', import.meta.url).pathname;

async function wirdWahr(s, ausdruck, frist = 8000, takt = 120) {
  const ende = Date.now() + frist;
  while (Date.now() < ende) {
    try { if (await s.werte(ausdruck)) return true; } catch {}
    await new Promise(r => setTimeout(r, takt));
  }
  return false;
}

/* ================= 1. Die PDF selbst ================= */
const pdfs = readdirSync(wurzel + 'dokumente').filter(n => n.endsWith('.pdf'));
pruefe('es liegt mindestens eine PDF in /dokumente/', pdfs.length > 0, pdfs.join(', '));
for (const name of pdfs) {
  const roh = readFileSync(wurzel + 'dokumente/' + name);
  const text = roh.toString('latin1');
  const verboten = ['/Info', '/Metadata', '/ID', '/Producer', '/Creator', '/Author', '/CreationDate',
    '/ModDate', '/PieceInfo', 'xpacket', 'Exif', 'JFIF', 'ICC_PROFILE', 'Photoshop', 'macOS', 'Quartz',
    'Apple', 'Screenshot', 'readdle', 'pdf-lib', '/EmbeddedFile', '/JavaScript', '/OpenAction', '/URI'];
  const gefunden = verboten.filter(w => text.toLowerCase().includes(w.toLowerCase()));
  pruefe(`${name}: keine Metadaten, kein Gerät, kein Programm`, gefunden.length === 0, gefunden.join(', '));
  pruefe(`${name}: keine Jahreszahl irgendwo in der Datei`, !/(19|20)\d\d[:\-]?(0[1-9]|1[0-2])/.test(text.replace(/stream[\s\S]*?endstream/g, '')));
  pruefe(`${name}: nur eine Fassung (keine alte Version darunter versteckt)`, (text.match(/%%EOF/g) || []).length === 1);
  /* Jedes JPEG darin: zwischen Anfang und Bilddaten keine APP-/Kommentar-
     Abschnitte (dort stünden Exif, Farbprofil, Kamera, Datum). */
  let i = 0, jpegs = 0, appTeile = 0;
  while ((i = roh.indexOf(Buffer.from([0xFF, 0xD8, 0xFF]), i)) >= 0) {
    jpegs++; let j = i + 2;
    while (j < roh.length - 4 && roh[j] === 0xFF && roh[j + 1] !== 0xDA) {
      const m = roh[j + 1];
      if ((m >= 0xE0 && m <= 0xEF) || m === 0xFE) appTeile++;
      j += 2 + roh.readUInt16BE(j + 2);
    }
    i = j;
  }
  pruefe(`${name}: Bilder darin ohne Exif/Farbprofil/Kommentar`, appTeile === 0, `${jpegs} Bild(er), ${appTeile} Zusatzabschnitt(e)`);
}

/* ================= 2. Nicht bei Google ================= */
const robots = readFileSync(wurzel + 'robots.txt', 'utf8');
pruefe('robots.txt sperrt /dokumente/ für Suchmaschinen', /^Disallow:\s*\/dokumente\/\s*$/m.test(robots));
const lesenHtml = readFileSync(wurzel + 'lesen.html', 'utf8');
pruefe('die Leseseite steht auf noindex', /<meta name="robots" content="noindex/.test(lesenHtml));
pruefe('…und gibt ihre Adresse nicht weiter (no-referrer)', /<meta name="referrer" content="no-referrer">/.test(lesenHtml));

const server = await starteServer({ wurzel, port: 8943 });
const chrome = await starteChrome({ port: 9383 });
const ADR = 'http://127.0.0.1:8943/';

/* ================= 3. Der Link in der Karte ================= */
{
  const s = await oeffne(ADR + '?lang=de', { port: 9383, breite: 1440, hoehe: 900 });
  await s.bisWahr(`!document.getElementById('mm-laden') && !!window.mmProjekte`, 20000);
  /* Welches Projekt den Link trägt, steht im Inhalt -- nicht hier fest. */
  const nr = await s.werte(`window.mmProjekte.findIndex(p => JSON.stringify(p).includes('lesen.html?d='))`);
  pruefe('ein Projekt verlinkt auf die Leseseite', nr >= 0, String(nr));
  if (nr >= 0) {
    await s.werte(`(() => { const p = window.mmProjekte[${nr}];
      const k = window.mmKapitel(p.bloecke, !!p.coverHtml);
      window.__kap = k.findIndex(x => JSON.stringify(x).includes('lesen.html?d='));
      window.mmBuehneOeffnen(${nr}, window.__kap); })()`);
    const da = await wirdWahr(s, `!!document.querySelector('dialog.bu[open] .bu-kapitel:not(.bu-geht) a[href*="lesen.html?d="]')`);
    pruefe('…der Link ist in der geöffneten Karte zu sehen', da);
    const a = JSON.parse(await s.werte(`JSON.stringify((() => { const a = document.querySelector('dialog.bu[open] a[href*="lesen.html?d="]');
      if (!a) return {}; const r = a.getBoundingClientRect(); const st = getComputedStyle(a);
      return { href: a.getAttribute('href'), ziel: a.target, rel: a.rel, w: r.width, h: r.height, farbe: st.color }; })())`));
    pruefe('…öffnet einen neuen Tab', a.ziel === '_blank' && /noopener/.test(a.rel || ''), `${a.ziel} ${a.rel}`);
    pruefe('…ist sichtbar und anklickbar', a.w > 40 && a.h > 10, `${Math.round(a.w || 0)}×${Math.round(a.h || 0)}`);
    pruefe('…ist nicht rot (die rote Farbe kam nur vom Screenshot)', a.farbe && !/^rgb\((2[0-9]{2}|1[5-9][0-9]), ?([0-9]{1,2}), ?([0-9]{1,2})\)/.test(a.farbe), a.farbe);
    const d = (a.href || '').match(/[?&]d=([a-z0-9-]+)/);
    pruefe('…und zeigt auf eine PDF, die es wirklich gibt', d && pdfs.includes(d[1] + '.pdf'), a.href);
  }
  pruefe('Startseite: keine JS-Fehler', s.fehlerAufSeite().length === 0, s.fehlerAufSeite().join(' | '));
  await s.zu();
}

/* ================= 4. Die Leseseite ================= */
const d0 = pdfs[0].replace(/\.pdf$/, '');
const BLATT = `document.querySelector('.le-blatt.da canvas')`;
const tinte = `(() => { const c = ${BLATT}; if (!c || !c.width) return 0;
  const x = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0;
  for (let i = 0; i < x.length; i += 4 * 7) if (x[i] + x[i+1] + x[i+2] < 360) n++; return n; })()`;
const mass = `JSON.stringify((() => { const b = document.querySelector('.le-blatt'), r = b && b.getBoundingClientRect();
  return { w: r ? r.width : 0, h: r ? r.height : 0, l: r ? r.left : 0, rechts: r ? r.right : 0, cw: b ? b.querySelector('canvas').width : 0,
    zoom: document.getElementById('le-zoom').textContent, seiten: document.getElementById('le-seiten').textContent,
    seiteBreit: document.documentElement.scrollWidth, fenster: innerWidth }; })())`;
{
  const s = await oeffne(`${ADR}lesen.html?d=${d0}&t=Arbeitszeugnis%20%C2%B7%2033minutes&lang=de`, { port: 9383, breite: 1440, hoehe: 900 });
  const gezeichnet = await wirdWahr(s, `${tinte} > 200`, 15000);
  pruefe('Leseseite: das Blatt wird gezeichnet (Schrift zu sehen)', gezeichnet, String(await s.werte(tinte)));
  const m = JSON.parse(await s.werte(mass));
  pruefe('…gut lesbar groß und nicht übergroß', m.w >= 600 && m.w <= 860, `${Math.round(m.w)} px`);
  pruefe('…mittig auf dem Tisch', Math.abs((m.l + m.rechts) / 2 - m.fenster / 2) < 20, `${Math.round(m.l)}–${Math.round(m.rechts)}`);
  pruefe('…scharf (mindestens so viele Bildpunkte wie Fläche)', m.cw >= Math.round(m.w));
  pruefe('…Titel aus dem Link', await s.werte(`document.getElementById('le-titel').textContent`) === 'Arbeitszeugnis · 33minutes');
  pruefe('…zählt die Seiten', /^Seite 1 von \d+$/.test(m.seiten), m.seiten);

  await s.werte(`document.getElementById('le-groesser').click()`);
  const groesser = await wirdWahr(s, `document.querySelector('.le-blatt').getBoundingClientRect().width > ${m.w + 20}`);
  pruefe('Zoom +: das Blatt wird größer', groesser);
  pruefe('…und wird danach neu und scharf gezeichnet',
    await wirdWahr(s, `${BLATT}.width >= document.querySelector('.le-blatt').getBoundingClientRect().width - 1`));
  await s.taste('-', 'Minus', 189); await s.taste('-', 'Minus', 189);
  const kleiner = await wirdWahr(s, `document.querySelector('.le-blatt').getBoundingClientRect().width < ${m.w - 20}`);
  pruefe('Taste −: das Blatt wird kleiner', kleiner);
  await s.taste('0', 'Digit0', 48);
  pruefe('Taste 0: wieder auf Breite', await wirdWahr(s, `Math.abs(document.querySelector('.le-blatt').getBoundingClientRect().width - ${m.w}) < 2`));
  await s.werte(`document.getElementById('le-buehne').dispatchEvent(new WheelEvent('wheel', { deltaY: -200, ctrlKey: true, clientX: 700, clientY: 400, bubbles: true, cancelable: true }))`);
  pruefe('Strg + Mausrad zoomt das Blatt (nicht die ganze Seite)',
    await wirdWahr(s, `document.querySelector('.le-blatt').getBoundingClientRect().width > ${m.w + 20}`));

  /* Kein Weg zum Herunterladen. */
  const wege = await s.werte(`document.querySelectorAll('a[download], a[href$=".pdf"], a[href*="/dokumente/"], embed, object, iframe').length`);
  pruefe('kein Download-Link, kein eingebetteter Browser-PDF-Leser', wege === 0, String(wege));
  pruefe('Rechtsklick aufs Blatt ist abgefangen', await s.werte(`(() => { const e = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    document.querySelector('.le-blatt canvas').dispatchEvent(e); return e.defaultPrevented; })()`));
  for (const [taste, wort] of [['s', 'Speichern'], ['p', 'Drucken']]) {
    pruefe(`Strg/Cmd+${taste.toUpperCase()} (${wort}) ist abgefangen`, await s.werte(`(() => { const e = new KeyboardEvent('keydown', { key: '${taste}', metaKey: true, ctrlKey: true, bubbles: true, cancelable: true });
      document.dispatchEvent(e); return e.defaultPrevented; })()`));
  }
  pruefe('Leseseite: keine JS-Fehler', s.fehlerAufSeite().length === 0, s.fehlerAufSeite().join(' | '));
  await s.zu();
}

/* Drucken: Im Druckbild bleibt die Seite leer. */
{
  const s = await oeffne(`${ADR}lesen.html?d=${d0}`, { port: 9383, breite: 1200, hoehe: 900 });
  await wirdWahr(s, `${tinte} > 200`, 15000);
  const vorher = await s.werte(`getComputedStyle(document.body).display`);
  const css = readFileSync(wurzel + 'assets/lesen.css', 'utf8');
  pruefe('Drucken zeigt ein leeres Blatt', vorher !== 'none' && /@media print\s*\{\s*body\s*\{\s*display:\s*none/.test(css));
  await s.zu();
}

/* Englisch: Bedienung auf Englisch. */
{
  const s = await oeffne(`${ADR}lesen.html?d=${d0}&lang=en`, { port: 9383, breite: 1200, hoehe: 900 });
  await wirdWahr(s, `${tinte} > 200`, 15000);
  const t = await s.werte(`document.getElementById('le-seiten').textContent + '|' + document.documentElement.lang`);
  pruefe('Englisch: „Page 1 of …“ und lang=en', /^Page 1 of \d+\|en$/.test(t), t);
  await s.zu();
}

/* Handy. */
{
  const s = await oeffne(`${ADR}lesen.html?d=${d0}`, { port: 9383, breite: 390, hoehe: 800 });
  await wirdWahr(s, `${tinte} > 200`, 15000);
  const m = JSON.parse(await s.werte(mass));
  pruefe('Handy: das Blatt passt in die Breite', m.l >= 0 && m.rechts <= m.fenster && m.w > m.fenster * 0.85, `${Math.round(m.l)}–${Math.round(m.rechts)} von ${m.fenster}`);
  pruefe('Handy: nichts schiebt die Seite seitlich auf', m.seiteBreit <= m.fenster, `${m.seiteBreit} / ${m.fenster}`);
  const leiste = JSON.parse(await s.werte(`JSON.stringify([...document.querySelectorAll('.le-leiste > *')].map(e => e.getBoundingClientRect().right))`));
  pruefe('Handy: die Leiste bleibt im Bild', leiste.every(r => r <= m.fenster + 0.5), leiste.map(Math.round).join(', '));
  await s.zu();
}

/* ================= 5. Kaputte Adressen ================= */
for (const [name, frage] of [['unbekanntes Dokument', 'd=gibt-es-nicht'], ['Pfad-Trick', 'd=..%2Fadmin'], ['ohne Angabe', '']]) {
  const s = await oeffne(`${ADR}lesen.html?${frage}&lang=de`, { port: 9383, breite: 1200, hoehe: 900 });
  const freundlich = await wirdWahr(s, `!document.getElementById('le-hinweis').hidden && /nicht gefunden/.test(document.getElementById('le-hinweis').textContent)`);
  pruefe(`${name}: freundlicher Hinweis statt leerem Fenster`, freundlich);
  pruefe(`${name}: …mit Weg zurück zur Startseite`, await s.werte(`!!document.querySelector('#le-hinweis a[href="/"]')`));
  await s.zu();
}

chrome.beenden(); server.beenden();
bericht();
