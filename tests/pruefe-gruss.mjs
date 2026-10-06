/* Der Gruß oben auf der Seite: Foto als Polaroid neben "Hallo ich bin
   Lucas :)" (brief.js, brief.css; im Admin das Feld "Foto zum Gruß"), und
   seit dem Kontaktformular KEINE E-Mail und KEIN Telefon mehr im Brief.

   Geprüft wird, was man sieht: Das Foto ist geladen, steht neben dem
   Gruß, ohne Text zu verdecken, ist leicht schräg, passt auf jeden
   Bildschirm -- und auf dem Handy steht es über dem Gruß. */
import { starteChrome, oeffne, pruefe, bericht } from './chrome.mjs';
import { starteServer } from './server.mjs';

const wurzel = new URL('../HOCHLADEN/', import.meta.url).pathname;
const server = await starteServer({ wurzel, port: 8935 });
const chrome = await starteChrome({ port: 9375 });
const ADR = 'http://127.0.0.1:8935/';
const bereit = (s) => s.bisWahr(`!document.getElementById('mm-laden') && !!window.mmProjekte`, 20000);

const messen = `(async () => {
  /* Scroll-Einblendungen aus: sonst misst man mitten in einer Einblendung. */
  const st = document.createElement('style'); st.textContent = '*{animation:none !important}';
  document.head.appendChild(st);
  const f = document.querySelector('.br-polaroid'), img = f && f.querySelector('img');
  if (img) await img.decode().catch(() => {});
  const r = (el) => el && el.getBoundingClientRect().toJSON();
  const ueber = (a, b) => a && b && a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
  const foto = r(f), gruss = r(document.querySelector('.br-gruss')), kicker = r(document.querySelector('.br-kicker'));
  return JSON.stringify({
    da: !!img, geladen: img ? img.naturalWidth : 0, alt: img ? img.alt : '',
    masse: img ? img.getAttribute('width') + 'x' + img.getAttribute('height') : '',
    foto, gruss, kicker,
    deckt: ueber(foto, gruss) || ueber(foto, kicker),
    schraeg: f ? getComputedStyle(f).rotate : 'none',
    breiteSeite: Math.max(document.documentElement.scrollWidth, document.getElementById('scroller')?.scrollWidth || 0),
    fenster: innerWidth,
    mail: document.querySelectorAll('#brief a[href^="mailto:"], #brief a[href^="tel:"]').length,
    leererKontakt: document.querySelectorAll('.br-kontakt:empty').length,
    formular: !!document.querySelector('form#anfragen .anf-schritt')
  });
})()`;

/* ================= Rechner ================= */
{
  const s = await oeffne(ADR, { port: 9375, breite: 1440, hoehe: 900 });
  await bereit(s);
  const m = JSON.parse(await s.werte(messen));
  pruefe('das Foto steht beim Gruß', m.da);
  pruefe('…ist geladen', m.geladen > 0, String(m.geladen));
  pruefe('…mit Beschreibung für Screenreader', m.alt.length > 20, m.alt);
  pruefe('…und Maßen (kein Springen beim Laden)', m.masse === '720x540', m.masse);
  pruefe('…rechts neben "Hallo ich bin Lucas :)"', m.foto && m.foto.left > m.gruss.left + 200 &&
    m.foto.top < m.gruss.bottom && m.foto.bottom > m.gruss.top, m.foto && `${Math.round(m.foto.left)} / ${Math.round(m.gruss.left)}`);
  pruefe('…ohne Gruß oder Unterzeile zu verdecken', !m.deckt);
  pruefe('…leicht schräg wie ein eingeklebtes Polaroid', /^-?[1-5]deg$/.test(m.schraeg), m.schraeg);
  pruefe('…gut sichtbar (mindestens 200 px breit)', m.foto && m.foto.width >= 200, m.foto && String(Math.round(m.foto.width)));
  pruefe('…und ragt nicht aus dem Fenster', m.foto && m.foto.right <= m.fenster - 8, m.foto && `${Math.round(m.foto.right)} von ${m.fenster}`);
  pruefe('keine E-Mail- oder Telefon-Links mehr im Brief', m.mail === 0, String(m.mail));
  pruefe('…und kein leerer Kontakt-Absatz', m.leererKontakt === 0);
  pruefe('das Kontaktformular ist weiterhin da', m.formular);
  pruefe('keine JS-Fehler', s.fehlerAufSeite().length === 0, s.fehlerAufSeite().join(' | '));
  await s.zu();
}

/* ================= Englisch ================= */
{
  const s = await oeffne(ADR + '?lang=en', { port: 9375, breite: 1440, hoehe: 900 });
  await bereit(s);
  const m = JSON.parse(await s.werte(messen));
  pruefe('Englisch: das Foto hat eine englische Beschreibung', /flower|daisy/i.test(m.alt), m.alt);
  await s.zu();
}

/* ================= Handy ================= */
{
  const s = await oeffne(ADR, { port: 9375, breite: 520, hoehe: 900 });
  await bereit(s);
  const m = JSON.parse(await s.werte(messen));
  pruefe('Handy: das Foto steht über dem Gruß', m.foto && m.foto.bottom <= m.gruss.top + 1,
    m.foto && `${Math.round(m.foto.bottom)} / ${Math.round(m.gruss.top)}`);
  pruefe('Handy: …ganz im Bild', m.foto && m.foto.left >= 0 && m.foto.right <= m.fenster, m.foto && `${Math.round(m.foto.left)}–${Math.round(m.foto.right)}`);
  pruefe('Handy: nichts schiebt die Seite seitlich auf', m.breiteSeite <= m.fenster, `${m.breiteSeite} / ${m.fenster}`);
  await s.zu();
}

chrome.beenden(); server.beenden();
bericht();
