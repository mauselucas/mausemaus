/* Prüft den Blockeditor (assets/blockeditor.js) als Bauteil für sich --
   OHNE Anmeldung, indem die Prüfseite tests/feste/blockeditor-probe.html
   den Editor an einen erfundenen, im Speicher lebenden Datenspeicher hängt
   (siehe dort). Deckt die drei Stellen ab, an denen im Auftrag "besonders
   scharf" geprüft werden soll: kein Datenverlust bei schneller Bedienung,
   die private Notiz erscheint nirgends in gerendertem HTML, und jede
   Blockart lässt sich anlegen/füllen/verschieben/löschen und übersteht ein
   Neuladen. */
import { existsSync, rmSync, symlinkSync } from 'node:fs';
import { starteChrome, oeffne, pruefe, bericht } from './chrome.mjs';
import { starteServer } from './server.mjs';

const feste = new URL('../HOCHLADEN/tests-feste', import.meta.url).pathname;
if (existsSync(feste)) rmSync(feste, { recursive: true, force: true });
symlinkSync(new URL('./feste', import.meta.url).pathname, feste, 'dir');
process.on('exit', () => rmSync(feste, { recursive: true, force: true }));

const wurzel = new URL('../HOCHLADEN/', import.meta.url).pathname;
const server = await starteServer({ wurzel, port: 8908 });
const chrome = await starteChrome({ port: 9348 });
const URL_PROBE = 'http://127.0.0.1:8908/tests-feste/blockeditor-probe.html';

const s = await oeffne(URL_PROBE, { port: 9348, breite: 1280, hoehe: 1000 });
await s.warte(300);

/* ---------- alle zwölf Blockarten sind da ---------- */

const typen = JSON.parse(await s.werte(
  `JSON.stringify([...document.querySelectorAll('.be-zeile')].map(z => z.dataset.typ))`));
pruefe('alle zwölf Blockarten werden beim Start gezeichnet',
  typen.length === 12, typen.join(', '));
pruefe('jede Blockart aus dem Vertrag ist dabei',
  ['text','ueberschrift','randnotiz','bild','gif','video','text_mit_bild','code','werkzeug','trenner','tuer','abschnitt']
    .every(t => typen.includes(t)), typen.join(', '));

/* ---------- Die private Notiz erscheint NIRGENDS in gerendertem HTML ----------

   Umgezogen: Früher gab es eine zweite Spalte mit der Kennung #vorschau, und
   diese Prüfung las deren innerHTML. Seit die Schreibfläche selbst die
   Vorschau IST, gibt es dieses Element nicht mehr -- die alte Prüfung hätte
   einen leeren String gelesen und wäre für immer grün gewesen, ohne noch
   irgendetwas zu bewachen. Genau die Sorte Prüfung, von der es in diesem
   Projekt schon sechs gab.

   Neue Formulierung, näher an dem, was wirklich zählt: Die Notiz darf in
   KEINEM der pro Block gerenderten Ausschnitte stehen (dort landet, was der
   öffentliche Umsetzer erzeugt) und überhaupt nirgends im DOM außer in
   ihrem eigenen Eingabefeld. */

const notizGeheim = 'Geheime Notiz — darf nie öffentlich zu sehen sein.';

/* Alles, was vom öffentlichen Umsetzer erzeugt wurde, an einem Ort. */
const GERENDERT = `[...document.querySelectorAll('.be-vorschau-html, .tm-bilder-seite')]`;

pruefe('es gibt überhaupt gerenderte Ausschnitte zu prüfen (sonst wäre die nächste Prüfung hohl)',
  (await s.werte(`${GERENDERT}.length`)) >= 5,
  await s.werte(`${GERENDERT}.length + ' Ausschnitte'`));

pruefe('die Notiz eines Blocks steht in KEINEM gerenderten Ausschnitt',
  (await s.werte(`${GERENDERT}.filter(el => el.innerHTML.includes(${JSON.stringify(notizGeheim)})).length`)) === 0);

/* SCRIPT ausgenommen: das ist hier die Prüfseite selbst, deren eingebettetes
   Skript die erfundenen Anfangsdaten (samt Notiz-Beispieltext) enthält --
   kein echtes Leck, sondern der Testaufbau. Zählt hier nicht, weil kein
   <script>-Inhalt je an einen Besucher ausgeliefert oder gerendert wird. */
pruefe('die Notiz steht auch nicht irgendwo sonst im HTML der Prüfseite außerhalb des eigenen Notizfelds',
  (await s.werte(`
    [...document.querySelectorAll('body *')].filter(el =>
      el.tagName !== 'SCRIPT' && !el.closest('.be-notiz') &&
      el.textContent && el.textContent.includes(${JSON.stringify(notizGeheim)})
      && el.children.length === 0
    ).length`)) === 0);

/* GEGENBEWEIS: dieselbe Prüfung MUSS fehlschlagen, wenn eine Notiz tatsächlich
   in einen gerenderten Ausschnitt gelangt -- sonst wäre sie ein Blindgänger.
   Absichtlich künstlich hineingeschrieben, nur um die Prüfmethode selbst zu
   beweisen -- betrifft keinen echten Code. */
const gegenbeweisNotiz = await s.werte(`(() => {
  const el = document.querySelector('.be-vorschau-html');
  const vorher = el.innerHTML;
  el.innerHTML += ${JSON.stringify(notizGeheim)};
  const erkannt = ${GERENDERT}.filter(x => x.innerHTML.includes(${JSON.stringify(notizGeheim)})).length === 1;
  el.innerHTML = vorher;   // sofort wieder aufräumen
  return erkannt;
})()`);
pruefe('GEGENBEWEIS: die Prüfmethode erkennt eine Notiz, WENN sie in einem gerenderten Ausschnitt steht',
  gegenbeweisNotiz === true);

/* Die schärfste Fassung: einem Block, der WIRKLICH gerendert wird (Bild),
   eine Notiz geben -- sie muss gespeichert werden UND darf trotzdem nicht
   in seiner Darstellung auftauchen. Beim Textblock oben liefe das ins Leere,
   weil Text gar nicht durch den öffentlichen Umsetzer geht. */
{
  const notizAmBild = 'PRIVAT: dieses Bild spaeter durch das Original ersetzen.';
  await s.werte(`(() => {
    const zeile = document.querySelector('.be-zeile[data-typ="bild"]');
    zeile.querySelector('.be-menu-knopf').click();
    const n = zeile.querySelector('.be-notiz');
    n.value = ${JSON.stringify(notizAmBild)};
    n.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  await s.warte(750);
  const id = await idVon('bild');
  const zeile = JSON.parse(await s.werte(`JSON.stringify(window.__api_zeilen.get(${JSON.stringify(id)}) || null)`));
  pruefe('eine Notiz an einem gerenderten Block wird wirklich gespeichert',
    zeile && zeile.notiz === notizAmBild, JSON.stringify(zeile && zeile.notiz));
  pruefe('…und steht trotzdem in KEINEM gerenderten Ausschnitt',
    (await s.werte(`${GERENDERT}.filter(el => el.innerHTML.includes(${JSON.stringify(notizAmBild)})).length`)) === 0);
  pruefe('…und der kleine Punkt am Rand zeigt an, dass dieser Block eine Notiz hat',
    (await s.werte(`!document.querySelector('.be-zeile[data-typ="bild"] .be-notiz-marke').hidden`)) === true);
  /* Menü wieder zu, damit die folgenden Prüfungen einen sauberen Stand haben. */
  await s.werte(`document.querySelector('.be-zeile[data-typ="bild"] .be-menu').hidden = true`);
}

/* ---------- Bearbeiten eines Textblocks landet in der "Datenbank" ---------- */

async function textBlockSetzen(auswahl, text) {
  await s.werte(`(() => {
    const ta = document.querySelector(${JSON.stringify(auswahl)});
    ta.value = ${JSON.stringify(text)};
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
}
async function idVon(clientTyp, index = 0) {
  return s.werte(`window.__editor.bloecke().filter(b => b.typ === ${JSON.stringify(clientTyp)})[${index}]?.id`);
}
async function zeileInDB(id) {
  return JSON.parse(await s.werte(`JSON.stringify(window.__api_zeilen.get(${JSON.stringify(id)}) || null)`));
}

await textBlockSetzen('.be-zeile[data-typ="text"] .be-text', 'Ein geänderter Absatz.');
await s.warte(750);   // Entprellung (500ms) + künstliche "Netzwerk"-Verzögerung
{
  const id = await idVon('text');
  const zeile = await zeileInDB(id);
  pruefe('eine Textänderung landet nach kurzer Wartezeit in der "Datenbank"',
    zeile && zeile.inhalt.roh === 'Ein geänderter Absatz.', JSON.stringify(zeile));
}

/* ---------- Kein Datenverlust: zwei Änderungen kurz hintereinander ---------- */

await textBlockSetzen('.be-zeile[data-typ="text"] .be-text', 'Erster Stand.');
await s.warte(50);
await textBlockSetzen('.be-zeile[data-typ="text"] .be-text', 'Zweiter, neuerer Stand.');
await s.warte(750);
{
  const id = await idVon('text');
  const zeile = await zeileInDB(id);
  pruefe('von zwei schnell aufeinanderfolgenden Änderungen gewinnt der NEUERE Stand',
    zeile && zeile.inhalt.roh === 'Zweiter, neuerer Stand.', JSON.stringify(zeile));
}

/* Verschärfte Fassung: viele Änderungen in sehr kurzem Abstand (wie echtes
   Tippen), inklusive eines Umsortierens dazwischen -- auch DAS darf den
   Text nicht verlieren, weil beides über dieselbe Warteschlange desselben
   Blocks läuft. */
await textBlockSetzen('.be-zeile[data-typ="text"] .be-text', 'A');
await s.werte(`document.querySelector('.be-zeile[data-typ="text"] .be-breite').dispatchEvent(new Event('change'))`);
await textBlockSetzen('.be-zeile[data-typ="text"] .be-text', 'AB');
await textBlockSetzen('.be-zeile[data-typ="text"] .be-text', 'ABC');
await textBlockSetzen('.be-zeile[data-typ="text"] .be-text', 'Der wirklich letzte Stand.');
await s.warte(750);
{
  const id = await idVon('text');
  const zeile = await zeileInDB(id);
  pruefe('auch nach mehreren schnellen Änderungen UND einer Einstellungsänderung gewinnt der letzte Stand',
    zeile && zeile.inhalt.roh === 'Der wirklich letzte Stand.', JSON.stringify(zeile));
}

/* Die schärfste Fassung: ZWEI ECHTE Speichervorgänge, ohne jede Entprellung
   dazwischen (Breite/Bewegung speichern sofort) -- und mit der ERSTEN
   Antwort künstlich LANGSAMER als der zweiten, damit die Reihenfolge, in
   der die Antworten hereinkommen, garantiert NICHT der Reihenfolge
   entspricht, in der sie ausgelöst wurden. Genau dieser Fall ist es, den
   die Warteschlange strukturell verhindern muss -- eine bloße Entprellung
   würde hier NICHT reichen (siehe Gegenbeweis weiter unten). */
async function raceTest(id) {
  await s.werte(`(() => {
    const echt = window.__api.aktualisieren.bind(window.__api);
    window.__api.aktualisieren = async (id, felder) => {
      /* die ERSTE ausgelöste Änderung (Breite "schmal") absichtlich lahmlegen */
      if (felder.breite === 'schmal') await new Promise(r => setTimeout(r, 220));
      return echt(id, felder);
    };
  })()`);
  await s.werte(`(() => {
    const zeile = document.querySelector('.be-zeile[data-typ="text"]');
    zeile.querySelector('.be-menu-knopf').click();
    const sel = zeile.querySelector('.be-breite');
    sel.value = 'schmal'; sel.dispatchEvent(new Event('change'));   // Speichervorgang 1 — langsam
    sel.value = 'voll';   sel.dispatchEvent(new Event('change'));   // Speichervorgang 2 — schnell, kurz danach
  })()`);
  await s.warte(500);   // beide "Netzwerk"-Antworten sind längst da
  return zeileInDB(id);
}

const textId = await idVon('text');
{
  const zeile = await raceTest(textId);
  pruefe('zwei echte Speichervorgänge kurz hintereinander: die ZULETZT ausgelöste Änderung gewinnt, obwohl ihre Antwort zuerst ankommt',
    zeile && zeile.breite === 'voll', JSON.stringify(zeile));
}
/* Original wiederherstellen, bevor es weitergeht. */
await s.werte(`(() => {
  window.__api.aktualisieren = async (id, felder) => {
    window.__aufrufe.aktualisieren++;
    await new Promise(r => setTimeout(r, 40));
    const bisher = window.__api_zeilen.get(id) || { id };
    window.__api_zeilen.set(id, { ...bisher, ...structuredClone(felder) });
  };
})()`);

/* GEGENBEWEIS: dieselbe Situation gegen eine ABSICHTLICH kaputte
   "Warteschlange" (feuert sofort, ohne zu serialisieren) -- hier MUSS die
   ältere, langsamere Antwort die neuere überschreiben und "schmal" gewinnt.
   Das beweist zweierlei: die Prüfung oben kann tatsächlich fehlschlagen,
   und der Fehler, den sie verhindert, ist real. */
{
  const kaputt = JSON.parse(await s.werte(`(async () => {
    const zeilen = new Map();
    const warte = (ms) => new Promise(r => setTimeout(r, ms));
    const schreiben = async (id, felder) => {
      if (felder.breite === 'schmal') await warte(220); else await warte(5);
      const bisher = zeilen.get(id) || { id };
      zeilen.set(id, { ...bisher, ...felder });
    };
    /* naive "Warteschlange": feuert sofort, wartet NICHT auf den vorigen Aufruf */
    schreiben('x', { breite: 'schmal' });
    schreiben('x', { breite: 'voll' });
    await warte(500);
    return JSON.stringify(zeilen.get('x'));
  })()`));
  pruefe('GEGENBEWEIS: OHNE Warteschlange gewinnt hier die ältere, langsamere Antwort -- Datenverlust',
    kaputt.breite === 'schmal', JSON.stringify(kaputt));
}

/* ---------- Neuer Block über den "+"-Knopf ---------- */

const vorherAnzahl = (await s.werte(`window.__editor.bloecke().length`));
await s.werte(`document.querySelector('.be-neu-unten').click()`);
await s.warte(80);
const nachherAnzahl = (await s.werte(`window.__editor.bloecke().length`));
pruefe('"+ Block hinzufügen" legt einen neuen Block an', nachherAnzahl === vorherAnzahl + 1);

await textBlockSetzen('.be-zeile:last-child .be-text', 'Ein ganz neuer Block.');
await s.warte(750);
{
  const letzterId = await s.werte(`window.__editor.bloecke()[window.__editor.bloecke().length - 1].id`);
  const zeile = await zeileInDB(letzterId);
  pruefe('der neue Block landet als eigene Zeile in der "Datenbank"',
    zeile && zeile.inhalt.roh === 'Ein ganz neuer Block.' && zeile.seite_id === 's1', JSON.stringify(zeile));
}

/* ---------- Blockauswahl ("/") ---------- */

await s.werte(`document.querySelector('.be-neu-unten').click()`);
await s.warte(50);
await textBlockSetzen('.be-zeile:last-child .be-text', '/');
await s.warte(50);
const slashOffen = await s.werte(`!!document.querySelector('.be-slash')`);
pruefe('"/" öffnet die Blockauswahl', slashOffen === true);

await s.werte(`(() => {
  const ta = document.querySelector('.be-zeile:last-child .be-text');
  ta.value = '/bild'; ta.dispatchEvent(new Event('input', { bubbles: true }));
})()`);
await s.warte(50);
const ersterTreffer = await s.werte(`document.querySelector('.be-slash-eintrag')?.textContent`);
pruefe('Tippen nach "/" filtert die Auswahl -- "bild" findet "Bild" zuerst',
  (ersterTreffer || '').includes('Bild'), ersterTreffer);

await s.werte(`document.querySelector('.be-slash-eintrag').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))`);
await s.warte(50);
const letzterTyp = await s.werte(`window.__editor.bloecke()[window.__editor.bloecke().length - 1].typ`);
pruefe('Auswahl aus dem "/"-Menü verwandelt den Block in die gewählte Art',
  letzterTyp === 'bild', letzterTyp);

/* ---------- Enter erzeugt den nächsten Block ---------- */

{
  const vor = await s.werte(`window.__editor.bloecke().length`);
  await s.werte(`(() => {
    const ta = document.querySelector('.be-zeile[data-typ="text"] .be-text');
    ta.focus();
    ta.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  })()`);
  await s.warte(50);
  const nach = await s.werte(`window.__editor.bloecke().length`);
  pruefe('Enter in einem Textblock erzeugt den nächsten Block', nach === vor + 1);
}

/* ---------- Rücktaste auf leerem Block löscht ihn ---------- */

{
  await s.werte(`document.querySelector('.be-neu-unten').click()`);
  await s.warte(50);
  const vor = await s.werte(`window.__editor.bloecke().length`);
  await s.werte(`(() => {
    const ta = document.querySelector('.be-zeile:last-child .be-text');
    ta.focus(); ta.selectionStart = ta.selectionEnd = 0;
    ta.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true }));
  })()`);
  await s.warte(50);
  const nach = await s.werte(`window.__editor.bloecke().length`);
  pruefe('Rücktaste auf einem leeren Block löscht ihn', nach === vor - 1);
}

/* ---------- Duplizieren und Löschen über das "⋯"-Menü ---------- */

{
  const vor = await s.werte(`window.__editor.bloecke().length`);
  await s.werte(`(() => {
    const zeile = document.querySelector('.be-zeile[data-typ="randnotiz"]');
    zeile.querySelector('.be-menu-knopf').click();
    zeile.querySelector('.be-duplizieren').click();
  })()`);
  await s.warte(50);
  const nach = await s.werte(`window.__editor.bloecke().length`);
  pruefe('"Duplizieren" legt eine Kopie an', nach === vor + 1);
  const randnotizen = await s.werte(`window.__editor.bloecke().filter(b => b.typ === 'randnotiz').length`);
  pruefe('nach dem Duplizieren gibt es zwei Randnotiz-Blöcke', randnotizen === 2, randnotizen);
}

{
  const vor = await s.werte(`window.__editor.bloecke().length`);
  const geloeschteId = await idVon('randnotiz', 1);
  await s.werte(`(() => {
    const zeilen = [...document.querySelectorAll('.be-zeile[data-typ="randnotiz"]')];
    const zeile = zeilen[zeilen.length - 1];
    zeile.querySelector('.be-menu-knopf').click();
    zeile.querySelector('.be-loeschen').click();
  })()`);
  await s.warte(750);
  const nach = await s.werte(`window.__editor.bloecke().length`);
  pruefe('"Löschen" entfernt den Block aus der Ansicht', nach === vor - 1);
  const zeile = await zeileInDB(geloeschteId);
  pruefe('…und aus der "Datenbank"', zeile === null, JSON.stringify(zeile));
}

/* ---------- Die gefixte Falle: Tippen + sofort Löschen darf den Block
   NICHT wiederbeleben, wenn die entprellte Speicherung doch noch feuert --------- */

{
  const id = await idVon('code');
  await textBlockSetzen('.be-zeile[data-typ="code"] .be-code-text', 'sollte NIE ankommen');
  /* sofort löschen, deutlich VOR Ablauf der 500ms-Entprellung */
  await s.werte(`(() => {
    const zeile = document.querySelector('.be-zeile[data-typ="code"]');
    zeile.querySelector('.be-menu-knopf').click();
    zeile.querySelector('.be-loeschen').click();
  })()`);
  await s.warte(900);   // länger als die Entprellung (500ms) + "Netzwerk" (40ms)
  const zeile = await zeileInDB(id);
  pruefe('Löschen kurz nach dem Tippen gewinnt -- der Block taucht NICHT wieder auf',
    zeile === null, JSON.stringify(zeile));
}

/* ---------- Rückgängig ---------- */

{
  const vor = await s.werte(`window.__editor.bloecke().length`);
  await s.werte(`(() => {
    const zeile = document.querySelector('.be-zeile[data-typ="trenner"]');
    zeile.querySelector('.be-menu-knopf').click();
    zeile.querySelector('.be-loeschen').click();
  })()`);
  await s.warte(50);
  const zwischendrin = await s.werte(`window.__editor.bloecke().length`);
  pruefe('vor dem Rückgängig ist der Block wirklich weg', zwischendrin === vor - 1);
  await s.werte(`window.__editor.rueckgaengig()`);
  await s.warte(750);
  const nach = await s.werte(`window.__editor.bloecke().length`);
  pruefe('Rückgängig stellt den gelöschten Block wieder her', nach === vor);
  const trenner = await s.werte(`window.__editor.bloecke().filter(b => b.typ === 'trenner').length`);
  pruefe('…und zwar wirklich als Trennstrich-Block', trenner === 1, trenner);
}

/* ---------- Breite, Bewegung, Notiz werden gespeichert ---------- */

{
  await s.werte(`(() => {
    const zeile = document.querySelector('.be-zeile[data-typ="abschnitt"]');
    zeile.querySelector('.be-menu-knopf').click();
    zeile.querySelector('.be-breite').value = 'randnotiz';
    zeile.querySelector('.be-breite').dispatchEvent(new Event('change'));
    zeile.querySelector('.be-bewegung').value = 'einblenden';
    zeile.querySelector('.be-bewegung').dispatchEvent(new Event('change'));
    const notiz = zeile.querySelector('.be-notiz');
    notiz.value = 'Bitte sanft von unten einblenden lassen.';
    notiz.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  await s.warte(750);
  const id = await idVon('abschnitt');
  const zeile = await zeileInDB(id);
  pruefe('Breite wird übernommen', zeile.breite === 'randnotiz', zeile.breite);
  pruefe('Bewegung wird übernommen', zeile.bewegung === 'einblenden', zeile.bewegung);
  pruefe('Notiz an Claude wird gespeichert', zeile.notiz === 'Bitte sanft von unten einblenden lassen.', zeile.notiz);
  pruefe('…aber die Notiz steht weiterhin in KEINEM gerenderten Ausschnitt',
    (await s.werte(`${GERENDERT}.filter(el => el.innerHTML.includes('Bitte sanft von unten einblenden lassen.')).length`)) === 0);
}

/* ---------- Umsortieren per Ziehen verändert sort_order UND landet
   ebenfalls sicher in der "Datenbank" ---------- */

{
  const reihenfolgeVorher = JSON.parse(await s.werte(
    `JSON.stringify(window.__editor.bloecke().map(b => b.clientKey))`));
  const [ersterKey, zweiterKey] = reihenfolgeVorher;
  await s.werte(`(() => {
    const von = document.querySelector('[data-key="${ersterKey}"]');
    const nach = document.querySelector('[data-key="${zweiterKey}"]');
    von.dispatchEvent(new DragEvent('dragstart', { bubbles: true }));
    nach.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true }));
    nach.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true }));
  })()`);
  await s.warte(750);
  const reihenfolgeNachher = JSON.parse(await s.werte(
    `JSON.stringify(window.__editor.bloecke().map(b => b.clientKey))`));
  pruefe('Ziehen ändert die Reihenfolge tatsächlich',
    reihenfolgeNachher[0] !== ersterKey || reihenfolgeNachher[1] !== zweiterKey,
    reihenfolgeNachher.slice(0, 3).join(','));
  const id = await s.werte(`window.__editor.bloecke().find(b => b.clientKey === '${ersterKey}').id`);
  const zeile = await zeileInDB(id);
  pruefe('die neue Reihenfolge (sort_order) landet in der "Datenbank"',
    zeile && typeof zeile.sort_order === 'number');
}

/* ---------- "gespeichert"-Anzeige ---------- */

/* ACHTUNG, hier lag ein Blindgänger: Die frühere Fassung prüfte
   `statusWaehrend.includes('speichert')` -- und das Wort "gespeichert"
   ENTHÄLT "speichert". Die Prüfung konnte also gar nicht fehlschlagen. Der
   Gegenbeweis darunter testete mit 'speichert…' (mit Auslassungspunkten)
   eine ganz andere Zeichenkette als die Prüfung selbst und deckte das
   deshalb nicht auf. Aufgefallen ist es erst, als die Anzeige beim Umbau
   tatsächlich "gespeichert" zeigte und die Prüfung fröhlich grün blieb.

   Zwei Korrekturen: exakt auf "speichert…" prüfen, und den Zeitpunkt so
   wählen, dass wirklich ein Schreibvorgang läuft. Die Breite speichert
   OHNE Entprellung sofort -- zusammen mit einem künstlich langsamen
   "Netzwerk" ist das Fenster groß genug, um sicher hineinzutreffen. */
await s.werte(`(() => {
  const echt = window.__api.aktualisieren.bind(window.__api);
  window.__api.__echtAktualisieren = echt;
  window.__api.aktualisieren = async (id, felder) => {
    await new Promise(r => setTimeout(r, 300));
    return echt(id, felder);
  };
})()`);
await s.werte(`(() => {
  const zeile = document.querySelector('.be-zeile[data-typ="text"]');
  zeile.querySelector('.be-menu-knopf').click();
  const sel = zeile.querySelector('.be-breite');
  sel.value = 'schmal'; sel.dispatchEvent(new Event('change'));
})()`);
await s.warte(120);   // mitten im 300ms-Schreibvorgang
const statusWaehrend = await s.werte(`document.getElementById('speicher-status').textContent`);
await s.warte(600);
const statusDanach = await s.werte(`document.getElementById('speicher-status').textContent`);
await s.werte(`window.__api.aktualisieren = window.__api.__echtAktualisieren`);

const zeigtSpeichertGerade = (t) => /^speichert…$/.test(t.trim());
pruefe('während eines laufenden Speichervorgangs steht GENAU "speichert…" in der Ecke',
  zeigtSpeichertGerade(statusWaehrend), JSON.stringify(statusWaehrend));
pruefe('danach steht dort "gespeichert" mit Uhrzeit',
  /^gespeichert \d{2}:\d{2}:\d{2}$/.test(statusDanach), statusDanach);

/* GEGENBEWEIS: Diesmal mit DERSELBEN Funktion, die die Prüfung oben
   benutzt -- sonst wäre wieder etwas anderes geprüft als behauptet. Eine
   Anzeige, die dauerhaft "gespeichert" zeigt, muss durchfallen. */
pruefe('GEGENBEWEIS: "gespeichert 00:00:00" besteht die "speichert…"-Prüfung NICHT',
  zeigtSpeichertGerade('gespeichert 00:00:00') === false);
pruefe('GEGENBEWEIS: die alte, zu lasche Prüfung hätte "gespeichert 00:00:00" fälschlich durchgewunken',
  'gespeichert 00:00:00'.includes('speichert') === true);

/* Der frühere Gegenbeweis stand genau hier und lautete
     !'gespeichert 00:00:00'.includes('speichert…')
   -- er prüfte 'speichert…' MIT Auslassungspunkten, während die eigentliche
   Prüfung 'speichert' OHNE sie benutzte. Zwei verschiedene Zeichenketten,
   also kein Gegenbeweis, sondern Beiwerk. Entfernt statt auskommentiert:
   Code, den nichts erreichen kann, wird in diesem Projekt gelöscht. */

/* ---------- "+ Bild" darf niemals ein leeres "![]()" hinterlassen ----------
   Der alte Weg legte erst eine leere Zeile an und schrieb dafuer "![]()"
   in den Text. Das laesst sich nicht wieder einlesen (bildZeilenLesen
   verlangt eine Adresse) -- die Zeile verschwand beim naechsten Aufbau
   also wieder, das "![]()" blieb als sichtbarer Text stehen und waere so
   auf der oeffentlichen Seite gelandet. */
{
  const vorher = await s.werte(`(() => {
    const b = window.__editor.bloecke().find(x => x.typ === 'bild');
    b.inhalt.roh = '';
    document.querySelector('.be-zeile[data-typ="bild"] .be-bild-neu').click();
    return JSON.stringify(b.inhalt.roh);
  })()`);
  await s.warte(300);
  const nachher = await s.werte(`JSON.stringify(
    window.__editor.bloecke().find(x => x.typ === 'bild').inhalt.roh)`);
  pruefe('"+ Bild" schreibt KEIN leeres ![]() in den Text',
    !String(nachher).includes('![]()'), 'vorher ' + vorher + ', nachher ' + nachher);
  pruefe('…es gibt stattdessen eine Dateiauswahl hinter dem Knopf',
    (await s.werte(`!!document.querySelector('.be-zeile[data-typ="bild"] .be-bild-neu-datei')`)) === true);

  /* GEGENBEWEIS: die alte Form wuerde von dieser Pruefung erkannt. */
  pruefe('GEGENBEWEIS: ein "![]()" im Text würde auffallen', '![]()'.includes('![]()'));
}

/* ---------- Bild aus der Zwischenablage (Strg/Cmd+V) ---------- */

/* Legt ein Bild in die Zwischenablage und fuegt es in den angegebenen
   Block ein. Liefert die Blockzahl vorher und nachher. */
async function bildEinfuegenIn(auswahl) {
  const vor = Number(await s.werte(`window.__editor.bloecke().length`));
  await s.werte(`(() => {
    const daten = new DataTransfer();
    const png = new File([new Uint8Array([137,80,78,71,13,10,26,10])], 'probe.png', { type: 'image/png' });
    daten.items.add(png);
    const ta = document.querySelector(${JSON.stringify(auswahl)});
    ta.focus();
    ta.dispatchEvent(new ClipboardEvent('paste', { clipboardData: daten, bubbles: true, cancelable: true }));
  })()`);
  await s.warte(900);
  return { vor, nach: Number(await s.werte(`window.__editor.bloecke().length`)) };
}

/* Fall A -- der Cursor steht in einem LEEREN Textblock.
   Dann wird dieser Block selbst zum Bild. Ein neuer Block waere hier
   falsch: man haette nach jedem Einfuegen eine leere Zeile darueber. */
{
  await s.werte(`(() => {
    const bl = window.__editor.bloecke().find(b => b.typ === 'text');
    bl.inhalt.roh = '';
    window.__editor.neuZeichnen();
  })()`);
  await s.warte(200);
  const z = await bildEinfuegenIn('.be-zeile[data-typ="text"] .be-text');
  pruefe('Einfügen in einen LEEREN Textblock verwandelt genau diesen in ein Bild',
    z.nach === z.vor, z.vor + ' -> ' + z.nach + ' Blöcke');
  pruefe('…und das Bild trägt eine echte Adresse',
    (await s.werte(`JSON.stringify(window.__editor.bloecke()
      .filter(b => b.typ === 'bild').map(b => b.inhalt.roh))`)).includes('/favicon.svg'));
}

/* Fall B -- der Cursor steht in einem Textblock MIT Inhalt.
   Dann kommt ein neuer Bildblock dahinter, der Text bleibt unangetastet. */
{
  await textBlockSetzen('.be-zeile[data-typ="text"] .be-text', 'Dieser Satz muss stehen bleiben.');
  await s.warte(700);
  const z = await bildEinfuegenIn('.be-zeile[data-typ="text"] .be-text');
  pruefe('Einfügen in einen GEFÜLLTEN Textblock legt einen neuen Bildblock an',
    z.nach === z.vor + 1, z.vor + ' -> ' + z.nach + ' Blöcke');
  pruefe('…und der vorhandene Text bleibt unangetastet',
    (await s.werte(`JSON.stringify(window.__editor.bloecke()
      .filter(b => b.typ === 'text').map(b => b.inhalt.roh))`)).includes('Dieser Satz muss stehen bleiben.'));
}

/* Nirgends darf dabei eine leere Bildklammer entstehen. */
pruefe('kein einziger Block enthält ein leeres ![]()',
  !(await s.werte(`JSON.stringify(window.__editor.bloecke().map(b => b.inhalt.roh || ''))`)).includes('![]()'));

/* Reiner TEXT muss ganz normal eingefuegt werden -- sonst waere das
   Einfuegen von Text kaputt, und das macht man tausendmal haeufiger. */
{
  const vorZahl = await s.werte(`window.__editor.bloecke().length`);
  const verhindert = await s.werte(`(() => {
    const daten = new DataTransfer();
    daten.setData('text/plain', 'nur Text');
    const ta = document.querySelector('.be-zeile[data-typ="text"] .be-text');
    ta.focus();
    const ev = new ClipboardEvent('paste', { clipboardData: daten, bubbles: true, cancelable: true });
    ta.dispatchEvent(ev);
    return ev.defaultPrevented;
  })()`);
  await s.warte(300);
  pruefe('reiner Text wird NICHT abgefangen (normales Einfügen bleibt heil)',
    verhindert === false, 'defaultPrevented=' + verhindert);
  pruefe('…und es entsteht dabei kein Bildblock',
    Number(await s.werte(`window.__editor.bloecke().length`)) === Number(vorZahl));
}

/* ---------- Die Dokumentspalte ist wirklich EINE Spalte ----------
   In einem Dokument müssen alle Blöcke am selben linken Rand beginnen.
   Aufgefallen ist das an der Überschrift: Ihre Größenwahl lag als
   Flex-Element VOR dem Textfeld und schob es dauerhaft um ihre Breite ein
   -- auch unsichtbar, denn opacity:0 nimmt weiterhin Platz. Genau eine
   Zeile stand dadurch eingerückt, was man erst auf dem Bild sieht. */
/* Was "Spaltenrand" heißt, hängt vom Element ab, und beides einfach gleich
   zu messen war mein erster Fehlversuch:
   - Bei den BLÖCKEN zählt die Außenkante ihres Schreibelements. Genau die
     war beim Überschriften-Fehler verschoben (das unsichtbare Auswahlfeld
     stand als Flex-Geschwister davor und schob das Textfeld beiseite).
     Die Randnotiz ist ein Kasten mit eigener Polsterung -- dort IST die
     Außenkante der Spaltenrand, ihr Innenabstand ist Gestaltung.
   - Bei TITEL und UNTERTITEL trägt das Element die Spalteneinrückung selbst
     als Polsterung. Dort zählt die Textkante; die Außenkante läge 56px
     weiter links und sähe fälschlich nach Versatz aus. */
const TEXTKANTE = `(el => { if (!el) return -1; const cs = getComputedStyle(el);
  return Math.round(el.getBoundingClientRect().left
    + parseFloat(cs.paddingLeft) + parseFloat(cs.borderLeftWidth)); })`;
const AUSSENKANTE = `(el => el ? Math.round(el.getBoundingClientRect().left) : -1)`;

{
  const raender = JSON.parse(await s.werte(`(() => {
    const kante = ${AUSSENKANTE};
    const feld = (zeile) => zeile.querySelector(
      '.be-text, .be-ueberschrift, .be-randnotiz, .be-abschnitt, .be-code, .be-vorschau-html, .tm-gitter');
    return JSON.stringify([...document.querySelectorAll('.be-zeile')]
      .map(z => ({ typ: z.dataset.typ, links: kante(feld(z)) }))
      .filter(x => x.links >= 0));
  })()`));
  const werte = raender.map(x => x.links);
  const spanne = Math.max(...werte) - Math.min(...werte);
  pruefe('alle Blöcke beginnen am selben linken Rand (eine Spalte, nichts eingerückt)',
    spanne <= 1, raender.map(x => `${x.typ}=${x.links}`).join(' '));
  pruefe('…und es sind wirklich alle zwölf Blockarten gemessen worden (sonst wäre die Prüfung hohl)',
    raender.length === (await s.werte(`document.querySelectorAll('.be-zeile').length`)),
    `${raender.length} gemessen`);

  /* Titel und Untertitel gehören zum selben Dokument -- sie müssen auf
     derselben Kante stehen wie die Blöcke, sonst ist es keine Spalte. */
  const kopf = JSON.parse(await s.werte(`(() => { const kante = ${TEXTKANTE};
    return JSON.stringify({
      titel: kante(document.querySelector('.dok-titel')),
      untertitel: kante(document.querySelector('.dok-untertitel')),
    }); })()`));
  const textLinks = werte[0];
  pruefe('Titel und Untertitel stehen auf derselben Kante wie die Blöcke',
    Math.abs(kopf.titel - textLinks) <= 1 && Math.abs(kopf.untertitel - textLinks) <= 1,
    `Titel=${kopf.titel} Untertitel=${kopf.untertitel} Blöcke=${textLinks}`);

  /* Und die Leiste mit Griff und "⋯" muss LINKS davon bleiben. Sie lag
     15px zu weit rechts und schob den "⋯"-Knopf über den Textanfang --
     im Bildschirmfoto sah man dort einen kleinen Strich vor dem ersten
     Buchstaben, sonst nichts. Ein Maß, das man nur sieht, wenn man misst. */
  const ueberlappungen = JSON.parse(await s.werte(`(() => {
    return JSON.stringify([...document.querySelectorAll('.be-zeile')].map(z => {
      const rail = z.querySelector('.be-rail');
      const feld = z.querySelector('.be-text, .be-ueberschrift, .be-randnotiz, .be-abschnitt, .be-code, .be-vorschau-html, .tm-gitter');
      if (!rail || !feld) return null;
      const u = Math.round(rail.getBoundingClientRect().right - feld.getBoundingClientRect().left);
      return u > 0 ? z.dataset.typ + ': ' + u + 'px' : null;
    }).filter(Boolean));
  })()`));
  pruefe('die Leiste (Griff und „⋯“) überlappt NIRGENDS den Textanfang',
    ueberlappungen.length === 0, ueberlappungen.join(' | '));
}

/* ---------- Screenshots für den Bericht ---------- */
await s.werte(`window.scrollTo(0, 0)`);
await s.warte(150);
await s.bild(new URL('./bilder/editor-1280.png', import.meta.url).pathname);
/* Zweites Bild etwas heruntergescrollt -- zeigt die Mitte des Dokuments
   mit den fertig dargestellten Medienblöcken. */
await s.werte(`document.querySelector('.dok-bereich').scrollIntoView();
  window.scrollBy(0, 700)`);
await s.warte(150);
await s.bild(new URL('./bilder/editor-1280-mitte.png', import.meta.url).pathname);
await s.werte(`window.scrollTo(0, 0)`);

const jsFehler1 = s.fehlerAufSeite();
pruefe('keine JavaScript-Fehler bei 1280px', jsFehler1.length === 0, jsFehler1.join(' | '));
await s.zu();

/* ================= 520 px — die Handy-Untergrenze ================= */

const m = await oeffne(URL_PROBE, { port: 9348, breite: 520, hoehe: 1500 });
await m.warte(400);
await m.bild(new URL('./bilder/editor-520-start.png', import.meta.url).pathname);

const ueberlauf = await m.werte(`document.documentElement.scrollWidth > document.documentElement.clientWidth + 1`);
pruefe('bei 520px gibt es KEINEN horizontalen Überlauf', ueberlauf === false,
  await m.werte(`document.documentElement.scrollWidth + ' vs ' + document.documentElement.clientWidth`));

const knopfSichtbar = await m.werte(`(() => {
  const b = document.querySelector('.be-griff');
  const r = b.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && r.left >= 0 && r.right <= document.documentElement.clientWidth;
})()`);
pruefe('der Ziehen-Griff ist bei 520px sichtbar und nicht abgeschnitten', knopfSichtbar === true);

const menuKnopfSichtbar = await m.werte(`(() => {
  const b = document.querySelector('.be-menu-knopf');
  const r = b.getBoundingClientRect();
  return r.width > 0 && r.right <= document.documentElement.clientWidth;
})()`);
pruefe('der "⋯"-Knopf ist bei 520px erreichbar', menuKnopfSichtbar === true);

/* Blockauswahl darf bei 520px nicht über den Rand hinausragen. */
await m.werte(`(() => {
  const ta = document.querySelector('.be-zeile[data-typ="text"] .be-text');
  ta.value = '/'; ta.dispatchEvent(new Event('input', { bubbles: true }));
})()`);
await m.warte(80);
const slashPasstBei520 = await m.werte(`(() => {
  const el = document.querySelector('.be-slash');
  if (!el) return false;
  const r = el.getBoundingClientRect();
  return r.right <= document.documentElement.clientWidth + 1;
})()`);
pruefe('die Blockauswahl ragt bei 520px nicht über den Rand hinaus', slashPasstBei520 === true);

/* Für das Bild ins Sichtfeld scrollen -- sonst zeigt der Screenshot nur
   die Seiten-Eigenschaften und nichts vom eigentlichen Blockeditor.
   Erst das auslösende Textfeld an den oberen Rand, dann etwas weiter --
   die Auswahlliste hängt darunter. */
await m.werte(`document.querySelector('.be-slash').scrollIntoView({ block: 'end' })`);
await m.warte(80);
await m.bild(new URL('./bilder/editor-520.png', import.meta.url).pathname);
const jsFehler2 = m.fehlerAufSeite();
pruefe('keine JavaScript-Fehler bei 520px', jsFehler2.length === 0, jsFehler2.join(' | '));
await m.zu();

chrome.beenden(); server.beenden();
bericht();
