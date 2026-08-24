/* Prüft die reine Logik, die im Zuge der Fremdprüfung (2026-08-24) neu in
   block-modell.js entstanden ist: freier Slug, Fehler-Sammlung der
   Sicherung, der entprellte Auslöser mit Sofort-Speichern-beim-Schließen,
   und die Positivliste fürs Bild-Hochladen. Reine Logik, kein DOM, keine
   Anmeldung, kein Chrome -- direkt in Node lauffähig, wie die anderen
   *-editor-modell-Prüfungen. Diese Datei ist NEU (gehört nicht zu den 13
   bestehenden Prüfbereichen) und wird nur für diese Nachprüfung angelegt. */
import {
  naechsterFreierSlug, ersterFehler, erzeugeEntprellung,
  darfDurchsCanvas, endungFuerMime, endungUndArtFuerBlob,
} from '../HOCHLADEN/assets/block-modell.js';

const ergebnisse = [];
function pruefe(name, bedingung, zusatz = '') {
  ergebnisse.push({ name, ok: !!bedingung, zusatz });
  console.log(`${bedingung ? '  ok  ' : ' FEHL '} ${name}${zusatz ? '  — ' + zusatz : ''}`);
}
function bericht() {
  const schlecht = ergebnisse.filter(e => !e.ok);
  console.log(`\n${ergebnisse.length - schlecht.length} von ${ergebnisse.length} bestanden`);
  if (schlecht.length) process.exitCode = 1;
  return schlecht.length === 0;
}
const warte = (ms) => new Promise(r => setTimeout(r, ms));

/* ================= naechsterFreierSlug ================= */

pruefe('leere Basis + nichts belegt -> "seite"', naechsterFreierSlug('', []) === 'seite');
pruefe('leere Basis + "seite" schon belegt -> "seite-2" (NICHT "-2")',
  naechsterFreierSlug('', ['seite']) === 'seite-2', naechsterFreierSlug('', ['seite']));
pruefe('leere Basis + "seite" und "seite-2" belegt -> "seite-3"',
  naechsterFreierSlug('', ['seite', 'seite-2']) === 'seite-3', naechsterFreierSlug('', ['seite', 'seite-2']));
pruefe('echter Titel bleibt unangetastet, wenn frei', naechsterFreierSlug('the-race', []) === 'the-race');
pruefe('echter Titel weicht bei Kollision konsequent vom selben Stamm aus',
  naechsterFreierSlug('the-race', ['the-race', 'the-race-2']) === 'the-race-3');

/* GEGENBEWEIS: die alte Fassung zählte im Schleifenkörper vom rohen
   `basis` weiter, nicht vom tatsächlich verwendeten Stamm -- bei leerem
   `basis` entstand so "-2" statt "seite-2". Das hier ist buchstäblich der
   alte Code aus admin.js, nachgebaut, um zu zeigen, dass er wirklich
   scheitert (und die neue Funktion nicht dasselbe tut). */
function alteFreierSlugLogik(basis, belegteSlugs) {
  let s = basis || 'seite', n = 1;
  const belegt = new Set(belegteSlugs);
  while (belegt.has(s)) s = `${basis}-${++n}`; // BUG: `basis`, nicht der Fallback
  return s;
}
const altesErgebnis = alteFreierSlugLogik('', ['seite']);
pruefe('GEGENBEWEIS: die alte Logik erzeugt bei leerer Basis wirklich "-2"',
  altesErgebnis === '-2', altesErgebnis);
pruefe('… die neue Funktion tut das an derselben Stelle NICHT',
  naechsterFreierSlug('', ['seite']) !== '-2', naechsterFreierSlug('', ['seite']));

/* ================= ersterFehler ================= */

pruefe('kein Fehler unter vieren -> null',
  ersterFehler({ error: null }, { error: null }, { error: null }, { error: null }) === null);
pruefe('ein Fehler an DRITTER Stelle (wie die Sicherung: projects, posts, settings, seiten) wird gefunden',
  ersterFehler({ error: null }, { error: null }, { error: 'settings kaputt' }, { error: null }) === 'settings kaputt');
pruefe('der ERSTE Fehler gewinnt, wenn mehrere da sind',
  ersterFehler({ error: 'a' }, { error: 'b' }) === 'a');

/* GEGENBEWEIS: die alte Zeile in admin.js las nur drei von vier Feldern
   (`pr.error || po.error || sei.error` -- se.error fehlte). Nachgebaut, um
   zu zeigen, dass ein Fehler an GENAU dieser Stelle unbemerkt bliebe. */
const [pr, po, se, sei] = [{ error: null }, { error: null }, { error: 'settings kaputt' }, { error: null }];
const alterAusdruck = pr.error || po.error || sei.error; // BUG: se.error fehlt
pruefe('GEGENBEWEIS: die alte Kette übersieht den Fehler an der settings-Abfrage',
  alterAusdruck == null, String(alterAusdruck));
pruefe('… ersterFehler() übersieht ihn NICHT',
  ersterFehler(pr, po, se, sei) === 'settings kaputt');

/* ================= erzeugeEntprellung ================= */

{
  let aufrufe = 0;
  const e = erzeugeEntprellung(() => { aufrufe++; }, 500);
  pruefe('frisch erzeugt: nichts steht aus', e.ausstehend() === false);
  e.anstossen();
  pruefe('nach anstossen(): eine Änderung steht aus', e.ausstehend() === true);
  pruefe('… aber noch nicht ausgelöst (Zeitgeber läuft noch)', aufrufe === 0);

  /* Das ist der Kern des behobenen Fehlers: sofort() MUSS die wartende
     Änderung auslösen, statt sie mit dem Zeitgeber verfallen zu lassen. */
  const wirklichAusgeloest = e.sofort();
  pruefe('sofort() meldet, dass wirklich etwas ausgelöst wurde', wirklichAusgeloest === true);
  pruefe('sofort() löst die wartende Änderung SOFORT aus (nicht erst nach 500ms)', aufrufe === 1);
  pruefe('danach steht nichts mehr aus', e.ausstehend() === false);

  /* Ein zweiter sofort()-Aufruf ohne neue Änderung darf NICHT nochmal
     auslösen -- sonst gäbe es einen doppelten (leeren) Schreibvorgang. */
  const zweitesMal = e.sofort();
  pruefe('sofort() ohne ausstehende Änderung tut nichts', zweitesMal === false && aufrufe === 1);
}

{
  /* Der ursprüngliche Zeitgeber darf nach sofort()/verwerfen() NICHT mehr
     von selbst feuern -- genau das war der zweite Teil des Fehlers ("ein
     danach feuernder Zeitgeber darf nicht in die falsche Seite schreiben"). */
  let aufrufe = 0;
  const e = erzeugeEntprellung(() => { aufrufe++; }, 60);
  e.anstossen();
  e.sofort();
  await warte(150); // länger als die 60ms-Verzögerung
  pruefe('nach sofort() feuert der alte Zeitgeber NICHT noch einmal nach',
    aufrufe === 1, `${aufrufe} Aufrufe (erwartet: genau 1)`);
}

{
  /* verwerfen() darf gar nicht auslösen -- für den Fall, dass der
     Aufrufer die Änderung längst auf anderem Weg gespeichert hat. */
  let aufrufe = 0;
  const e = erzeugeEntprellung(() => { aufrufe++; }, 60);
  e.anstossen();
  e.verwerfen();
  await warte(150);
  pruefe('verwerfen() löst NICHT aus und der Zeitgeber feuert danach auch nicht mehr',
    aufrufe === 0, `${aufrufe} Aufrufe (erwartet: 0)`);
}

{
  /* Der normale Weg (ohne Schließen dazwischen) muss weiterhin funktionieren:
     nach Ablauf der Wartezeit löst der Zeitgeber von selbst aus. */
  let aufrufe = 0;
  const e = erzeugeEntprellung(() => { aufrufe++; }, 60);
  e.anstossen();
  await warte(150);
  pruefe('ohne Eingriff löst der Zeitgeber nach Ablauf der Wartezeit von selbst aus',
    aufrufe === 1);
  pruefe('… und danach steht nichts mehr aus', e.ausstehend() === false);
}

/* GEGENBEWEIS: die alte Fassung in admin.js verwirft eine ausstehende
   Änderung tatsächlich. Nachgebaut nach dem echten Code (Zeile 293-299,
   387-395 vor der Behebung) -- mit denselben ZWEI getrennten Variablen
   wie im Original: `seitenEntprellung` (roher Zeitgeber) und
   `SEITEN_WARTESCHLANGE` (die Warteschlange, über die tatsächlich
   geschrieben wird). Der eigentliche Fehler: editorSchliessen() nullt nur
   die Warteschlange, kappt aber NIE den Zeitgeber -- der feuert später
   trotzdem, findet dann aber (per "?."), dank Nullung, nichts mehr vor,
   das schreiben könnte. */
{
  let geschrieben = null;
  let SEITEN_WARTESCHLANGE_ALT = { anstossen: (wert) => { geschrieben = wert; } };
  let seitenEntprellungAlt;
  function seiteSpeichernAnstossenAlt(wert) { SEITEN_WARTESCHLANGE_ALT?.anstossen(wert); }
  function seiteFeldGeaendertAlt(wert) {
    clearTimeout(seitenEntprellungAlt);
    seitenEntprellungAlt = setTimeout(() => seiteSpeichernAnstossenAlt(wert), 60);
  }
  function editorSchliessenAlt() {
    SEITEN_WARTESCHLANGE_ALT = null; // wie "SEITEN_WARTESCHLANGE = null;" im Original
    // FEHLT (das ist der Bug): clearTimeout(seitenEntprellungAlt);
  }
  seiteFeldGeaendertAlt('Neuer Titel');
  editorSchliessenAlt(); // Klick auf "← Übersicht" < 500ms nach dem letzten Tastendruck
  await warte(150); // länger als die 60ms-Verzögerung -- der alte Zeitgeber feuert trotzdem
  pruefe('GEGENBEWEIS: die alte editorSchliessen()-Logik verliert die Änderung wirklich',
    geschrieben === null, 'geschrieben=' + geschrieben + ' (erwartet: null, also verloren)');
}

/* ================= darfDurchsCanvas / IMMER_EINZELBILD ================= */

pruefe('JPEG darf durchs Canvas (normales Foto)', darfDurchsCanvas('image/jpeg') === true);
pruefe('PNG darf durchs Canvas', darfDurchsCanvas('image/png') === true);
pruefe('GIF darf NICHT durchs Canvas (Animation ginge verloren)', darfDurchsCanvas('image/gif') === false);
pruefe('APNG darf NICHT durchs Canvas', darfDurchsCanvas('image/apng') === false);
pruefe('WebP darf NICHT durchs Canvas (kann animiert sein)', darfDurchsCanvas('image/webp') === false);
pruefe('ein unbekannter Typ darf NICHT durchs Canvas (Positivliste, kein Rückfall auf "sicher")',
  darfDurchsCanvas('image/avif') === false);

/* GEGENBEWEIS: die alte Negativliste (`type==='image/gif' || type==='image/apng'`)
   kannte WebP gar nicht -- eine animierte WebP wäre bei ihr NICHT als
   "bewegt" erkannt worden und wäre durchs Canvas gelaufen. */
function alteBewegtErkennung(type) {
  return type === 'image/gif' || type === 'image/apng'; // true = "bewegt, nicht verkleinern"
}
pruefe('GEGENBEWEIS: die alte Negativliste hält animierte WebP für UNbewegt (Fehler)',
  alteBewegtErkennung('image/webp') === false);
pruefe('… die neue Positivliste tut das NICHT (WebP bleibt unverkleinert)',
  darfDurchsCanvas('image/webp') === false);

/* ================= endungFuerMime / endungUndArtFuerBlob ================= */

pruefe('endungFuerMime: webp -> "webp"', endungFuerMime('image/webp') === 'webp');
pruefe('endungFuerMime: svg -> "svg"', endungFuerMime('image/svg+xml') === 'svg');
pruefe('endungFuerMime: unbekannt -> Rückfall', endungFuerMime('application/x-mystery', 'bild') === 'bild');

const normal = endungUndArtFuerBlob('image/webp');
pruefe('normaler Fall (Chrome/Firefox liefern wirklich WebP)',
  normal.endung === 'webp' && normal.art === 'image/webp', JSON.stringify(normal));

const safariFall = endungUndArtFuerBlob('image/png'); // Safari: wollte WebP, liefert still PNG
pruefe('Safari-Fall: der WIRKLICHE Blob-Typ (PNG) bestimmt Endung UND Typangabe',
  safariFall.endung === 'png' && safariFall.art === 'image/png', JSON.stringify(safariFall));

/* GEGENBEWEIS: die alte Fassung setzte Endung und Typ HART auf webp,
   unabhängig davon, was der Canvas wirklich geliefert hat. */
function alteEndungUndArt() { return { endung: 'webp', art: 'image/webp' }; } // ignoriert blob.type
const altesResultat = alteEndungUndArt();
pruefe('GEGENBEWEIS: die alte Logik behauptet auch im Safari-Fall "webp" (falsch)',
  altesResultat.endung === 'webp' && altesResultat.art === 'image/webp');
pruefe('… endungUndArtFuerBlob() tut das NICHT, wenn der Blob tatsächlich PNG ist',
  !(safariFall.endung === 'webp'));

bericht();
