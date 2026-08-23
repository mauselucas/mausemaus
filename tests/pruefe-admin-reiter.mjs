/* Prüft eine Regel, die aus einem echten Fehler entstanden ist (vom
   Koordinator gefunden und nachgestellt): der frühere "Startseite"-Reiter im
   Admin bearbeitete die Tabelle `settings` -- aber KEINE ausgelieferte Seite
   (index.html/welt.html) liest sie noch, seit der Brief auf Blöcke
   umgestellt ist. Lucas hätte dort seine Begrüßung geändert, "gespeichert"
   gesehen, und auf der echten Seite wäre nichts passiert. Ein Reiter mit
   sichtbarer Wirkung, aber ohne echte Wirkung, ist schlimmer als ein
   fehlender.

   Die Regel, die das nicht zurückkommen lassen soll:
     Es darf im Admin keinen Reiter geben, dessen Ansicht auf Daten
     schreibt, die keine ausgelieferte Seite liest.

   Ohne Anmeldung geprüft -- rein strukturell, direkt an den echten Dateien
   admin.html/admin.js, kein Chrome nötig. */
import { readFile, writeFile } from 'node:fs/promises';

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

const adminHtmlPfad = new URL('../HOCHLADEN/admin.html', import.meta.url);
const adminJsPfad = new URL('../HOCHLADEN/assets/admin.js', import.meta.url);

/* ================= "Startseite" ist wirklich weg ================= */

{
  const html = await readFile(adminHtmlPfad, 'utf8');
  pruefe('es gibt kein <main id="view-settings"> mehr', !html.includes('id="view-settings"'));
  pruefe('es gibt keinen Reiter-Knopf data-art="settings" mehr', !html.includes('data-art="settings"'));

  /* Der #reiter-Block darf NUR noch "projekt" und "welt" kennen -- keine
     dritte, verwaiste Art. */
  const reiterBlock = (html.match(/<div class="reiter" id="reiter">[\s\S]*?<\/div>/) || [''])[0];
  const arten = [...reiterBlock.matchAll(/data-art="([^"]+)"/g)].map(m => m[1]);
  pruefe('der Reiter kennt genau "projekt" und "welt", nichts drittes',
    arten.length === 2 && arten.includes('projekt') && arten.includes('welt'),
    arten.join(', '));
}

/* GEGENBEWEIS: html.includes() auf einen leeren String würde IMMER true
   liefern und die erste Prüfung fälschlich bestehen lassen, wenn sie falsch
   gepolt wäre -- zur Kontrolle hier einmal absichtlich falsch gepolt. */
pruefe('GEGENBEWEIS: dieselbe Methode würde ein wirklich vorhandenes view-settings erkennen',
  '<main id="view-settings" hidden>'.includes('id="view-settings"'));

/* ================= admin.js schreibt nirgends mehr in `settings` ================= */

{
  const js = await readFile(adminJsPfad, 'utf8');
  /* Jeder Aufruf der Form sb.from('settings')…, gefolgt (in derselben
     Kette) von .update(/.insert(/.upsert(/.delete( wäre ein Schreibzugriff.
     .select( (für die Sicherung) bleibt erlaubt -- das ist reines Lesen,
     kein Editier-Formular. */
  const treffer = [...js.matchAll(/sb\.from\('settings'\)([^;]{0,80})/g)].map(m => m[0]);
  const schreibend = treffer.filter(t => /\.(update|insert|upsert|delete)\s*\(/.test(t));
  pruefe('kein Aufruf schreibt noch in die Tabelle "settings" (nur die Sicherung liest sie)',
    schreibend.length === 0, schreibend.join(' | '));
  pruefe('…die Sicherung liest "settings" aber weiterhin mit (nichts über Bord geworfen)',
    treffer.some(t => /\.select\s*\(/.test(t)), treffer.join(' | '));
}

/* GEGENBEWEIS: ein erfundener Text mit einem echten Schreibzugriff würde
   von genau demselben Muster erkannt. */
{
  const erfunden = "sb.from('settings').update({ x: 1 }).eq('id', 1);";
  const treffer = [...erfunden.matchAll(/sb\.from\('settings'\)([^;]{0,80})/g)].map(m => m[0]);
  const schreibend = treffer.filter(t => /\.(update|insert|upsert|delete)\s*\(/.test(t));
  pruefe('GEGENBEWEIS: ein Schreibzugriff auf "settings" würde vom Muster erkannt',
    schreibend.length === 1);
}

/* ================= Der Brief ist stattdessen klar erreichbar ================= */

{
  const html = await readFile(adminHtmlPfad, 'utf8');
  const js = await readFile(adminJsPfad, 'utf8');

  const knopf = (html.match(/<button[^>]*id="btn-brief"[^>]*>([\s\S]*?)<\/button>/) || [])[1] || '';
  pruefe('es gibt einen Knopf für den Brief', knopf.length > 0);
  pruefe('…seine Beschriftung macht klar, dass er die Startseite/den Brief öffnet',
    /Brief|Startseite/i.test(knopf), JSON.stringify(knopf));

  const handler = (js.match(/\$\('#btn-brief'\)\.addEventListener\('click',[\s\S]*?\}\);/) || [''])[0];
  pruefe('der Knopf lädt wirklich die Seite mit typ="brief"',
    handler.includes("eq('typ', 'brief')"), handler.slice(0, 160));
  pruefe('…und öffnet sie im selben Editor wie Projekte/Welten (oeffneEditor)',
    handler.includes('oeffneEditor('));
}

/* GEGENBEWEIS: ein leerer Handler-Text würde die "typ=brief"-Prüfung
   nicht bestehen. */
pruefe('GEGENBEWEIS: ein leerer Handler-Text würde an der typ="brief"-Prüfung scheitern',
  !''.includes("eq('typ', 'brief')"));

bericht();
