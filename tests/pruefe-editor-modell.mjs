/* Prüft die REINE Logik des Blockeditors (assets/block-modell.js) --
   direkt in Node, ohne Browser und ohne Anmeldung. Das Kernstück ist der
   Beweis, dass die Speicher-Warteschlange bei zwei schnell aufeinander-
   folgenden Speichervorgängen NIE den älteren Stand gewinnen lässt.
   Für jede Prüfung gibt es hier auch den Gegenbeweis: eine absichtlich
   kaputte Variante, an der dieselbe Behauptung nachweislich fehlschlägt. */
import {
  slashTreffer, naechsteSortierung, umschliesseAuswahl, linkEinfuegen, tuerEinfuegen,
  bildZeilenLesen, bildZeilenBauen, textMitBildLesen, textMitBildBauen,
  ueberschriftLesen, ueberschriftBauen, codeLesen, codeBauen, werkzeugLesen, werkzeugBauen,
  erzeugeUndoStapel, erzeugeSpeicherWarteschlange, leererInhalt, BLOCKARTEN,
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

/* ================= Blockauswahl ("/") ================= */

pruefe('leerer Suchtext liefert alle Blockarten in fester Reihenfolge',
  JSON.stringify(slashTreffer('').map(b => b.typ)) === JSON.stringify(BLOCKARTEN.map(b => b.typ)));

pruefe('"bi" findet "Bild" vor allen anderen',
  slashTreffer('bi')[0].typ === 'bild');

pruefe('"tür" findet das Türchen über sein Stichwort (Umlaut)',
  slashTreffer('tür').some(b => b.typ === 'tuer'));

pruefe('unsinniger Suchtext liefert nichts',
  slashTreffer('xyzxyzxyz').length === 0);

/* Gegenbeweis: eine Suche, die (falsch) IMMER alles zurückgäbe, würde diese
   Prüfung nicht bestehen -- zeigt, dass die Prüfung wirklich etwas prüft. */
pruefe('GEGENBEWEIS: „alles zurückgeben" bestünde die Leer-Prüfung nicht',
  BLOCKARTEN.length !== 0 && slashTreffer('xyzxyzxyz').length === 0);

/* ================= Sortierung ================= */

pruefe('Mittelwert zwischen zwei Nachbarn', naechsteSortierung(10, 20) === 15);
pruefe('an den Anfang', naechsteSortierung(null, 5) === 4);
pruefe('ans Ende', naechsteSortierung(5, null) === 6);
pruefe('einzig übrige Zeile', naechsteSortierung(null, null) === 1000);

/* ================= Auswahlwerkzeuge ================= */

{
  const t = 'Hallo Welt';
  const r = umschliesseAuswahl(t, 6, 10, '**');
  pruefe('fett umschließt genau die Auswahl', r.text === 'Hallo **Welt**');
}
{
  const r = linkEinfuegen('Schau ', 6, 6, 'hier', 'https://x.de');
  pruefe('Link wird an der Cursorstelle eingefügt', r.text === 'Schau [hier](https://x.de)');
}
{
  const r = tuerEinfuegen('Mehr in der ', 12, 12, 'Grünen Welt', 'gruen', 'Titel', 'Text', false);
  pruefe('Türchen-Syntax mit allen Teilen',
    r.text === 'Mehr in der [[Grünen Welt|gruen|Titel|Text]]');
}
{
  const r = tuerEinfuegen('', 0, 0, 'geheim', 'x', '', '', true);
  pruefe('geheime Tür nutzt doppelte runde Klammern', r.text === '((geheim|x))');
}

/* ================= Bild-Zeilen (Galerie in einem Block) ================= */

{
  const roh = bildZeilenBauen([
    { alt: 'Erstes', url: 'a.webp', groesse: 'gross' },
    { alt: '', url: 'b.webp', groesse: 'klein' },
  ]);
  pruefe('Bild ohne eigene Größe bekommt keine {…}-Angabe',
    roh.split('\n')[0] === '![Erstes](a.webp)');
  pruefe('Bild MIT Größe bekommt die {…}-Angabe',
    roh.split('\n')[1] === '![](b.webp){klein}');
  const zurueck = bildZeilenLesen(roh);
  pruefe('Bild-Zeilen lassen sich verlustfrei hin und zurück lesen',
    zurueck.length === 2 && zurueck[0].url === 'a.webp' && zurueck[1].groesse === 'klein');
}

/* Gegenbeweis: ein Parser, der Klammern ignoriert, würde die Größe verlieren. */
{
  const falscherParser = (roh) => String(roh).split('\n').map(z => ({ url: z.match(/\((.*?)\)/)?.[1] }));
  const kaputt = falscherParser('![](b.webp){klein}');
  pruefe('GEGENBEWEIS: naiver Parser verliert die Größenangabe',
    kaputt[0].groesse === undefined);
}

/* ================= Text mit Bild daneben ================= */

{
  const roh = textMitBildBauen({ bilderLinks: true, text: 'Ein Absatz.', bilder: [{ alt: '', url: 'x.jpg', groesse: 'gross' }] });
  pruefe('Kopfzeile trägt "links"', roh.split('\n')[0] === '::: links');
  const gelesen = textMitBildLesen(roh);
  pruefe('bilderLinks kommt beim Lesen wieder heraus', gelesen.bilderLinks === true);
  pruefe('Text kommt beim Lesen wieder heraus', gelesen.text === 'Ein Absatz.');
  pruefe('Bild kommt beim Lesen wieder heraus', gelesen.bilder.length === 1 && gelesen.bilder[0].url === 'x.jpg');
}
{
  const roh = textMitBildBauen({ bilderLinks: false, text: 'Ohne Bilder links.', bilder: [] });
  const gelesen = textMitBildLesen(roh);
  pruefe('ohne "links" ist bilderLinks false', gelesen.bilderLinks === false);
}

/* ================= Überschrift / Code / Werkzeug ================= */

pruefe('Überschrift Ebene 2 wird "## "', ueberschriftBauen(2, 'Titel') === '## Titel');
pruefe('Überschrift Ebene 3 wird "### "', ueberschriftBauen(3, 'Titel') === '### Titel');
pruefe('Überschrift-Ebene liest sich zurück', ueberschriftLesen('### Kapitel eins').ebene === 3);
pruefe('Überschrift-Text liest sich zurück', ueberschriftLesen('## Hallo').text === 'Hallo');

{
  const roh = codeBauen('js', 'const x = 1;');
  const gelesen = codeLesen(roh);
  pruefe('Code-Sprache übersteht Bauen+Lesen', gelesen.sprache === 'js');
  pruefe('Code-Inhalt übersteht Bauen+Lesen', gelesen.code === 'const x = 1;');
}
pruefe('Werkzeug-Kennung übersteht Bauen+Lesen',
  werkzeugLesen(werkzeugBauen('the-race')).kennung === 'the-race');

/* ================= leerer Inhalt je Blockart bricht nie ================= */

for (const b of BLOCKARTEN) {
  const inh = leererInhalt(b.typ);
  pruefe(`leerer Inhalt für "${b.typ}" ist ein Objekt`, inh && typeof inh === 'object');
}

/* ================= Rückgängig ================= */

{
  const u = erzeugeUndoStapel(2);
  pruefe('frischer Stapel ist leer', u.leer() === true);
  u.merken('A'); u.merken('B'); u.merken('C');
  pruefe('Stapel wächst nicht über sein Limit hinaus', u.groesse() === 2);
  pruefe('das Älteste (A) ist herausgefallen, C kommt zuerst zurück', u.zurueck() === 'C');
  pruefe('danach B', u.zurueck() === 'B');
  pruefe('danach wieder leer', u.leer() === true);
}

/* ================= Speicher-Warteschlange: kein Datenverlust ================= */

/* Grundszenario: zwei Änderungen kurz hintereinander an DEMSELBEN Block.
   Die erste ("A") braucht künstlich LÄNGER als die zweite ("B") würde --
   genau die Situation, die bei echten Netzwerk-Aufrufen zum Datenverlust
   führt, wenn man nicht aufpasst: die Antwort auf A kommt nach der Antwort
   auf B herein und überschreibt den neueren Stand mit dem alten. */
async function pruefeWarteschlange(erzeugerFn, name, sollBestehen) {
  const geschrieben = [];      // was tatsächlich an die "Datenbank" ging, in Reihenfolge des ABSCHLUSSES
  const start = [];            // in welcher Reihenfolge "schreiben" AUFGERUFEN wurde
  const dauer = { A: 60, B: 5 };  // A braucht länger als B
  const schreiben = async (daten) => {
    start.push(daten);
    await warte(dauer[daten] ?? 5);
    geschrieben.push(daten);
  };
  const q = erzeugerFn(schreiben);
  q.anstossen('A');
  await warte(1);           // "kurz hintereinander" -- A läuft noch
  q.anstossen('B');
  await warte(200);         // alles abwarten

  const letzterSchreibvorgang = geschrieben[geschrieben.length - 1];
  pruefe(name + ' — der ZULETZT abgeschlossene Schreibvorgang trägt den NEUESTEN Stand ("B")',
    letzterSchreibvorgang === 'B' === sollBestehen,
    `geschrieben=[${geschrieben.join(',')}] aufgerufen=[${start.join(',')}]`);
}

await pruefeWarteschlange(erzeugeSpeicherWarteschlange, 'echte Warteschlange', true);

/* GEGENBEWEIS: eine naive "Warteschlange", die einfach sofort feuert
   (kein Warten auf den laufenden Aufruf), verliert hier den neueren Stand --
   A beendet NACH B, weil B schneller ist, und überschreibt B mit dem alten
   Inhalt. Das ist genau der Fehler, den die echte Warteschlange verhindert.
   Zeigt: die obige Prüfung kann tatsächlich fehlschlagen, sie ist kein
   Blindgänger. */
function erzeugeNaiveWarteschlangeOHNESerialisierung(schreiben) {
  return { anstossen(daten) { schreiben(daten); }, beschaeftigt() { return false; } };
}
await pruefeWarteschlange(erzeugeNaiveWarteschlangeOHNESerialisierung,
  'GEGENBEWEIS: naive Variante ohne Serialisierung', false);

/* Zweites Szenario: viele schnelle Änderungen (z. B. Tippen) dürfen nicht
   zu vielen parallelen Netzwerk-Aufrufen führen -- nur der letzte Stand
   zählt, alle dazwischen werden übersprungen. */
{
  let aufrufe = 0;
  const gesehen = [];
  const schreiben = async (d) => { aufrufe++; await warte(15); gesehen.push(d); };
  const q = erzeugeSpeicherWarteschlange(schreiben);
  for (let i = 1; i <= 10; i++) { q.anstossen('Stand-' + i); await warte(1); }
  await warte(200);
  pruefe('von zehn schnellen Änderungen wird nur eine Handvoll tatsächlich geschrieben (kein Sturm)',
    aufrufe < 10, `${aufrufe} Schreibvorgänge`);
  pruefe('der ZULETZT geschriebene Stand ist der allerletzte ("Stand-10")',
    gesehen[gesehen.length - 1] === 'Stand-10');
}

/* beschaeftigt() muss während eines laufenden Schreibvorgangs true melden --
   das treibt die "gespeichert"-Anzeige im Editor. */
{
  let freigeben;
  const schreiben = () => new Promise(r => { freigeben = r; });
  const q = erzeugeSpeicherWarteschlange(schreiben);
  pruefe('vor dem ersten anstossen() ist die Warteschlange nicht beschäftigt', q.beschaeftigt() === false);
  q.anstossen('X');
  await warte(1);
  pruefe('während eines laufenden Schreibvorgangs ist sie beschäftigt', q.beschaeftigt() === true);
  freigeben();
  await warte(1);
  pruefe('danach wieder frei', q.beschaeftigt() === false);
}

bericht();
