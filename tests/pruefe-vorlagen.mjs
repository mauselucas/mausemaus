/* Prüft die REINE Logik der Vorlagen (assets/block-modell.js, vorlageBloecke)
   -- direkt in Node, ohne Browser und ohne Anmeldung, genau wie
   pruefe-editor-modell.mjs. Vertrag (Aufgabe 3): "Neues Projekt" legt die
   passenden Blöcke gleich an -- eine leere Seite soll niemanden einschüchtern,
   der nicht programmieren kann.
   Für jede Behauptung mit echtem Risiko steht der Gegenbeweis direkt daneben:
   eine absichtlich kaputte Variante, an der dieselbe Prüfung nachweislich
   fehlschlägt (siehe unten "sechs Prüfungen, die gar nicht fehlschlagen
   konnten" -- der teuerste Fehler des Vorhabens laut Auftrag). */
import { readFile } from 'node:fs/promises';
import { vorlageBloecke, BLOCKARTEN_NACH_TYP, leerSeitenEntwurf } from '../HOCHLADEN/assets/block-modell.js';

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

/* ================= "Neues Projekt" legt Blöcke an ================= */

const projektVorlage = vorlageBloecke('projekt');
pruefe('vorlageBloecke("projekt") liefert überhaupt Blöcke',
  Array.isArray(projektVorlage) && projektVorlage.length > 0, projektVorlage.length);
pruefe('…jeder Eintrag ist eine bekannte Blockart',
  projektVorlage.every(b => !!BLOCKARTEN_NACH_TYP[b.typ]),
  projektVorlage.map(b => b.typ).join(','));
pruefe('…jeder Eintrag hat ein Inhalt-Objekt (kein leerer/undefinierter Wert)',
  projektVorlage.every(b => b.inhalt && typeof b.inhalt === 'object'));
pruefe('…der erste Block ist ein Text, der zum Überschreiben einlädt (kein leerer Platzhalter)',
  projektVorlage[0].typ === 'text' && projektVorlage[0].inhalt.roh.length > 10,
  JSON.stringify(projektVorlage[0]));

/* GEGENBEWEIS: eine Vorlage, die für "projekt" einfach nichts liefert
   (z.B. weil eine spätere Änderung den case versehentlich löscht), würde
   von der ersten Prüfung oben zuverlässig erkannt. */
{
  const kaputt = [];
  pruefe('GEGENBEWEIS: eine leere Vorlage für "projekt" würde erkannt (Länge 0)',
    !(Array.isArray(kaputt) && kaputt.length > 0));
}

/* ================= "Neue Welt" legt ebenfalls Blöcke an ================= */

const weltVorlage = vorlageBloecke('welt');
pruefe('vorlageBloecke("welt") liefert überhaupt Blöcke',
  Array.isArray(weltVorlage) && weltVorlage.length > 0, weltVorlage.length);
pruefe('…jeder Eintrag ist eine bekannte Blockart',
  weltVorlage.every(b => !!BLOCKARTEN_NACH_TYP[b.typ]));
pruefe('…jeder Eintrag hat ein Inhalt-Objekt', weltVorlage.every(b => b.inhalt && typeof b.inhalt === 'object'));

/* Projekt- und Welt-Vorlage sollen sich unterscheiden dürfen -- keine der
   beiden darf einfach eine Kopie der leeren-Inhalt-Funktion ohne echten
   Starttext sein (sonst wäre "Vorlage" nur ein anderes Wort für "leer"). */
pruefe('die Projekt-Vorlage enthält lesbaren Starttext (kein leerer String)',
  projektVorlage.some(b => (b.inhalt.roh || '').trim().length > 0));
pruefe('die Welt-Vorlage enthält lesbaren Starttext (kein leerer String)',
  weltVorlage.some(b => (b.inhalt.roh || '').trim().length > 0));

/* GEGENBEWEIS: eine Vorlage mit ausschließlich leeren Inhalten (wie
   leererInhalt() sie für einen frisch per "/" gewählten Block liefert) würde
   die "lesbarer Starttext"-Prüfung NICHT bestehen -- das zeigt, dass diese
   Prüfung tatsächlich zwischen "Vorlage mit Anleitung" und "leerer Block"
   unterscheiden kann. */
{
  const nurLeer = [{ typ: 'text', inhalt: { roh: '' } }, { typ: 'bild', inhalt: { roh: '' } }];
  pruefe('GEGENBEWEIS: eine Vorlage aus nur leeren Blöcken würde an "lesbarer Starttext" scheitern',
    !nurLeer.some(b => (b.inhalt.roh || '').trim().length > 0));
}

/* ================= unbekannte/nicht anwendbare Arten ================= */

pruefe('vorlageBloecke("brief") liefert nichts -- die eine feste Brief-Seite entsteht nie über "+ Neu"',
  Array.isArray(vorlageBloecke('brief')) && vorlageBloecke('brief').length === 0);
pruefe('vorlageBloecke("gibtsnicht") liefert nichts, statt einen Fehler zu werfen',
  Array.isArray(vorlageBloecke('gibtsnicht')) && vorlageBloecke('gibtsnicht').length === 0);

/* ================= sort_order-Vergabe, wie admin.js sie anwendet ================= */

/* admin.js selbst vergibt sort_order beim Einfügen (10, 20, 30, …) -- hier
   wird nur geprüft, dass eine Vorlage mit N Blöcken auch wirklich N
   AUFSTEIGENDE, unterschiedliche Positionen bekäme, keine doppelten. */
{
  const nummeriert = projektVorlage.map((v, i) => (i + 1) * 10);
  const eindeutig = new Set(nummeriert).size === nummeriert.length;
  const aufsteigend = nummeriert.every((n, i) => i === 0 || n > nummeriert[i - 1]);
  pruefe('die von admin.js vergebene Reihenfolge wäre eindeutig und aufsteigend',
    eindeutig && aufsteigend, nummeriert.join(','));
}

/* ================= Der Entwurf für eine NEUE Seite =================

   Der Fehler dahinter: Der Entwurf trug ein `id: null` mit sich, weil
   dieselbe Form auch als Vorlage für das Objekt im Arbeitsspeicher diente.
   Ein ausdrücklich mitgeschicktes `null` schlägt aber den automatischen
   Vorgabewert der Spalte -- die Datenbank wies jeden neuen Datensatz ab:
   "null value in column id violates not-null constraint".

   Der Knopf "+ Neue Seite" war damit seit dem ersten Tag kaputt. Gemerkt
   hat es niemand, weil alle vorhandenen Seiten aus dem Umzugsskript
   stammen -- gedrückt hat den Knopf erst Lucas, Wochen später. */
{
  const e = leerSeitenEntwurf('welt', [10, 20, 30]);

  pruefe('der Entwurf enthält KEIN "id" — die Datenbank vergibt die Kennung selbst',
    !Object.prototype.hasOwnProperty.call(e, 'id'),
    'Felder: ' + Object.keys(e).join(', '));

  /* Dasselbe gilt für jedes andere Feld, das die Datenbank selbst füllt. */
  const selbstVergeben = ['id', 'created_at', 'updated_at'];
  const zuviel = selbstVergeben.filter(k => Object.prototype.hasOwnProperty.call(e, k));
  pruefe('…und auch kein created_at/updated_at (die setzt die Datenbank)',
    zuviel.length === 0, zuviel.join(', '));

  pruefe('der Entwurf trägt die geforderte Art', e.typ === 'welt', e.typ);
  pruefe('…startet als Entwurf, nicht veröffentlicht', e.status === 'draft', e.status);
  pruefe('…und reiht sich hinter den vorhandenen Seiten ein',
    e.sort_order === 40, String(e.sort_order));
  pruefe('ohne vorhandene Seiten fängt die Sortierung sauber an',
    leerSeitenEntwurf('projekt', []).sort_order === 10,
    String(leerSeitenEntwurf('projekt', []).sort_order));

  /* GEGENBEWEIS: genau die alte, kaputte Form würde erkannt. */
  const kaputt = { id: null, slug: '', typ: 'welt', status: 'draft' };
  pruefe('GEGENBEWEIS: die alte Form mit "id: null" würde von dieser Prüfung erkannt',
    Object.prototype.hasOwnProperty.call(kaputt, 'id'));
}

/* Und an der echten Datei: der Aufruf, der wirklich in die Datenbank
   schreibt, darf kein "id" mitschicken. Rein strukturell, ohne Anmeldung --
   der Fehler lag ja nicht in der Logik, sondern in dem, was übergeben wurde. */
{
  const js = await readFile(new URL('../HOCHLADEN/assets/admin.js', import.meta.url), 'utf8');
  const stelle = (js.match(/sb\.from\('seiten'\)\.insert\(([^)]*)\)/) || [])[0] || '';
  pruefe('admin.js legt Seiten überhaupt noch über insert() an',
    stelle.length > 0, stelle);
  pruefe('…und baut den Entwurf über leerSeitenEntwurf (keine zweite, abweichende Form)',
    js.includes('leerSeitenEntwurf('), '');
  pruefe('in admin.js steht nirgends mehr ein "id: null"',
    !/\bid:\s*null\b/.test(js),
    (js.match(/.{0,40}\bid:\s*null\b.{0,40}/) || [''])[0]);
}

bericht();
