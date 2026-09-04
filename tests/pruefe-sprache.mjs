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

/* bisWahr() aus chrome.mjs WIRFT, wenn die Frist ablaeuft -- die ganze
   Pruefdatei bricht dann ab. Fuer eine Erwartung, die auch scheitern
   DARF ("er zieht sich zusammen"), ist das falsch herum: Beim Gegenbeweis
   sah die abgebrochene Datei aus wie "keine Fehler". Also eine Fassung,
   die statt zu werfen einfach false liefert. */
async function wirdWahr(seite, ausdruck, frist = 8000, takt = 120) {
  const ende = Date.now() + frist;
  for (;;) {
    let wert = false;
    try { wert = await seite.werte(ausdruck); } catch {}
    if (wert) return true;
    if (Date.now() > ende) return false;
    await new Promise(r => setTimeout(r, takt));
  }
}

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
  aktiv: (document.querySelector('.mms-wahl[aria-current]') || {}).textContent.trim() || '',
  imKnopf: document.querySelector('.mms-name').textContent,
  flagge: document.querySelector('.mms-flagge').getAttribute('src'),
  fuss: document.querySelector('.mml-fuss').innerText.replace(/\\s+/g, ' ').trim(),
  sprung: (document.querySelector('.br-sprung') || {}).textContent || '',
  knopf: (document.querySelector('#anfragen button[type=submit]') || {}).textContent || '',
  echteLinks: [...document.querySelectorAll('.mms-wahl[href]')].map(a => a.getAttribute('href')),
  auswahl: [...document.querySelectorAll('.mms-wahl')].map(a => a.textContent.trim()),
})`);
const g1 = JSON.parse(d1);
pruefe('ohne Anhängsel ist die Seite deutsch', g1.lang === 'de', g1.lang);
pruefe('Umschalter ist da', g1.umschalter);
pruefe('Deutsch ist markiert', g1.aktiv === 'Deutsch', g1.aktiv);
pruefe('im Knopf steht Deutsch mit deutscher Flagge',
  g1.imKnopf === 'Deutsch' && g1.flagge === '/assets/flaggen/de.png', g1.imKnopf + ' ' + g1.flagge);
/* Niederländisch steht bewusst schon im Knopf, ist aber noch nicht zu haben. */
pruefe('drei Sprachen zur Auswahl, Niederländisch dabei',
  g1.auswahl.join('|') === 'Deutsch|English|Nederlands', g1.auswahl.join(' | '));
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
  aktiv: (document.querySelector('.mms-wahl[aria-current]') || {}).textContent.trim() || '',
  imKnopf: document.querySelector('.mms-name').textContent,
  flagge: document.querySelector('.mms-flagge').getAttribute('src'),
  fuss: document.querySelector('.mml-fuss').innerText.replace(/\\s+/g, ' ').trim(),
  sprung: (document.querySelector('.br-sprung') || {}).textContent || '',
  knopf: (document.querySelector('#anfragen button[type=submit]') || {}).textContent || '',
  platzhalter: (document.querySelector('#anfragen input[name=name]') || {}).placeholder || '',
  betreff: (document.querySelector('#anfragen input[name=_subject]') || {}).value || '',
  locale: (document.querySelector('meta[property="og:locale"]') || {}).content || '',
  navName: (document.getElementById('leiste') || {}).ariaLabel || '',
})`));
pruefe('mit ?lang=en ist die Seite englisch', g2.lang === 'en', g2.lang);
pruefe('English ist markiert', g2.aktiv === 'English', g2.aktiv);
pruefe('im Knopf steht English mit der passenden Flagge',
  g2.imKnopf === 'English' && g2.flagge === '/assets/flaggen/en.png', g2.imKnopf + ' ' + g2.flagge);
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
   Gemessen an den ECHTEN Daten, aber unabhaengig davon, wie viel gerade
   uebersetzt ist: Fuer jeden Block OHNE englische Fassung muss der
   englische Aufbau woertlich derselbe sein wie der deutsche. Fuer jeden
   Block MIT Fassung muss die Uebersetzung auch wirklich ankommen.

   Frueher stand hier ein Vergleich des ganzen Briefs. Der ging aus, sobald
   Lucas den ersten Satz uebersetzt hatte -- eine Pruefung, die vom
   Datenstand abhaengt, wird frueher oder spaeter zu Unrecht rot und dann
   ignoriert. */
const g3 = JSON.parse(await en.werte(`(async () => {
  const seite = await window.mmLoadSeite('brief', 'brief');
  const bloecke = (seite && seite.bloecke) || [];
  const ohne = bloecke.filter(b => !b.inhalt_en || !Object.keys(b.inhalt_en).length);
  /* abschnitt-Bloecke bleiben aussen vor: render() liefert fuer sie
     absichtlich einen leeren Text -- sie sind nur Marker fuer die
     Zeitleiste, ihr Titel kommt ueber gruppieren() heraus. Der wird
     gleich darunter eigens geprueft. */
  const mit  = bloecke.filter(b => b.typ !== 'abschnitt'
    && b.inhalt_en && Object.keys(b.inhalt_en).length);
  /* Fuer den deutschen Vergleich denselben Block ohne inhalt_en rendern --
     das ist per Definition die deutsche Ausgabe. */
  const deutsch = (b) => window.mmBloecke.render({ ...b, inhalt_en: null }, 'br-text');
  const englisch = (b) => window.mmBloecke.render(b, 'br-text');
  return JSON.stringify({
    gesamt: bloecke.length, ohne: ohne.length, mit: mit.length,
    alleGleich: ohne.every(b => englisch(b) === deutsch(b)),
    ersterUnterschied: (ohne.find(b => englisch(b) !== deutsch(b)) || {}).id || null,
    /* Wo uebersetzt wurde, MUSS sich auch etwas aendern -- sonst kaeme die
       Uebersetzung gar nicht an und niemand merkte es. */
    uebersetzteKommenAn: mit.every(b => englisch(b) !== deutsch(b)),
    identisch: ohne.every(b => window.mmInhaltVon(b) === b.inhalt),
    /* Und die Abschnitte: ihr Titel geht in die Zeitleiste links. */
    abschnitte: window.mmBloecke.gruppieren(bloecke).map(g => g.titel),
    abschnitteDe: window.mmBloecke.gruppieren(
      bloecke.map(b => ({ ...b, inhalt_en: null }))).map(g => g.titel),
    abschnitteUebersetzt: bloecke.filter(b => b.typ === 'abschnitt'
      && b.inhalt_en && b.inhalt_en.titel && b.inhalt_en.titel.trim()).length,
  });
})()`));
pruefe('Blöcke ohne Übersetzung bleiben Zeichen für Zeichen deutsch',
  g3.alleGleich, g3.ohne + ' von ' + g3.gesamt + ' Blöcken ohne Fassung' +
  (g3.ersterUnterschied ? ', Ausreißer: Block ' + g3.ersterUnterschied : ''));
/* Noch schaerfer: es wird nicht nur dasselbe gerendert, es ist wortwoertlich
   dasselbe Objekt. Da kann sich gar nichts einschleichen. */
pruefe('…und zwar aus demselben Objekt, nicht aus einer Kopie', g3.identisch);
pruefe('wo übersetzt wurde, kommt die Übersetzung auch an',
  g3.uebersetzteKommenAn, g3.mit + ' Blöcke mit englischer Fassung');
/* Ein uebersetzter Abschnittstitel muss auch in der Zeitleiste ankommen --
   sonst stuende links weiter Deutsch neben englischem Text. Die Zahl der
   uebersetzten Titel muss sich genau in der Zahl der Unterschiede
   wiederfinden; ist noch keiner uebersetzt, muessen beide Listen gleich
   sein. Beides zusammen ist nur erfuellbar, wenn es wirklich durchgereicht
   wird. */
const anders = g3.abschnitte.filter((t, i) => t !== g3.abschnitteDe[i]).length;
pruefe('übersetzte Abschnittstitel stehen auch in der Zeitleiste',
  g3.abschnitte.length === g3.abschnitteDe.length && anders === g3.abschnitteUebersetzt,
  g3.abschnitteUebersetzt + ' übersetzt, ' + anders + ' anders — ' + g3.abschnitte.join(' · '));

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
/* Ausreichend warten, BEVOR gemessen wird: html traegt scroll-behavior:
   smooth, das gilt auch fuer ein zugewiesenes scrollTop. Wer sofort misst,
   erwischt einen Wert mitten in der Bewegung -- gemerkt wird beim Klick
   dann ein anderer, und die Pruefung ist mal gruen und mal rot. */
await rollen.warte(900);
const standVorher = await rollen.werte(`document.getElementById('scroller').scrollTop`);
await rollen.werte(`document.querySelector('.mms-wahl[hreflang=en]').click()`);
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
  umschalter: document.querySelector('.mms-wahl[hreflang=de]')?.getAttribute('href') || '',
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

/* ---------- 6. Wie sich der Knopf benimmt ----------
   Er steht beim Laden in voller Breite da, zieht sich erst ein paar
   Sekunden NACH dem ersten Scrollen auf die Flagge zusammen und wird beim
   Klick wieder gross. Das ist der ganze Punkt an ihm: Wer die Seite nicht
   lesen kann, soll ihn bemerken, bevor er verschwindet. */
const knopf = await auf('/');
await knopf.warte(200);
/* Wie oben: eine frueher gemerkte Sprachwahl wuerde die Messung
   verfaelschen -- Chrome laeuft mit einem bleibenden Profil. */
await knopf.werte(`localStorage.removeItem('mm.sprache'); location.reload();`);
await knopf.bisWahr(`!!document.querySelector('.mms-knopf')`);
await knopf.warte(700);
const messen = () => knopf.werte(`(() => {
  const k = document.querySelector('.mms-knopf').getBoundingClientRect();
  const d = document.querySelector('.mm-sprache');
  return JSON.stringify({ breite: Math.round(k.width), hoehe: Math.round(k.height),
    randRechts: Math.round(innerWidth - k.right), randUnten: Math.round(innerHeight - k.bottom),
    klein: d.classList.contains('mms-klein'), offen: d.open });
})()`);
const v1 = JSON.parse(await messen());
pruefe('beim Laden steht er in voller Breite da', !v1.klein && v1.breite > 100, v1.breite + ' px');
pruefe('er sitzt unten rechts, nicht am Rand geklebt',
  v1.randRechts >= 20 && v1.randUnten >= 20, v1.randRechts + '/' + v1.randUnten + ' px Abstand');
pruefe('er ist gut zu treffen (mind. 40 px hoch)', v1.hoehe >= 40, v1.hoehe + ' px');

/* Kurz nach dem Scrollen ist er noch da -- das ist die Zusage. */
await knopf.werte(`document.getElementById('scroller').scrollTop = 600`);
await knopf.warte(1300);
const v2 = JSON.parse(await messen());
pruefe('gut eine Sekunde nach dem Scrollen steht er noch voll da', !v2.klein, v2.breite + ' px');

const wurdeKlein = await wirdWahr(knopf,
  `document.querySelector('.mm-sprache').classList.contains('mms-klein')`, 8000);
/* Die Klasse ist gesetzt, das Zusammenziehen selbst dauert aber noch
   (420 ms Uebergang). Sofort messen hiesse mitten in der Bewegung messen. */
await knopf.warte(600);
const v3 = JSON.parse(await messen());
pruefe('danach zieht er sich auf die Flagge zusammen',
  wurdeKlein && v3.klein && v3.breite < 60,
  wurdeKlein ? v3.breite + ' px' : 'nach 8 s immer noch nicht zusammengezogen');
/* Zusammengezogen heisst NICHT weg -- er muss anklickbar bleiben. */
pruefe('…bleibt dabei aber gross genug zum Antippen',
  v3.breite >= 40 && v3.hoehe >= 40, v3.breite + '×' + v3.hoehe);

await knopf.werte(`document.querySelector('.mms-knopf').click()`);
await knopf.warte(700);
const v4 = JSON.parse(await messen());
pruefe('ein Klick macht ihn wieder gross und klappt auf',
  !v4.klein && v4.offen && v4.breite > 100, v4.breite + ' px, offen: ' + v4.offen);

const g6 = JSON.parse(await knopf.werte(`(() => {
  const b = document.querySelector('.mms-blase').getBoundingClientRect();
  const k = document.querySelector('.mms-knopf').getBoundingClientRect();
  return JSON.stringify({ imBild: b.left >= 0 && b.right <= innerWidth && b.top >= 0,
    ueberDemKnopf: b.bottom <= k.top,
    breite: Math.round(b.width) });
})()`));
pruefe('die Auswahl steht vollständig im Bild', g6.imBild, 'Breite ' + g6.breite);
pruefe('…und über dem Knopf, nicht unter dem Bildrand', g6.ueberDemKnopf);

/* Niederländisch gibt es noch nicht: ein Klick darf NICHTS umschalten,
   sondern nur kurz Bescheid sagen. */
await knopf.werte(`document.querySelector('.mms-bald').click()`);
await knopf.warte(400);
const g6b = JSON.parse(await knopf.werte(`JSON.stringify({
  hinweis: document.querySelector('.mms-hinweis').textContent,
  sichtbar: document.querySelector('.mms-hinweis').classList.contains('da'),
  such: location.search, lang: document.documentElement.lang,
  imKnopf: document.querySelector('.mms-name').textContent,
})`));
pruefe('Niederländisch sagt Bescheid statt umzuschalten',
  g6b.hinweis === 'nog niet mogelijk :(' && g6b.sichtbar, g6b.hinweis);
pruefe('…und ändert dabei wirklich nichts',
  g6b.lang === 'de' && g6b.imKnopf === 'Deutsch' && !g6b.such.includes('nl'),
  g6b.lang + ' ' + g6b.imKnopf + ' ' + g6b.such);
/* Und er geht von selbst wieder weg -- kein Fenster zum Wegklicken. */
pruefe('der Hinweis verschwindet von selbst wieder',
  await wirdWahr(knopf, `!document.querySelector('.mms-hinweis').classList.contains('da')`, 4000));
await knopf.zu();

/* ---------- 6b. Handy ----------
   Unten rechts darf er nichts verdecken, was man braucht. Gemessen,
   nicht angesehen. Nie schmaler als 520 px pruefen (siehe chrome.mjs). */
const handy = await auf('/', { breite: 520, hoehe: 820 });
await handy.bisWahr(`!!document.querySelector('#anfragen button[type=submit]')`);
await handy.warte(900);
/* Ans Ende scrollen, wo Formular und Knopf zusammentreffen. Mehrfach,
   weil nachladende Bilder die Seite waehrenddessen laenger machen. */
for (let i = 0; i < 6; i++) {
  await handy.werte(`window.scrollTo(0, document.body.scrollHeight)`);
  await handy.warte(400);
}
const g6c = JSON.parse(await handy.werte(`(() => {
  const k = document.querySelector('.mms-knopf').getBoundingClientRect();
  const trifft = (r) => k.left < r.right && r.left < k.right && k.top < r.bottom && r.top < k.bottom;
  const senden = document.querySelector('#anfragen button[type=submit]').getBoundingClientRect();
  const feld = document.querySelector('#anfragen textarea').getBoundingClientRect();
  return JSON.stringify({ ueberSenden: trifft(senden), ueberTextfeld: trifft(feld),
    imBild: k.right <= innerWidth && k.left >= 0 && k.bottom <= innerHeight,
    sendenSichtbar: senden.top > 0 && senden.bottom < innerHeight });
})()`));
pruefe('auf dem Handy verdeckt er den Sendeknopf nicht',
  !g6c.ueberSenden && g6c.sendenSichtbar,
  g6c.sendenSichtbar ? '' : 'Sendeknopf war nicht im Bild — Messung wertlos');
pruefe('…und auch nicht das Textfeld', !g6c.ueberTextfeld);
pruefe('…und ragt nicht aus dem Bild', g6c.imBild);

const g6d = JSON.parse(await handy.werte(`(() => {
  document.querySelector('.mms-knopf').click();
  const b = document.querySelector('.mms-blase').getBoundingClientRect();
  return JSON.stringify({ imBild: b.left >= 0 && b.right <= innerWidth && b.top >= 0,
    rect: [Math.round(b.left), Math.round(b.width)] });
})()`));
pruefe('die Auswahl passt auch auf ein schmales Gerät ins Bild',
  g6d.imBild, 'links ' + g6d.rect[0] + ', breit ' + g6d.rect[1]);
await handy.zu();

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
