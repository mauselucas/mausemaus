/* Prüft den Blockeditor (assets/blockeditor.js) als Bauteil für sich --
   OHNE Anmeldung, indem die Prüfseite tests/feste/blockeditor-probe.html
   den Editor an einen erfundenen, im Speicher lebenden Datenspeicher hängt
   (siehe dort). Deckt die drei Stellen ab, an denen im Auftrag "besonders
   scharf" geprüft werden soll: kein Datenverlust bei schneller Bedienung,
   die Notiz erscheint nirgends in der Vorschau, und jede Blockart lässt
   sich anlegen/füllen/verschieben/löschen und übersteht ein Neuladen. */
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

/* ---------- Notiz erscheint NIRGENDS in der Vorschau ---------- */

const notizGeheim = 'Geheime Notiz — darf nie öffentlich zu sehen sein.';
const vorschauAnfang = await s.werte(`document.getElementById('vorschau').innerHTML`);
pruefe('die Notiz eines Blocks steht NICHT in der Vorschau',
  !vorschauAnfang.includes(notizGeheim));
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

/* GEGENBEWEIS: dieselbe Prüfung MUSS fehlschlagen, wenn die Notiz tatsächlich
   in die Vorschau gelangt -- sonst wäre die obige Prüfung ein Blindgänger.
   Absichtlich künstlich in die Vorschau geschrieben, nur um die Prüfmethode
   selbst zu beweisen -- betrifft keinen echten Code. */
const gegenbeweisNotiz = await s.werte(`(() => {
  const el = document.getElementById('vorschau');
  const vorher = el.innerHTML;
  el.innerHTML += ${JSON.stringify(notizGeheim)};
  const erkannt = el.innerHTML.includes(${JSON.stringify(notizGeheim)});
  el.innerHTML = vorher;   // sofort wieder aufräumen
  return erkannt;
})()`);
pruefe('GEGENBEWEIS: die Prüfmethode erkennt eine Notiz, WENN sie in der Vorschau steht',
  gegenbeweisNotiz === true);

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
  const vorschauJetzt = await s.werte(`document.getElementById('vorschau').innerHTML`);
  pruefe('…aber die Notiz steht weiterhin NICHT in der Vorschau',
    !vorschauJetzt.includes('Bitte sanft von unten einblenden lassen.'));
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

await textBlockSetzen('.be-zeile[data-typ="text"] .be-text', 'Für die Statusanzeige.');
await s.warte(60);
const statusWaehrend = await s.werte(`document.getElementById('speicher-status').textContent`);
await s.warte(750);
const statusDanach = await s.werte(`document.getElementById('speicher-status').textContent`);
pruefe('während des Speicherns steht "speichert…" in der Ecke',
  statusWaehrend.includes('speichert'), statusWaehrend);
pruefe('danach steht dort "gespeichert" mit Uhrzeit',
  /^gespeichert \d{2}:\d{2}:\d{2}$/.test(statusDanach), statusDanach);

/* GEGENBEWEIS: eine Anzeige, die immer "gespeichert" zeigt, bestünde die
   erste der beiden Prüfungen oben nicht -- die Prüfung ist also nicht
   blind. */
pruefe('GEGENBEWEIS: eine fest auf "gespeichert" stehende Anzeige würde an der "speichert…"-Prüfung scheitern',
  !'gespeichert 00:00:00'.includes('speichert…'));

/* ---------- Screenshots für den Bericht ---------- */
await s.werte(`window.scrollTo(0, 0)`);
await s.warte(150);
await s.bild(new URL('./bilder/editor-1280.png', import.meta.url).pathname);
/* Zweites Bild etwas heruntergescrollt -- zeigt, dass die Vorschau stehen
   bleibt, während die (oft längere) Blockliste weiterläuft. */
await s.werte(`document.querySelector('.be-spalte:not(.vorschau)').scrollIntoView();
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
