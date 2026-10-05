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

/* Die Anfrage ist gefuehrt: Absenden heisst Frage fuer Frage durchgehen.
   Der kuerzeste Pfad ist "Was anderes" -> Nachricht -> Name/E-Mail -> Brief.
   Steht noch die Erfolgsmeldung vom letzten Mal da, erst neu anfangen. */
const DURCHKLICKEN = (name = 'Test', mail = 'test@example.com', text = 'Hallo') => `
  if (f.classList.contains('anf-fertig')) f.querySelector('.anf-neu').click();
  f.querySelector('[name=kategorie][value="Was anderes"]').click();
  f.requestSubmit();
  f.querySelector('[name=nachricht]').value = '${text}';
  f.requestSubmit();
  f.querySelector('[name=name]').value = '${name}';
  f.querySelector('[name=email]').value = '${mail}';
  f.requestSubmit();
  f.requestSubmit();`;
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
  ${DURCHKLICKEN('Test', 'test@example.com', 'Hallo')}
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
  ${DURCHKLICKEN('Test', 'test@example.com', 'Hallo')}
  await new Promise(r => setTimeout(r, 300));
  const a = document.getElementById('anfrage-antwort');
  const k = document.getElementById('anf-weiter');
  return JSON.stringify({ text: a.textContent, klasse: a.className, knopfWiederDa: !k.disabled });
})()`));
pruefe('Fehler wird gezeigt', schlecht.klasse.includes('schlecht') && schlecht.text.includes('Feld fehlt'), schlecht.text);
/* Die Adresse muss eine ECHTE sein. Hier stand einmal hallo@mausemaus.com --
   eine Adresse, die es nie gab: die Domain gehoert Lucas, aber eine Domain
   bringt keine Mailbox mit (mausemaus.com hat keine MX-Eintraege, gemessen).
   Wer im Fehlerfall dorthin schrieb, schrieb ins Leere -- genau in dem
   Moment, in dem das Formular schon nicht funktioniert hat. */
pruefe('Fehlermeldung nennt die E-Mail als Ausweg',
  schlecht.text.includes('lucasschoenwald03@gmail.com'), schlecht.text);
pruefe('Knopf ist danach wieder bedienbar', schlecht.knopfWiederDa);

/* ---------- Der gefuehrte Ablauf ----------
   Gefaelschtes fetch merkt sich, WAS abgeschickt worden waere. */
const ablauf = JSON.parse(await s.werte(`(async () => {
  const f = document.getElementById('anfragen');
  window.__daten = null;
  window.fetch = (u, o) => { window.__daten = Object.fromEntries([...o.body.keys()].map(k => [k, o.body.getAll(k).join(' | ')]));
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) }); };
  if (f.classList.contains('anf-fertig')) f.querySelector('.anf-neu').click();
  const aktiv = () => (f.querySelector('.anf-schritt.aktiv') || {}).dataset?.schritt;
  const fehler = () => f.querySelector('.anf-fehler').textContent;
  /* Der Fehlerfall oben laesst das Formular bewusst beim Brief stehen
     (nichts geht verloren). Darum hier zurueck an den Anfang. */
  for (let i = 0; i < 8 && aktiv() !== 'art'; i++) f.querySelector('.anf-zurueck').click();
  f.querySelectorAll('[name=kategorie]').forEach(x => x.checked = false);
  f.dispatchEvent(new Event('change'));
  const r = { start: aktiv(), sichtbar: [...f.querySelectorAll('.anf-schritt')].filter(x => x.offsetHeight > 0).length };

  f.requestSubmit();                                   // nichts gewaehlt
  r.ohneWahl = { schritt: aktiv(), fehler: fehler() };

  /* Erst "Auftrag" anfangen und etwas ankreuzen, dann umentscheiden:
     die Auftragsfelder duerfen NICHT mitgehen. */
  f.querySelector('[name=kategorie][value="Auftrag"]').click();
  f.requestSubmit();
  r.auftragSchritt = aktiv();
  r.nummer = f.querySelector('.anf-schritt.aktiv .anf-nummer').textContent;
  f.requestSubmit();                                   // ohne Haken
  r.ohneHaken = { schritt: aktiv(), fehler: fehler() };
  f.querySelector('[name=arten][value="Videoschnitt"]').click();
  f.querySelector('.anf-zurueck').click();
  f.querySelector('[name=kategorie][value="Job-Angebot"]').click();
  f.requestSubmit();
  r.jobSchritt = aktiv();
  f.querySelector('[name=firma]').value = 'Bitbull';
  f.querySelector('[name=jobart][value="Freelance"]').click();
  f.requestSubmit();
  f.querySelector('[name=name]').value = 'Test';
  f.querySelector('[name=email]').value = 'kaputt@';
  f.requestSubmit();
  r.falscheMail = { schritt: aktiv(), fehler: fehler() };
  f.querySelector('[name=email]').value = 'test@example.com';
  f.requestSubmit();
  r.briefSchritt = aktiv();
  r.brief = f.querySelector('.anf-papier').textContent;
  r.knopf = document.getElementById('anf-weiter').textContent;
  f.requestSubmit();
  await new Promise(x => setTimeout(x, 300));
  r.daten = window.__daten;
  r.fertig = f.classList.contains('anf-fertig');
  r.fragenWeg = [...f.querySelectorAll('.anf-schritt')].every(x => x.offsetHeight === 0);
  return JSON.stringify(r);
})()`));
pruefe('am Anfang steht genau EINE Frage', ablauf.start === 'art' && ablauf.sichtbar === 1,
  ablauf.start + ', ' + ablauf.sichtbar + ' sichtbar');
pruefe('ohne Auswahl geht es nicht weiter, mit Hinweis',
  ablauf.ohneWahl.schritt === 'art' && ablauf.ohneWahl.fehler.length > 0, JSON.stringify(ablauf.ohneWahl));
pruefe('"Auftrag" fuehrt zu "Was soll entstehen?"', ablauf.auftragSchritt === 'a-was', ablauf.auftragSchritt);
pruefe('…mit Zaehler "Frage 2 von 5"', ablauf.nummer === 'Frage 2 von 5', ablauf.nummer);
pruefe('ohne Haken bleibt man dort stehen',
  ablauf.ohneHaken.schritt === 'a-was' && ablauf.ohneHaken.fehler.length > 0, JSON.stringify(ablauf.ohneHaken));
pruefe('umentschieden auf "Job-Angebot" fuehrt zum Job-Pfad', ablauf.jobSchritt === 'job', ablauf.jobSchritt);
pruefe('eine kaputte E-Mail wird angemahnt',
  ablauf.falscheMail.schritt === 'du' && ablauf.falscheMail.fehler.includes('E-Mail'), JSON.stringify(ablauf.falscheMail));
pruefe('am Ende steht die Anfrage als Brief', ablauf.briefSchritt === 'brief'
  && ablauf.brief.includes('Hi Lucas') && ablauf.brief.includes('Bitbull') && ablauf.brief.includes('test@example.com'),
  ablauf.brief.slice(0, 120));
pruefe('…und der Knopf heisst dort "Anfrage senden"', ablauf.knopf === 'Anfrage senden', ablauf.knopf);
const dt = ablauf.daten || {};
pruefe('abgeschickt wird Name, E-Mail und der Job', dt.name === 'Test' && dt.email === 'test@example.com'
  && dt.firma === 'Bitbull' && dt.kategorie === 'Job-Angebot', JSON.stringify(dt));
pruefe('die Betreffzeile sagt schon, worum es geht',
  dt._subject === '[Job-Angebot] · Bitbull, Freelance · Test', dt._subject);
pruefe('der verlassene Auftrags-Pfad geht NICHT mit', !('arten' in dt) && !('budget' in dt), Object.keys(dt).join(','));
pruefe('nach dem Absenden sind die Fragen weg', ablauf.fertig && ablauf.fragenWeg);

const jsF = s.fehlerAufSeite();
pruefe('keine JavaScript-Fehler', jsF.length === 0, jsF.join(' | '));
await s.zu(); chrome.beenden(); server.beenden();
bericht();
