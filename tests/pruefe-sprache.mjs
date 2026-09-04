/* Prüft die englische Fassung.

   Die wichtigste Zusage steht in Prüfung 3: Ohne hinterlegte Übersetzung
   liefert die englische Seite BYTEWEISE dasselbe HTML wie die deutsche.
   Englisch ist eine Ergänzung, keine zweite Seite.

   Geprüft wird an den ECHTEN Adressen über den Nachbau-Server, nicht an den
   Dateien im Wurzelverzeichnis -- unter /welt/… lösen relative Pfade anders
   auf (siehe PROJEKTSTAND.md). */

import { starteChrome, oeffne, pruefe, bericht } from './chrome.mjs';
import { starteServer } from './server.mjs';

const wurzel = new URL('../HOCHLADEN/', import.meta.url).pathname;
const server = await starteServer({ wurzel, port: 8912 });
const chrome = await starteChrome({ port: 9344 });
const ADR = 'http://127.0.0.1:8912';
const auf = (pfad, o = {}) => oeffne(ADR + pfad, { port: 9344, ...o });

/* ---------- 1. Deutsch ist und bleibt der Standard ---------- */

/* Chrome laeuft in den Pruefungen mit einem BLEIBENDEN Profil (siehe
   chrome.mjs). Eine frueher getroffene Sprachwahl liegt also noch im
   localStorage und wuerde die "frischer Besucher"-Pruefung verfaelschen --
   sie war beim ersten Lauf prompt gruen und beim zweiten rot. Also einmal
   ausraeumen und neu laden. Genau das ist der Fall, der zaehlt: jemand,
   der zum ersten Mal kommt, bekommt Deutsch. */
const de = await auf('/');
await de.warte(200);
await de.werte(`localStorage.removeItem('mm.sprache'); location.reload();`);
await de.bisWahr(`!!document.querySelector('.mml-fuss')`);
const d1 = await de.werte(`JSON.stringify({
  lang: document.documentElement.lang,
  umschalter: !!document.querySelector('.mm-sprache'),
  aktiv: (document.querySelector('.mm-sprache a[aria-current]') || {}).textContent || '',
  fuss: document.querySelector('.mml-fuss').innerText.replace(/\\s+/g, ' ').trim(),
  sprung: (document.querySelector('.br-sprung') || {}).textContent || '',
  knopf: (document.querySelector('#anfragen button[type=submit]') || {}).textContent || '',
  echteLinks: [...document.querySelectorAll('.mm-sprache a')].map(a => a.getAttribute('href')),
})`);
const g1 = JSON.parse(d1);
pruefe('ohne Anhängsel ist die Seite deutsch', g1.lang === 'de', g1.lang);
pruefe('Umschalter ist da', g1.umschalter);
pruefe('DE ist markiert', g1.aktiv === 'DE', g1.aktiv);
pruefe('Leisten-Beschriftung deutsch', g1.fuss.includes('berufliche Projekte'), g1.fuss);
pruefe('Sprungmarke deutsch', g1.sprung === 'Zum Brief springen', g1.sprung);
pruefe('Sendeknopf deutsch', g1.knopf.includes('Anfrage senden'), g1.knopf);
/* Ohne JavaScript bliebe nur das href übrig -- es MUSS also eines geben,
   und zwar ein echtes, nicht "#" oder "javascript:". */
pruefe('Umschalter sind echte Links mit Ziel',
  g1.echteLinks.length === 2 && g1.echteLinks.every(h => /lang=(de|en)/.test(h)),
  g1.echteLinks.join(' '));

/* Der deutsche Brief als Vergleichsmaßstab für Prüfung 3. */
const briefDe = await de.werte(`document.getElementById('brief').innerHTML`);
const keineFehlerDe = de.fehlerAufSeite();
pruefe('keine JavaScript-Fehler auf der deutschen Seite',
  keineFehlerDe.length === 0, keineFehlerDe.join(' | '));

/* ---------- 2. Englisch ---------- */

const en = await auf('/?lang=en');
await en.bisWahr(`!!document.querySelector('.mml-fuss')`);
const g2 = JSON.parse(await en.werte(`JSON.stringify({
  lang: document.documentElement.lang,
  aktiv: (document.querySelector('.mm-sprache a[aria-current]') || {}).textContent || '',
  fuss: document.querySelector('.mml-fuss').innerText.replace(/\\s+/g, ' ').trim(),
  sprung: (document.querySelector('.br-sprung') || {}).textContent || '',
  knopf: (document.querySelector('#anfragen button[type=submit]') || {}).textContent || '',
  platzhalter: (document.querySelector('#anfragen input[name=name]') || {}).placeholder || '',
  betreff: (document.querySelector('#anfragen input[name=_subject]') || {}).value || '',
  locale: (document.querySelector('meta[property="og:locale"]') || {}).content || '',
  navName: (document.getElementById('leiste') || {}).ariaLabel || '',
})`));
pruefe('mit ?lang=en ist die Seite englisch', g2.lang === 'en', g2.lang);
pruefe('EN ist markiert', g2.aktiv === 'EN', g2.aktiv);
pruefe('Leisten-Beschriftung englisch', g2.fuss.includes('client work'), g2.fuss);
pruefe('Sprungmarke englisch', g2.sprung === 'Skip to the letter', g2.sprung);
pruefe('Sendeknopf englisch', g2.knopf.includes('Send enquiry'), g2.knopf);
pruefe('Platzhalter im Formular englisch', g2.platzhalter === 'Your name', g2.platzhalter);
/* Die Betreffzeile landet in Lucas' Postfach -- die soll mitziehen. */
pruefe('Betreff der Mail englisch', g2.betreff === 'New enquiry via mausemaus.com', g2.betreff);
pruefe('og:locale englisch', g2.locale === 'en_US', g2.locale);
pruefe('Name der Zeitleiste englisch', g2.navName === 'Sections of the letter', g2.navName);

const fehlerEn = en.fehlerAufSeite();
pruefe('keine JavaScript-Fehler auf der englischen Seite',
  fehlerEn.length === 0, fehlerEn.join(' | '));

/* ---------- 3. DIE Zusage: ohne Übersetzung geht kein Inhalt verloren ----------
   Solange in der Datenbank keine englischen Inhalte stehen, darf sich am
   Brief NICHTS ändern ausser den fest verdrahteten Beschriftungen -- die
   sollen ja gerade mitziehen. Also: englischen Brief nehmen, genau diese
   Beschriftungen zurückübersetzen, und dann muss Zeichen für Zeichen der
   deutsche Brief herauskommen.

   Fiele diese Prüfung, hätte etwas angefangen, deutschen Inhalt zu
   verschlucken oder zu ersetzen -- der schlimmste denkbare Fehler hier.
   Die Liste unten ist bewusst kurz und wörtlich: kommt eine neue feste
   Beschriftung im Brief dazu, schlägt diese Prüfung an und zwingt dazu,
   sie hier einzutragen. Das ist Absicht, keine Last. */
const briefEn = await en.werte(`document.getElementById('brief').innerHTML`);
const FESTE = [['ongoing', 'läuft aktuell'], ['Play video', 'Video abspielen'],
               ['Read more', 'Mehr dazu'], ['>Copy<', '>Kopieren<']];
const zurueckuebersetzt = FESTE.reduce((t, [e, d]) => t.split(e).join(d), briefEn);
pruefe('ohne Übersetzung bleibt der Brief bis aufs Zeichen der deutsche',
  zurueckuebersetzt === briefDe,
  zurueckuebersetzt === briefDe ? '' : 'erster Unterschied bei Zeichen ' +
    (() => { let i = 0; while (briefDe[i] === zurueckuebersetzt[i]) i++;
             return i + ': DE ' + JSON.stringify(briefDe.slice(i, i + 60)) +
                        ' / EN ' + JSON.stringify(zurueckuebersetzt.slice(i, i + 60)); })());

/* ---------- 3b. Der Scrollstand überlebt den Wechsel ----------
   Der Sprachwechsel lädt die Seite neu. Ohne die Rettung stünde man danach
   wieder ganz oben -- mitten im Brief besonders ärgerlich. */
const rollen = await auf('/');
await rollen.bisWahr(`!!document.querySelector('.mml-fuss')`);
/* Bewusst ein bescheidener Wert: Bilder laden verzoegert nach, die Seite
   ist im Moment des Wechsels also womoeglich kuerzer als danach. Ein zu
   grosser Wert wuerde vom Browser gekappt und die Pruefung waere mal
   gruen und mal rot, ohne dass sich am Code etwas geaendert haette. */
await rollen.werte(`document.getElementById('scroller').scrollTop = 400`);
await rollen.warte(150);
const standVorher = await rollen.werte(`document.getElementById('scroller').scrollTop`);
await rollen.werte(`document.querySelector('.mm-sprache a[hreflang=en]').click()`);
await rollen.warte(400);
await rollen.bisWahr(`!!document.querySelector('.mml-fuss')`);
await rollen.bisWahr(`document.getElementById('scroller').scrollTop > 0`, 5000);
/* Nach dem Sprung noch kurz zur Ruhe kommen lassen -- Schriften und Bilder
   koennen die Hoehe danach noch einmal aendern. */
await rollen.warte(600);
const g3b = JSON.parse(await rollen.werte(`JSON.stringify({
  y: document.getElementById('scroller').scrollTop,
  lang: document.documentElement.lang,
  such: location.search,
})`));
pruefe('Klick auf EN schaltet wirklich um', g3b.lang === 'en' && g3b.such === '?lang=en',
  g3b.lang + ' ' + g3b.such);
pruefe('der Scrollstand überlebt den Sprachwechsel',
  standVorher > 0 && Math.abs(g3b.y - standVorher) < 5, standVorher + ' → ' + g3b.y);
await rollen.zu();

/* ---------- 4. Verschmelzung Feld für Feld ----------
   Ein nur halb übersetzter Block darf seine übrigen Felder NICHT verlieren.
   Gemessen am echten Renderer mit erfundenen Blöcken -- so hängt die
   Prüfung nicht am jeweiligen Stand der Datenbank. */
const g4 = JSON.parse(await en.werte(`(() => {
  const randnotiz = {
    typ: 'randnotiz', breite: 'normal',
    inhalt:    { titel: 'Basis', zeile1: 'Köln-Ehrenfeld', zeile2: 'remote möglich', punkt: true },
    inhalt_en: { titel: 'Based in' },
  };
  const leer = { typ: 'text', breite: 'normal', inhalt: { roh: 'Hallo' } };
  const ganz = { typ: 'text', breite: 'normal',
    inhalt: { roh: 'Hallo' }, inhalt_en: { roh: 'Hello' } };
  const leerFeld = { typ: 'text', breite: 'normal',
    inhalt: { roh: 'Hallo' }, inhalt_en: { roh: '   ' } };
  return JSON.stringify({
    verschmolzen: window.mmBloecke.render(randnotiz),
    ohne: window.mmBloecke.render(leer),
    mit:  window.mmBloecke.render(ganz),
    leerFeld: window.mmBloecke.render(leerFeld),
  });
})()`));
pruefe('halb übersetzter Block: Titel englisch', g4.verschmolzen.includes('Based in'), g4.verschmolzen);
pruefe('halb übersetzter Block: Zeile 1 bleibt deutsch', g4.verschmolzen.includes('Köln-Ehrenfeld'));
pruefe('halb übersetzter Block: Zeile 2 bleibt deutsch', g4.verschmolzen.includes('remote möglich'));
pruefe('halb übersetzter Block: der grüne Punkt bleibt', g4.verschmolzen.includes('br-punkt'));
pruefe('Block ohne Übersetzung bleibt deutsch', g4.ohne.includes('Hallo'), g4.ohne);
pruefe('Block mit Übersetzung wird englisch',
  g4.mit.includes('Hello') && !g4.mit.includes('Hallo'), g4.mit);
/* Ein Feld, in dem nur Leerzeichen stehen, ist KEINE Übersetzung. */
pruefe('leeres englisches Feld zählt nicht als Übersetzung',
  g4.leerFeld.includes('Hallo'), g4.leerFeld);

/* ---------- 5. Eine Welt unter ihrer echten Adresse ---------- */

const welt = await auf('/welt/the-race-automatisierung?lang=en');
await welt.bisWahr(`!!document.querySelector('.welt-titel')`);
const g5 = JSON.parse(await welt.werte(`JSON.stringify({
  lang: document.documentElement.lang,
  zurueck: (document.querySelector('.welt-zurueck') || {}).textContent || '',
  titel: (document.querySelector('.welt-titel') || {}).textContent || '',
  regeln: [...document.styleSheets].reduce((n, b) => {
    try { return n + b.cssRules.length; } catch { return n; } }, 0),
  umschalter: document.querySelector('.mm-sprache a[hreflang=de]')?.getAttribute('href') || '',
  altEn: (document.getElementById('alt-en') || {}).href || '',
})`));
pruefe('Welt lädt englisch', g5.lang === 'en' && g5.titel.length > 0, g5.titel);
pruefe('CSS greift auch unter /welt/ (absolute Pfade)', g5.regeln > 50, g5.regeln + ' Regeln');
pruefe('Rückweg englisch', g5.zurueck === '← back to the letter', g5.zurueck);
/* Der Umschalter muss auf DIESE Welt zeigen, nicht auf die Startseite --
   sonst wirft ein Klick auf DE den Leser aus dem Projekt heraus. */
pruefe('Umschalter bleibt in der Welt',
  (g5.umschalter || '').includes('/welt/the-race-automatisierung'), g5.umschalter);
pruefe('hreflang=en zeigt auf diese Welt',
  g5.altEn.includes('/welt/the-race-automatisierung?lang=en'), g5.altEn);

const fehlerWelt = welt.fehlerAufSeite();
pruefe('keine JavaScript-Fehler in der englischen Welt',
  fehlerWelt.length === 0, fehlerWelt.join(' | '));

/* ---------- 6. Handy: Umschalter und Leisten-Griff überlappen nicht ----------
   Unter 760 px legt sich die Leiste quer, ihr Griff sitzt oben rechts.
   Gemessen, nicht angesehen -- ein Screenshot hätte das nie bewiesen.
   Nie schmaler als 520 px prüfen (siehe chrome.mjs). */
const handy = await auf('/', { breite: 520, hoehe: 900 });
await handy.bisWahr(`!!document.querySelector('.mml-griff')`);
const g6 = JSON.parse(await handy.werte(`(() => {
  const a = document.querySelector('.mm-sprache').getBoundingClientRect();
  const b = document.querySelector('.mml-griff').getBoundingClientRect();
  const ueberlappt = a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
  return JSON.stringify({ ueberlappt, a: [a.left, a.top, a.right, a.bottom],
                          b: [b.left, b.top, b.right, b.bottom], hoehe: a.height,
                          sichtbar: a.right <= innerWidth && a.left >= 0 });
})()`));
pruefe('auf dem Handy überlappen Umschalter und Leisten-Griff nicht',
  !g6.ueberlappt, 'Sprache ' + g6.a.join(',') + ' | Griff ' + g6.b.join(','));
pruefe('Umschalter ragt nicht aus dem Bild', g6.sichtbar, g6.a.join(','));
pruefe('Umschalter ist gut zu treffen (mind. 30 px hoch)', g6.hoehe >= 30, g6.hoehe + ' px');

/* ---------- 7. Der Weg über die Zwischenablage im Admin ----------
   Text erzeugen lassen, durch die Einfüge-Funktion schicken, nachsehen ob
   dieselben Felder wieder herauskommen. Mit einer erfundenen Datenbank --
   diese Prüfung schreibt NICHTS. */
const admin = await auf('/');
await admin.warte(300);
const g7 = JSON.parse(await admin.werte(`(async () => {
  const { mountUebersetzung } = await import('/assets/uebersetzen.js');
  const geschrieben = [];
  const sb = { from: (tabelle) => ({
    update: (felder) => ({ eq: async () => { geschrieben.push({ tabelle, felder }); return {}; } }),
  }) };
  const wurzel = document.createElement('div');
  document.body.appendChild(wurzel);
  const seite = { id: 1, titel: 'Die Automatisierung', untertitel: 'Ein Panel statt Handarbeit' };
  const bloecke = [
    { id: 11, typ: 'text', sort_order: 1, inhalt: { roh: 'Erster Absatz.' } },
    { id: 12, typ: 'randnotiz', sort_order: 2, inhalt: { titel: 'Rolle', zeile1: 'Schnitt', zeile2: '' } },
    { id: 13, typ: 'bild', sort_order: 3, inhalt: { roh: '![](bild.webp)' } },
  ];
  mountUebersetzung(wurzel, { sb, seite, bloecke, statusMelden() {} });

  const zeilen = [...wurzel.querySelectorAll('.ue-zeile')];
  const felder = zeilen.map(z => z.querySelector('textarea, input'));

  /* So sieht die Antwort einer Übersetzung aus. */
  wurzel.querySelector('#ue-einfuegen').click();
  const kasten = wurzel.querySelector('#ue-einfuegefeld');
  kasten.querySelector('textarea').value =
    '[1]\\nThe automation\\n\\n[2]\\nA panel instead of handwork\\n\\n' +
    '[3]\\nFirst paragraph.\\n\\n[4]\\nRole\\n\\n[5]\\nEditing';
  kasten.querySelector('[data-ue="uebernehmen"]').click();
  await new Promise(r => setTimeout(r, 50));

  return JSON.stringify({
    anzahl: zeilen.length,
    werte: felder.map(f => f.value),
    meldung: wurzel.querySelector('#ue-meldung').textContent,
    geschrieben,
    /* Der Text zum Verschicken -- kommt aus dem Kopieren-Knopf, hier ohne
       Zwischenablage nachgebaut über dieselben Marken. */
    marken: [...wurzel.querySelectorAll('.ue-marke')].map(m => m.textContent),
  });
})()`));
/* Bild-, Video-, Code- und Trennstrich-Blöcke tragen keine Sprache und
   dürfen gar nicht erst auftauchen. */
/* Erwartet sind genau fuenf Stellen: Titel, Untertitel, der Textblock und
   von der Randnotiz Titel und Zeile 1. NICHT dabei: das Bild (traegt keine
   Sprache) und Zeile 2 der Randnotiz (auf Deutsch leer -- da gibt es nichts
   zu uebersetzen). */
pruefe('nur übersetzbare Felder in der Liste — Bild bleibt draußen',
  g7.anzahl === 5, g7.anzahl + ' Zeilen (erwartet 5)');
pruefe('leeres deutsches Feld taucht nicht auf (Zeile 2 der Randnotiz)',
  !g7.werte.some(w => w === undefined) && g7.anzahl === 5);
pruefe('Übersetzung landet in den richtigen Feldern',
  g7.werte.join('|') === 'The automation|A panel instead of handwork|First paragraph.|Role|Editing',
  g7.werte.join(' | '));
pruefe('Marken sind fortlaufend nummeriert', g7.marken.join(',') === '1,2,3,4,5', g7.marken.join(','));
pruefe('Rückmeldung nennt die Zahl', g7.meldung.includes('5 von 5'), g7.meldung);
pruefe('das Übernommene wird auch geschrieben',
  g7.geschrieben.some(x => x.tabelle === 'seiten' && x.felder.titel_en === 'The automation') &&
  g7.geschrieben.some(x => x.tabelle === 'bloecke' && x.felder.inhalt_en?.roh === 'First paragraph.'),
  JSON.stringify(g7.geschrieben).slice(0, 200));

/* Eine Antwort ohne Marken darf NICHTS überschreiben -- lieber gar nichts
   tun als das Falsche an die falsche Stelle. */
const g8 = JSON.parse(await admin.werte(`(async () => {
  const { mountUebersetzung } = await import('/assets/uebersetzen.js');
  const wurzel = document.createElement('div');
  document.body.appendChild(wurzel);
  mountUebersetzung(wurzel, {
    sb: { from: () => ({ update: () => ({ eq: async () => ({}) }) }) },
    seite: { id: 2, titel: 'Titel' },
    bloecke: [{ id: 21, typ: 'text', sort_order: 1, inhalt: { roh: 'Text' } }],
    statusMelden() {},
  });
  wurzel.querySelector('#ue-einfuegen').click();
  const kasten = wurzel.querySelector('#ue-einfuegefeld');
  kasten.querySelector('textarea').value = 'Hier stehen keine Nummern in Klammern.';
  kasten.querySelector('[data-ue="uebernehmen"]').click();
  await new Promise(r => setTimeout(r, 30));
  return JSON.stringify({
    werte: [...wurzel.querySelectorAll('.ue-zeile textarea, .ue-zeile input')].map(f => f.value),
    meldung: wurzel.querySelector('#ue-meldung').textContent,
    nochOffen: !!wurzel.querySelector('#ue-einfuegefeld'),
  });
})()`));
pruefe('Antwort ohne Marken ändert nichts', g8.werte.every(w => w === ''), g8.werte.join('|'));
pruefe('…und sagt es auch', g8.meldung.includes('keine einzige Nummer'), g8.meldung);
pruefe('…und wirft das Eingefügte nicht weg', g8.nochOffen);

await de.zu(); await en.zu(); await welt.zu(); await handy.zu(); await admin.zu();
chrome.beenden(); server.beenden();
bericht();
