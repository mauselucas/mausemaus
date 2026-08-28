/* Prüft, was die Seite für Leute tut, die sie nicht mit der Maus und nicht
   mit scharfen Augen bedienen.

   Vier Dinge waren offen, und alle vier sind unsichtbar, solange man die
   Seite nur ansieht:

     1. Die Zeitleiste war aus <div> gebaut -- mit der Tastatur kam man an
        keinen einzigen Abschnitt heran.
     2. Die Formularfelder trugen ihre Beschriftung NUR im placeholder. Der
        verschwindet beim Tippen, und ein Screenreader liest ein
        unbeschriftetes Feld vor.
     3. Die kleinen Etiketten standen auf #A8A79C -- 2,32:1 gegen den
        Untergrund, WCAG AA verlangt 4,5:1.
     4. Es gab keine Landmarks und keine Sprungmarke.

   Der Kontrast wird hier aus den WIRKLICH gezeichneten Farben gerechnet,
   nicht aus dem Stylesheet gelesen: nur so faellt auch auf, wenn eine
   spaetere Regel die Farbe wieder umwirft. */

import { readFileSync } from 'node:fs';
import { starteChrome, oeffne, pruefe, bericht } from './chrome.mjs';
import { starteServer } from './server.mjs';

const wurzel = new URL('../HOCHLADEN/', import.meta.url).pathname;
const server = await starteServer({ wurzel, port: 8916 });
const chrome = await starteChrome({ port: 9356 });
const messen = readFileSync(new URL('./feste/a11y-messen.js', import.meta.url), 'utf8');

const s = await oeffne('http://127.0.0.1:8916/', { port: 9356, breite: 1280, hoehe: 900 });
await s.warte(2600);
const d = JSON.parse(await s.werte(messen));

/* ---------- Aufbau der Seite ---------- */
pruefe('der Brief steckt in einem <main>', d.main === 1, 'main=' + d.main);
pruefe('die Zeitleiste ist ein beschriftetes <nav>',
  d.nav === 1 && d.navBeschriftet, 'nav=' + d.nav + ' beschriftet=' + d.navBeschriftet);
pruefe('die Seite hat genau EINE h1', d.h1 === 1, 'h1=' + d.h1);

/* ---------- Sprungmarke ---------- */
pruefe('die Sprungmarke ist das erste, was den Fokus bekommt', d.sprungErster);
pruefe('…und bleibt unsichtbar, solange sie ihn nicht hat', d.sprungVersteckt);

/* ---------- Formular ---------- */
pruefe('es gibt überhaupt Formularfelder zu prüfen', d.felderGesamt >= 3, d.felderGesamt + ' Felder');
pruefe('jedes Formularfeld trägt eine echte Beschriftung',
  d.felderOhneLabel === 0, d.felderOhneLabel + ' ohne');

/* ---------- Zeitleiste ---------- */
pruefe('es gibt überhaupt Abschnitte in der Leiste', d.etikettenGesamt > 0, d.etikettenGesamt);
pruefe('jedes Etikett der Leiste ist eine bedienbare Schaltfläche',
  d.knoepfe === d.etikettenGesamt, d.knoepfe + ' von ' + d.etikettenGesamt);
/* Segment und Etikett loesen DASSELBE aus. Waeren beide bedienbar, muesste
   man jeden Abschnitt zweimal durchtabben. */
pruefe('die Segmente daneben sind als Zierde ausgewiesen',
  d.segmenteVersteckt === d.segmenteGesamt && d.segmenteGesamt > 0,
  d.segmenteVersteckt + ' von ' + d.segmenteGesamt);
pruefe('der Abschnitt, in dem man steht, ist auch ohne Blick erkennbar',
  d.ariaCurrent === 1, 'aria-current=' + d.ariaCurrent);
pruefe('keine unsichtbaren Elemente in der Tabfolge',
  d.fallen === 0, d.fallen + ' Fallen');

/* ---------- Kontrast ---------- */
pruefe('es gibt überhaupt leise Etiketten zu messen', d.leise.length >= 4, d.leise.length);
for (const l of d.leise) {
  pruefe(`Kontrast ${l.wahl} erfüllt WCAG AA (4,5:1)`,
    l.wert >= 4.5, l.wert + ':1 bei ' + l.groesse);
}

/* ---------- Eingeklappte Leiste ----------
   Die Etiketten werden beim Scrollen ausgeblendet -- frueher mit opacity:0
   allein. Das macht unsichtbar, aber NICHT unerreichbar: seit die Etiketten
   echte Schaltflaechen sind, koennte man sich sonst durch eine Reihe
   unsichtbarer Knoepfe tabben. */
await s.werte(`document.querySelector('.mml').classList.add('mml-zu')`);
await s.warte(1100);   // die Blende dauert 860ms, danach greift visibility
const zu = JSON.parse(await s.werte(`(() => {
  const k = document.querySelector('.mml-et');
  const st = getComputedStyle(k);
  const fok = [...document.querySelectorAll('a[href],button,input:not([type=hidden]),textarea')]
    .filter(el => { const c = getComputedStyle(el); return c.visibility !== 'hidden' && c.display !== 'none'; });
  return JSON.stringify({ sicht: st.visibility, drin: fok.includes(k), anzahl: fok.length });
})()`));
pruefe('eingeklappt sind die Etiketten wirklich versteckt, nicht nur blass',
  zu.sicht === 'hidden', 'visibility=' + zu.sicht);
pruefe('…und damit aus der Tabfolge heraus',
  !zu.drin, zu.anzahl + ' fokussierbar (vorher ' + d.fokussierbar + ')');

/* ---------- Türchen ----------
   Bewusst mit einem SELBST angelegten Türchen statt mit einem aus dem
   Inhalt: Zum Zeitpunkt dieser Prüfung trägt kein einziges Türchen der
   Seite Vorschautext (alle data-titel/data-text sind leer) -- die Prüfung
   liefe also ins Leere und wäre still grün, ohne irgendetwas zu belegen.
   Mit einem eigenen Türchen prüft sie das Verhalten, nicht den Inhalt. */
const tuer = JSON.parse(await s.werte(`(() => {
  const p = document.createElement('p');
  p.innerHTML = '<a class="mm-tuer" href="/welt/probe" ' +
    'data-titel="Ein Titel" data-text="Ein Vorschautext">Probe</a>';
  document.querySelector('#brief').appendChild(p);
  window.mmTueren(p);
  const a = p.querySelector('a');
  const kasten = document.getElementById('mm-vorschau-kasten');

  a.dispatchEvent(new MouseEvent('mouseenter'));
  const beiMaus = !kasten.hidden;
  a.dispatchEvent(new MouseEvent('mouseleave'));

  a.dispatchEvent(new FocusEvent('focus'));
  const beiFokus = !kasten.hidden;
  const inhalt = kasten.textContent;
  a.dispatchEvent(new FocusEvent('blur'));
  const danachZu = kasten.hidden;

  p.remove();
  return JSON.stringify({ beiMaus, beiFokus, danachZu, inhalt });
})()`));

pruefe('ein Türchen zeigt seine Vorschau beim Überfahren mit der Maus', tuer.beiMaus);
/* Vorher hing die Vorschau NUR an mouseenter. Auf dem Handy gibt es keinen
   Mauszeiger -- dort bekam sie also kein Besucher je zu Gesicht. */
pruefe('…und genauso bei Tastatur-Fokus', tuer.beiFokus);
pruefe('…mit demselben Inhalt', tuer.inhalt.includes('Ein Titel') && tuer.inhalt.includes('Ein Vorschautext'),
  tuer.inhalt);
pruefe('…und nimmt sie beim Verlassen wieder zurück', tuer.danachZu);

const jsF = s.fehlerAufSeite();
pruefe('keine JavaScript-Fehler auf dem Brief', jsF.length === 0, jsF.join(' | '));

await s.zu(); chrome.beenden(); server.beenden();

/* ---------- Ohne JavaScript ----------
   Der Brief kommt aus der Datenbank. Ist JavaScript ganz abgeschaltet,
   bleibt die Seite leer -- kein Wort, keine Erklaerung, kein Ausweg. Die
   Absicherung im Projekt schuetzt bisher nur gegen Skripte, die ABBRECHEN,
   nicht gegen Skripte, die gar nicht erst laufen duerfen.

   Hier wird der rohe Quelltext geprueft, nicht das Dokument im Browser:
   im Browser ist JavaScript ja an, und dann ist <noscript> unsichtbar. */
{
  const { readFile } = await import('node:fs/promises');
  const HOCHL = new URL('../HOCHLADEN/', import.meta.url);
  for (const name of ['index.html', 'welt.html']) {
    const roh = await readFile(new URL('./' + name, HOCHL), 'utf8');
    const block = (roh.match(/<noscript>([\s\S]*?)<\/noscript>/) || [])[1] || '';
    pruefe(`${name}: sagt ohne JavaScript wenigstens, was los ist`,
      block.length > 0, block ? block.replace(/\s+/g, ' ').trim().slice(0, 50) : 'kein <noscript>');
    pruefe(`${name}: …und laesst einen Weg offen`,
      block.includes('mailto:'), block.includes('mailto:') ? 'mailto vorhanden' : 'keine Adresse');
  }
}

bericht();
