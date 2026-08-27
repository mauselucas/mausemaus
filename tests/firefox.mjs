/* Firefox fernsteuern -- ohne geckodriver, ohne Fremdabhängigkeit.

   Firefox lässt sich (anders als Chrome) hier nicht bequem übers
   DevTools-Protokoll ausfragen. Der Umweg ist simpel und reicht völlig:
   Wir liefern die Seite selbst aus, hängen ein Mess-Skript ans Ende und
   lassen die Seite ihr Ergebnis per fetch() an denselben Server zurück-
   melden. Kein Fernsteuerungsprotokoll nötig, keine Zusatzsoftware.

   Warum es diese Datei überhaupt gibt: Der Fehler „es ist nichts animiert"
   war zwei Runden lang unauffindbar, weil ALLE Messungen in Chrome liefen
   -- und Chrome kann Scroll-Animationen. Eine Prüfung, die den einzigen
   Browser nicht kennt, in dem der Fehler auftritt, ist keine Prüfung. */
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, extname } from 'node:path';

const FIREFOX = '/Applications/Firefox.app/Contents/MacOS/firefox';
const WURZEL = new URL('../HOCHLADEN/', import.meta.url).pathname;
const TYP = { '.html':'text/html;charset=utf-8', '.css':'text/css', '.js':'text/javascript',
  '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.txt':'text/plain',
  '.json':'application/json' };

export function firefoxDa() { return existsSync(FIREFOX); }

/* messSkript: JavaScript als Zeichenkette. Es MUSS am Ende
   fetch('/ergebnis', {method:'POST', body: JSON.stringify(…)}) aufrufen.
   verbiegen: optionale Funktion (html) => html, um die Seite vor dem
   Ausliefern absichtlich zu beschädigen -- dafür sind die Gegenbeweise da. */
export async function messeInFirefox(messSkript, {
  pfad = '/', port = 8983, breite = 1280, hoehe = 900,
  verbiegen = null, gedulds = 90000,
} = {}) {
  let fertig;
  const srv = http.createServer((req, res) => {
    const u = req.url.split('?')[0];
    if (u === '/ergebnis') {
      let b = ''; req.on('data', d => b += d);
      req.on('end', () => { res.end('ok'); fertig(b); });
      return;
    }
    let f = u === '/' ? '/index.html' : u;
    if (/^\/(welt|blog)\/[\w-]+\/?$/.test(f)) f = '/welt.html';
    const p = join(WURZEL, f);
    if (!existsSync(p)) { res.statusCode = 404; return res.end('nicht da'); }
    let inhalt = readFileSync(p);
    if (f.endsWith('.html')) {
      let html = inhalt.toString();
      if (verbiegen) html = verbiegen(html);
      inhalt = html.replace('</body>', `<script>${messSkript}</script></body>`);
    }
    res.setHeader('content-type', TYP[extname(f)] || 'application/octet-stream');
    res.end(inhalt);
  }).listen(port);

  const p = new Promise(r => fertig = r);
  /* Eigenes Profil je Lauf, im Systemtemp -- der Projektordner liegt in
     iCloud, dort scheitert das Aufräumen (siehe chrome.mjs). */
  const prof = mkdtempSync(join(tmpdir(), 'mm-ff-'));
  const ff = spawn(FIREFOX, ['--headless', '--profile', prof, '--no-remote',
    `--window-size=${breite},${hoehe}`, `http://127.0.0.1:${port}${pfad}`], { stdio: 'ignore' });

  const roh = await Promise.race([p, new Promise(r => setTimeout(() => r(null), gedulds))]);
  ff.kill(); srv.close();
  setTimeout(() => { try { rmSync(prof, { recursive: true, force: true }); } catch {} }, 300);
  if (roh === null) throw new Error('Firefox hat sich in ' + gedulds + 'ms nicht gemeldet');
  return JSON.parse(roh);
}

/* Das Mess-Skript, das beide Prüfungen benutzen. Absolute Scrollstände --
   relativ gerechnete verschieben sich zwischen zwei Messungen, sobald ein
   Bild nachlädt, und liefern dann falsche Werte (genau darauf bin ich beim
   Bauen einmal hereingefallen). */
export const MESS_EINBLENDUNG = `
const warte = ms => new Promise(r => setTimeout(r, ms));
const SC = () => document.querySelector('.br-scroller') || document.scrollingElement;
async function fahre(zu) {
  const sc = SC();
  sc.style.scrollBehavior = 'auto';   /* sonst misst man mitten im Gleiten */
  sc.scrollTop = zu;
  let letzt = null;
  for (let i = 0; i < 40; i++) {
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    if (sc.scrollTop === letzt) break;
    letzt = sc.scrollTop;
  }
  await warte(120);
  return sc.scrollTop;
}
const deck = el => +(+getComputedStyle(el).opacity).toFixed(3);
(async () => {
  await warte(6000);
  const sc = SC();
  const raus = {
    kannSelbst: CSS.supports('animation-timeline: view()'),
    klasse: document.documentElement.classList.contains('mm-bewegung'),
    blaetter: document.querySelectorAll('link[rel=stylesheet]').length,
    proben: [],
  };
  for (const s of ['.br-titel', '.br-bild', '.br-text > p']) {
    const el = document.querySelector(s);
    if (!el) { raus.proben.push({ s, fehlt: true }); continue; }
    const bez = sc === document.scrollingElement ? 0 : sc.getBoundingClientRect().top;
    const doktop = el.getBoundingClientRect().top - bez + sc.scrollTop;
    const A = Math.round(doktop - sc.clientHeight + 20);
    const B = Math.round(doktop - sc.clientHeight + 190);
    const C = Math.round(doktop - sc.clientHeight + 260);
    const D = Math.round(doktop - sc.clientHeight + 600);
    await fahre(A); const davor = deck(el);
    await fahre(B); const mitte = deck(el);
    await fahre(C); const spaet = deck(el);
    await fahre(D); const fertig = deck(el);
    await fahre(B); const zurueck = deck(el);   /* EXAKT derselbe Stand wie oben */
    raus.proben.push({ s, davor, mitte, spaet, fertig, zurueck });
  }
  fetch('/ergebnis', { method: 'POST', body: JSON.stringify(raus) });
})();
`;
