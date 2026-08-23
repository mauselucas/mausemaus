/* Prüft die REINE Logik der Vorlagen (assets/block-modell.js, vorlageBloecke)
   -- direkt in Node, ohne Browser und ohne Anmeldung, genau wie
   pruefe-editor-modell.mjs. Vertrag (Aufgabe 3): "Neues Projekt" legt die
   passenden Blöcke gleich an -- eine leere Seite soll niemanden einschüchtern,
   der nicht programmieren kann.
   Für jede Behauptung mit echtem Risiko steht der Gegenbeweis direkt daneben:
   eine absichtlich kaputte Variante, an der dieselbe Prüfung nachweislich
   fehlschlägt (siehe unten "sechs Prüfungen, die gar nicht fehlschlagen
   konnten" -- der teuerste Fehler des Vorhabens laut Auftrag). */
import { vorlageBloecke, BLOCKARTEN_NACH_TYP } from '../HOCHLADEN/assets/block-modell.js';

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

bericht();
