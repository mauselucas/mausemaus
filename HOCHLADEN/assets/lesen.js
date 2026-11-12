/* Die Leseseite: zeigt eine PDF aus /dokumente/ wie ein PDF-Leser, ohne
   dass der Browser seinen eigenen Leser (mit Download-Knopf) öffnet.

     /lesen.html?d=zeugnis-33minutes&t=Arbeitszeugnis 33minutes

   d = Dateiname in /dokumente/ ohne .pdf (nur a–z, 0–9, Bindestrich),
   t = Titel oben in der Leiste (optional).

   Gezeichnet wird mit pdf.js (dem Leser aus Firefox) auf <canvas>. Es gibt
   keinen Download- und keinen Druckweg auf der Seite; Rechtsklick und
   Strg/Cmd+S/P sind abgefangen. Ehrlich: Wer die Datei unbedingt will,
   bekommt sie über die Entwicklerwerkzeuge trotzdem -- verhindern lässt
   sich das bei nichts, was ein Browser anzeigt. */
import * as pdfjs from '/assets/vendor/pdfjs-4.10.38/pdf.min.mjs';

pdfjs.GlobalWorkerOptions.workerSrc = '/assets/vendor/pdfjs-4.10.38/pdf.worker.min.mjs';

const $ = (id) => document.getElementById(id);
const buehne = $('le-buehne'), blaetter = $('le-blaetter'), hinweis = $('le-hinweis');
const anzeigeSeiten = $('le-seiten'), anzeigeZoom = $('le-zoom');
const knopfKleiner = $('le-kleiner'), knopfGroesser = $('le-groesser');

const englisch = (() => {
  const p = new URLSearchParams(location.search).get('lang');
  if (p) return p === 'en';
  try { return localStorage.getItem('mm.sprache') === 'en'; } catch { return false; }
})();
const T = englisch
  ? { seite: (a, b) => `Page ${a} of ${b}`, fehlt: 'Document not found', fehltText: 'This link doesn’t lead to a document (anymore).', zurueck: 'Back to mausemaus', kaputt: 'The document couldn’t be opened.', art: 'PDF document', kleiner: 'Zoom out', groesser: 'Zoom in', heim: 'Back to the homepage', breite: 'Fit to width (0)' }
  : { seite: (a, b) => `Seite ${a} von ${b}`, fehlt: 'Dokument nicht gefunden', fehltText: 'Unter diesem Link liegt (nicht mehr) ein Dokument.', zurueck: 'Zurück zu mausemaus', kaputt: 'Das Dokument ließ sich nicht öffnen.', art: 'PDF-Dokument', kleiner: 'Verkleinern', groesser: 'Vergrößern', heim: 'Zur Startseite', breite: 'An Breite anpassen (0)' };
if (englisch) {
  document.documentElement.lang = 'en';
  knopfKleiner.setAttribute('aria-label', T.kleiner); knopfKleiner.title = T.kleiner + ' (−)';
  knopfGroesser.setAttribute('aria-label', T.groesser); knopfGroesser.title = T.groesser + ' (+)';
  document.querySelector('.le-heim').setAttribute('aria-label', T.heim);
  anzeigeZoom.title = T.breite;
}
$('le-art').textContent = T.art;

const params = new URLSearchParams(location.search);
const name = params.get('d') || '';
const titel = (params.get('t') || '').trim().slice(0, 120);
if (titel) { $('le-titel').textContent = titel; document.title = titel + ' — mausemaus'; }

function zeigeHinweis(kopf, text) {
  blaetter.removeAttribute('aria-busy');
  blaetter.hidden = true;
  hinweis.hidden = false;
  hinweis.innerHTML = '';
  const s = document.createElement('strong'); s.textContent = kopf;
  const p = document.createElement('p'); p.textContent = text;
  const a = document.createElement('a'); a.href = '/'; a.textContent = T.zurueck;
  hinweis.append(s, p, a);
  anzeigeSeiten.textContent = '–';
  knopfKleiner.disabled = knopfGroesser.disabled = anzeigeZoom.disabled = true;
}

/* ---------- Kein Download, kein Druck ---------- */
blaetter.addEventListener('contextmenu', (e) => e.preventDefault());
blaetter.addEventListener('dragstart', (e) => e.preventDefault());
addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && /^[sp]$/i.test(e.key)) e.preventDefault();
});

/* ---------- Laden ---------- */
const STUFEN = [0.5, 0.67, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3];
let doc = null, seiten = [], zoom = 1, anBreite = true;

async function laden() {
  if (!/^[a-z0-9-]{1,80}$/.test(name)) return zeigeHinweis(T.fehlt, T.fehltText);
  try {
    doc = await pdfjs.getDocument({
      url: `/dokumente/${name}.pdf`,
      isEvalSupported: false,
      enableXfa: false,
    }).promise;
  } catch (f) {
    return zeigeHinweis(T.fehlt, /Missing|404|Unexpected server/i.test(String(f && (f.name + f.message))) ? T.fehltText : T.kaputt);
  }
  for (let n = 1; n <= doc.numPages; n++) {
    const seite = await doc.getPage(n);
    const basis = seite.getViewport({ scale: 1 });
    const blatt = document.createElement('div');
    blatt.className = 'le-blatt';
    blatt.dataset.seite = n;
    const canvas = document.createElement('canvas');
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', T.seite(n, doc.numPages));
    blatt.appendChild(canvas);
    blaetter.appendChild(blatt);
    seiten.push({ seite, basis, blatt, canvas, gezeichnet: 0, aufgabe: null });
  }
  blaetter.removeAttribute('aria-busy');
  anzeigeSeiten.textContent = T.seite(1, doc.numPages);
  zoom = breitenZoom();
  anwenden();
  beobachten();
}

/* ---------- Zoom ---------- */
function breitenZoom() {
  const s = seiten[0]; if (!s) return 1;
  const platz = buehne.clientWidth - (innerWidth <= 620 ? 24 : 48);
  /* Auf großen Bildschirmen nicht über ~ein Blatt Lesebreite hinaus. */
  return Math.max(0.3, Math.min(platz, 820) / s.basis.width);
}

function anwenden() {
  for (const s of seiten) {
    s.blatt.style.width = Math.round(s.basis.width * zoom) + 'px';
    s.blatt.style.height = Math.round(s.basis.height * zoom) + 'px';
  }
  anzeigeZoom.textContent = Math.round(zoom * 100) + ' %';
  knopfKleiner.disabled = zoom <= STUFEN[0] + 0.001;
  knopfGroesser.disabled = zoom >= STUFEN[STUFEN.length - 1] - 0.001;
  zeichneSichtbare();
}

function zoomAuf(neu, anker) {
  neu = Math.min(STUFEN[STUFEN.length - 1], Math.max(STUFEN[0], neu));
  if (Math.abs(neu - zoom) < 0.001) return;
  /* Die Stelle unter dem Anker (Mausposition oder Mitte) bleibt stehen. */
  const r = buehne.getBoundingClientRect();
  const ax = anker ? anker.x - r.left : buehne.clientWidth / 2;
  const ay = anker ? anker.y - r.top : buehne.clientHeight / 2;
  const fx = (buehne.scrollLeft + ax) / Math.max(1, blaetter.scrollWidth);
  const fy = (buehne.scrollTop + ay) / Math.max(1, blaetter.scrollHeight);
  zoom = neu;
  anwenden();
  buehne.scrollLeft = fx * blaetter.scrollWidth - ax;
  buehne.scrollTop = fy * blaetter.scrollHeight - ay;
}
const stufe = (richtung) => {
  if (richtung > 0) return STUFEN.find(z => z > zoom + 0.01) ?? STUFEN[STUFEN.length - 1];
  return [...STUFEN].reverse().find(z => z < zoom - 0.01) ?? STUFEN[0];
};

knopfGroesser.addEventListener('click', () => { anBreite = false; zoomAuf(stufe(+1)); });
knopfKleiner.addEventListener('click', () => { anBreite = false; zoomAuf(stufe(-1)); });
anzeigeZoom.addEventListener('click', () => { anBreite = true; zoomAuf(breitenZoom()); });

addEventListener('keydown', (e) => {
  if (!doc || e.altKey) return;
  if (e.target.closest && e.target.closest('input, textarea')) return;
  if (e.key === '+' || e.key === '=') { e.preventDefault(); anBreite = false; zoomAuf(stufe(+1)); }
  else if (e.key === '-' || e.key === '_') { e.preventDefault(); anBreite = false; zoomAuf(stufe(-1)); }
  else if (e.key === '0') { e.preventDefault(); anBreite = true; zoomAuf(breitenZoom()); }
});

/* Strg/Cmd + Mausrad und Zwei-Finger-Zoom auf dem Trackpad zoomen das
   Blatt statt die ganze Seite. */
buehne.addEventListener('wheel', (e) => {
  if (!e.ctrlKey && !e.metaKey) return;
  e.preventDefault();
  anBreite = false;
  zoomAuf(zoom * Math.exp(-e.deltaY * 0.0025), { x: e.clientX, y: e.clientY });
}, { passive: false });

let groesseZeit;
addEventListener('resize', () => {
  clearTimeout(groesseZeit);
  groesseZeit = setTimeout(() => { if (anBreite && doc) { zoom = breitenZoom(); anwenden(); } }, 120);
});

/* ---------- Zeichnen ---------- */
/* Gezeichnet wird scharf für den Bildschirm (Pixeldichte mal Zoom), und nur,
   was gerade zu sehen ist. Nach dem Zoomen kurz warten, damit beim Drehen
   am Mausrad nicht jede Zwischenstufe neu gerechnet wird. */
let zeichenZeit;
function zeichneSichtbare() {
  clearTimeout(zeichenZeit);
  zeichenZeit = setTimeout(() => {
    const r = buehne.getBoundingClientRect();
    for (const s of seiten) {
      const b = s.blatt.getBoundingClientRect();
      if (b.bottom > r.top - r.height && b.top < r.bottom + r.height) zeichne(s);
    }
  }, seiten.some(s => s.gezeichnet) ? 140 : 0);
}

async function zeichne(s) {
  const dichte = Math.min(window.devicePixelRatio || 1, 3);
  const massstab = zoom * dichte;
  if (Math.abs(s.gezeichnet - massstab) < 0.001) return;
  if (s.aufgabe) { s.aufgabe.cancel(); s.aufgabe = null; }
  const ansicht = s.seite.getViewport({ scale: massstab });
  /* In eine Hilfsleinwand zeichnen und erst fertig umkopieren -- sonst
     blitzt beim Zoomen ein leeres Blatt auf. */
  const neu = document.createElement('canvas');
  neu.width = Math.floor(ansicht.width);
  neu.height = Math.floor(ansicht.height);
  const aufgabe = s.seite.render({ canvasContext: neu.getContext('2d'), viewport: ansicht });
  s.aufgabe = aufgabe;
  try { await aufgabe.promise; } catch { return; }
  if (s.aufgabe !== aufgabe) return;
  s.aufgabe = null;
  s.canvas.width = neu.width; s.canvas.height = neu.height;
  s.canvas.getContext('2d').drawImage(neu, 0, 0);
  s.gezeichnet = massstab;
  s.blatt.classList.add('da');
}

function beobachten() {
  buehne.addEventListener('scroll', () => {
    zeichneSichtbare();
    /* Welche Seite gerade in der Mitte steht. */
    const mitte = buehne.getBoundingClientRect().top + buehne.clientHeight / 2;
    let aktuell = 1;
    for (const s of seiten) if (s.blatt.getBoundingClientRect().top <= mitte) aktuell = +s.blatt.dataset.seite;
    anzeigeSeiten.textContent = T.seite(aktuell, seiten.length);
  }, { passive: true });
  buehne.focus({ preventScroll: true });
}

laden();
