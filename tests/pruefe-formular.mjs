/* Das Anfrageformular. Es lief bis zum Umzug auf GitHub Pages ueber Netlify
   Forms; dort genuegte ein Attribut. Jetzt traegt es eine echte Adresse bei
   Formspree, und ein Skript faengt das Absenden ab, damit niemand die Seite
   verlassen muss.

   ACHTUNG, das ist der Kern dieser Datei: Hier geht NIE eine echte Anfrage
   raus. window.fetch wird vor dem Absenden ersetzt. Liefe der Test scharf,
   bekaeme Lucas bei jedem Durchlauf eine Mail -- und das Freikontingent bei
   Formspree waere nach ein paar Tagen aufgebraucht. */
import { starteChrome, oeffne, pruefe, bericht } from './chrome.mjs';
import { starteServer } from './server.mjs';
const wurzel = new URL('../HOCHLADEN/', import.meta.url).pathname;
const server = await starteServer({ wurzel, port: 8906 });
const chrome = await starteChrome({ port: 9339 });
const s = await oeffne('http://127.0.0.1:8906/', { port: 9339 });
await s.warte(2500);

const d = JSON.parse(await s.werte(`(() => {
  const f = document.getElementById('anfragen');
  const a = document.getElementById('anfrage-antwort');
  return JSON.stringify({
    action: f ? f.getAttribute('action') : '-',
    methode: f ? f.getAttribute('method') : '-',
    felder: [...f.elements].map(e => e.name).filter(Boolean),
    antwortSichtbar: a ? getComputedStyle(a).display : '-',
    gotchaSichtbar: (() => { const g = f.querySelector('[name=_gotcha]');
      const h = g && g.closest('.versteckt');
      return h ? Math.round(h.getBoundingClientRect().width) + 'x' + Math.round(h.getBoundingClientRect().height) : '-'; })(),
    gotchaTab: (() => { const g = f.querySelector('[name=_gotcha]'); return g ? g.tabIndex : 99; })()
  });
})()`));
pruefe('Formular zeigt auf Formspree', d.action === 'https://formspree.io/f/xljerkoz', d.action);
pruefe('Methode ist POST', (d.methode || '').toUpperCase() === 'POST', d.methode);
pruefe('alle Felder da', ['_gotcha','_subject','name','email','nachricht'].every(n => d.felder.includes(n)), d.felder.join(','));
pruefe('Rueckmeldung ist leer unsichtbar', d.antwortSichtbar === 'none', d.antwortSichtbar);
pruefe('Honigtopf ist optisch weg', d.gotchaSichtbar === '1x1', d.gotchaSichtbar);
pruefe('Honigtopf faengt keinen Tabsprung', d.gotchaTab === -1, 'tabindex=' + d.gotchaTab);

/* Absenden mit gefaelschtem fetch -- es geht KEINE echte Anfrage raus. */
const gut = await s.werte(`(async () => {
  window.__ziel = null;
  window.fetch = (u, o) => { window.__ziel = u; return Promise.resolve({ ok: true, json: () => Promise.resolve({}) }); };
  const f = document.getElementById('anfragen');
  f.querySelector('[name=name]').value = 'Test';
  f.querySelector('[name=email]').value = 'test@example.com';
  f.querySelector('[name=nachricht]').value = 'Hallo';
  f.requestSubmit();
  await new Promise(r => setTimeout(r, 300));
  const a = document.getElementById('anfrage-antwort');
  return JSON.stringify({ ziel: window.__ziel, text: a.textContent, klasse: a.className,
    nochAufSeite: location.pathname, leerGeraeumt: f.querySelector('[name=name]').value === '' });
})()`);
const g = JSON.parse(gut);
pruefe('Absenden geht an Formspree', g.ziel === 'https://formspree.io/f/xljerkoz', String(g.ziel));
pruefe('kein Seitenwechsel', g.nochAufSeite === '/', g.nochAufSeite);
pruefe('Erfolgsmeldung erscheint', g.klasse.includes('gut') && g.text.includes('Angekommen'), g.text);
pruefe('Formular wird geleert', g.leerGeraeumt);

/* Fehlerfall */
const schlecht = JSON.parse(await s.werte(`(async () => {
  window.fetch = () => Promise.resolve({ ok: false, json: () => Promise.resolve({ errors: [{ message: 'Feld fehlt' }] }) });
  const f = document.getElementById('anfragen');
  f.querySelector('[name=name]').value = 'Test';
  f.querySelector('[name=email]').value = 'test@example.com';
  f.querySelector('[name=nachricht]').value = 'Hallo';
  f.requestSubmit();
  await new Promise(r => setTimeout(r, 300));
  const a = document.getElementById('anfrage-antwort');
  const k = f.querySelector('button[type=submit]');
  return JSON.stringify({ text: a.textContent, klasse: a.className, knopfWiederDa: !k.disabled });
})()`));
pruefe('Fehler wird gezeigt', schlecht.klasse.includes('schlecht') && schlecht.text.includes('Feld fehlt'), schlecht.text);
pruefe('Fehlermeldung nennt die E-Mail als Ausweg', schlecht.text.includes('hallo@mausemaus.com'), schlecht.text);
pruefe('Knopf ist danach wieder bedienbar', schlecht.knopfWiederDa);

const jsF = s.fehlerAufSeite();
pruefe('keine JavaScript-Fehler', jsF.length === 0, jsF.join(' | '));
await s.zu(); chrome.beenden(); server.beenden();
bericht();
