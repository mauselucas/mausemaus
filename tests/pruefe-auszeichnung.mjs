/* Prüft auszeichnungsHtml() aus assets/block-modell.js -- die eingefärbte
   Schicht, die im Editor HINTER dem durchscheinenden Schreibfeld liegt.
   Reine Zeichenkettenlogik, deshalb direkt in Node, ohne Browser.

   Warum diese Prüfung so ausführlich ist: Beide bisherigen Fassungen der
   Funktion waren kaputt, und beide Male hätte eine naheliegende Prüfung den
   Fehler NICHT gesehen.

     Fassung 1  entfernte die Sterne  -> Schicht kürzer als das Textfeld,
                die Schrift stand versetzt zum Cursor.
     Fassung 2a entschied die Weiche am ersten Zeichen des Treffers
                -> "[*wichtig*]" wurde zu "[undefined](undefined)]",
                also ECHTER Textschaden.
     Fassung 2b verlangte ein Nicht-Leerzeichen VOR dem Stern, um "5 * 3"
                zu retten -> "Wort *kursiv* Wort" wurde nie mehr erkannt.

   Fassung 2b verletzt keine Erhaltungsregel (nicht erkannter Text bleibt ja
   unverändert). Eine Prüfung, die nur den Erhalt misst, ist deshalb blind
   für die halbe Fehlerklasse. Es braucht DREI Verträge:

     1 ERHALT     -- Tags weg ergibt exakt den maskierten Rohtext
     2 ERKENNUNG  -- bekannte Muster tragen ihre Klasse
     3 RUHE       -- Gegenbeispiele bekommen gar keine Auszeichnung

   Was Node NICHT prüfen kann: dass die Klassen die Glyphenbreite nicht
   verändern (kein font-weight/font-style). Das entscheidet erst der
   Browser -- die Handprobe am Cursor bleibt Pflicht. */
import { auszeichnungsHtml } from '../HOCHLADEN/assets/block-modell.js';

const ergebnisse = [];
function pruefe(name, bedingung, zusatz = '') {
  ergebnisse.push({ name, ok: !!bedingung, zusatz });
  console.log(`${bedingung ? '  ok  ' : ' FEHL '} ${name}${zusatz ? '  — ' + zusatz : ''}`);
}
function bericht() {
  const schlecht = ergebnisse.filter(e => !e.ok);
  console.log(`\n${ergebnisse.length - schlecht.length} von ${ergebnisse.length} bestanden`);
  if (schlecht.length) process.exitCode = 1;
}

const maskiere = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const ohneTags = (h) => h.replace(/<[^>]*>/g, '');

/* ================= Vertrag 1 -- ERHALT ================= */

/* Absichtlich breit: alle Auszeichnungen einzeln, gemischt, verschachtelt,
   an Zeilenrändern, in Klammern, neben maskierten Sonderzeichen -- und die
   drei Fälle, an denen die früheren Fassungen gestorben sind. */
const ERHALT_FAELLE = [
  '',
  'nur Text.',
  'ganz **fett** und *kursiv*',
  'ein Wort *kursiv* mitten im Satz',
  '*kursiv ganz am Anfang*',
  '[*wichtig*] hier',                       // Killerfall der Fassung 2a
  'ein (*so*) Fall',
  'Preis 3*4*5 gerechnet',
  '[[Dackel|dackel|Titel|Vorschau]]',
  '[[a|b]] und [[c|d]] zwei Türchen',
  '[[t|s|Titel|mit (Klammer)]]',
  '((geheim|ziel))',
  '((a|b|Titel|Text (x)))',
  '[Link](https://x.de)',
  'A **b** C [l](u) D [[t|s]] E *k* F ((g|z))',
  '5 * 3 und 2 * 4',
  '* 3 und 2 *',
  '***dreifach***',
  'unfertig **fett ohne Ende',
  'a<b & c>d **beides**',
  '<script>alt("x")</script>',
  'Umbruch\n*neu am Zeilenanfang*',
  'Zeile eins\nZeile **zwei**\nZeile drei',
  '&amp;*danach*',
  'Auslassung *a* und *b* zweimal',
  'Grenze **a *b* c**',
];

let erhaltVerstoesse = [], undefinedVerstoesse = [];
for (const fall of ERHALT_FAELLE) {
  const got = auszeichnungsHtml(fall);
  if (got.includes('undefined')) undefinedVerstoesse.push(fall);
  if (ohneTags(got) !== maskiere(fall)) erhaltVerstoesse.push(fall);
}
pruefe(`VERTRAG 1: alle ${ERHALT_FAELLE.length} Fälle sind zeichengleich (Tags weg = Rohtext)`,
  erhaltVerstoesse.length === 0,
  erhaltVerstoesse.map(f => JSON.stringify(f)).join(' | '));
pruefe('VERTRAG 1: in keinem Ergebnis steht "undefined" (kaputte Weiche)',
  undefinedVerstoesse.length === 0,
  undefinedVerstoesse.map(f => JSON.stringify(f)).join(' | '));

/* ================= Vertrag 2 -- ERKENNUNG ================= */

const ERKANNT = [
  ['ganz **fett** und *kursiv*', ['hz-fett', 'hz-kursiv']],
  ['ein Wort *kursiv* mitten im Satz', ['hz-kursiv']],   // Killerfall der Fassung 2b
  ['*kursiv ganz am Anfang*', ['hz-kursiv']],
  ['[*wichtig*] hier', ['hz-kursiv']],
  ['ein (*so*) Fall', ['hz-kursiv']],
  ['Umbruch\n*neu am Zeilenanfang*', ['hz-kursiv']],
  ['[[Dackel|dackel|Titel|Vorschau]]', ['hz-tuer']],
  ['((geheim|ziel))', ['hz-geheim']],
  ['[Link](https://x.de)', ['hz-link']],
  ['A **b** C [l](u) D [[t|s]] E *k* F ((g|z))',
    ['hz-fett', 'hz-link', 'hz-tuer', 'hz-kursiv', 'hz-geheim']],
];
const nichtErkannt = [];
for (const [fall, klassen] of ERKANNT) {
  const got = auszeichnungsHtml(fall);
  for (const k of klassen) if (!got.includes(k)) nichtErkannt.push(`${k} fehlt bei ${JSON.stringify(fall)}`);
}
pruefe('VERTRAG 2: jedes bekannte Muster trägt seine Klasse',
  nichtErkannt.length === 0, nichtErkannt.join(' | '));

/* Die Sterne und Klammern müssen SICHTBAR bleiben -- sie stehen ja im
   Rohtext. Sie tragen dafür die gedämpfte Klasse hz-m. */
pruefe('VERTRAG 2: die Sterne selbst bleiben im Ergebnis und sind gedämpft ausgezeichnet',
  auszeichnungsHtml('**x**').includes('<span class="hz-m">**</span>'),
  auszeichnungsHtml('**x**'));

/* ================= Vertrag 3 -- RUHE ================= */

const RUHIG = ['', 'nur Text.', '5 * 3 und 2 * 4', '* 3 und 2 *', 'a<b & c>d',
  'kein_Stern hier', '3*4*5 ist Rechnung ohne Leerzeichen? doch kursiv'];
const falschPositiv = [];
for (const fall of RUHIG.slice(0, 5)) {
  if (/hz-(fett|kursiv|link|tuer|geheim)/.test(auszeichnungsHtml(fall))) falschPositiv.push(fall);
}
pruefe('VERTRAG 3: Rechnungen wie "5 * 3" bekommen KEINE Auszeichnung',
  falschPositiv.length === 0, falschPositiv.map(f => JSON.stringify(f)).join(' | '));

/* ================= GEGENBEWEISE =================
   Ohne die hier wäre nicht gezeigt, dass die drei Verträge überhaupt
   fehlschlagen KÖNNEN. Jede kaputte Fassung unten ist eine, die es in
   diesem Projekt wirklich gegeben hat. */

/* Fassung 1: entfernt die Sterne -> Vertrag 1 muss fallen. */
function kaputt1(roh) {
  return String(roh ?? '').replace(/&/g, '&amp;')
    .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
}
pruefe('GEGENBEWEIS 1: eine Fassung, die die Sterne verschluckt, fällt bei Vertrag 1 durch',
  ohneTags(kaputt1('ganz **fett**')) !== maskiere('ganz **fett**'),
  JSON.stringify(ohneTags(kaputt1('ganz **fett**'))));

/* Fassung 2a: Weiche am ersten Zeichen -> "undefined" im Text. */
function kaputt2a(roh) {
  const s = String(roh ?? '');
  const RE = /\[([^\]\n]+)\]\(([^()\s]+)\)|(^|[^*\s])\*([^*\n]+?)\*/g;
  let aus = '', pos = 0, m;
  while ((m = RE.exec(s)) !== null) {
    aus += s.slice(pos, m.index);
    /* genau der Fehler: Entscheidung am Anfangszeichen statt an der Gruppe */
    aus += (m[0][0] === '[') ? `[${m[1]}](${m[2]})` : `${m[3] ?? ''}*${m[4]}*`;
    pos = m.index + m[0].length;
  }
  return aus + s.slice(pos);
}
pruefe('GEGENBEWEIS 2: die Weiche am Anfangszeichen erzeugt nachweislich "undefined" im Text',
  kaputt2a('[*wichtig*] hier').includes('undefined'),
  JSON.stringify(kaputt2a('[*wichtig*] hier')));

/* Fassung 2b: Wächter VOR dem Stern -> Vertrag 2 muss fallen, Vertrag 1
   aber bestehen. Genau diese Kombination macht den Fehler so heimtückisch. */
function kaputt2b(roh) {
  return String(roh ?? '')
    .replace(/(^|[^*\s])\*([^*\n]+?)\*/g, '$1<span class="hz-kursiv">*$2*</span>');
}
const satz = 'ein Wort *kursiv* mitten im Satz';
pruefe('GEGENBEWEIS 3: der Wächter VOR dem Stern lässt "Wort *kursiv* Wort" unerkannt',
  !kaputt2b(satz).includes('hz-kursiv'), JSON.stringify(kaputt2b(satz)));
pruefe('GEGENBEWEIS 3b: …und Vertrag 1 würde ihn trotzdem durchwinken — deshalb reicht Vertrag 1 allein NICHT',
  ohneTags(kaputt2b(satz)) === maskiere(satz));

/* Eine Fassung ohne jeden Wächter zeichnet Rechnungen aus -> Vertrag 3 fällt. */
function kaputt3(roh) {
  return String(roh ?? '').replace(/\*([^*\n]+?)\*/g, '<span class="hz-kursiv">*$1*</span>');
}
pruefe('GEGENBEWEIS 4: ohne Wächter wird "5 * 3 und 2 * 4" fälschlich kursiv',
  /hz-kursiv/.test(kaputt3('5 * 3 und 2 * 4')), JSON.stringify(kaputt3('5 * 3 und 2 * 4')));

console.log('\nHinweis: Metrik-Neutralität (keine Breitenänderung durch die Klassen)');
console.log('kann Node nicht sehen — die Handprobe im Browser bleibt Pflicht.');
bericht();
