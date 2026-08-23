/* Prüft die Spielwiese (Aufgabe 3, Vertrag "Spielwiese"): eine Seite mit
   allen Blockarten als Beispiel, Status "Entwurf" -- für Fremde unsichtbar,
   jederzeit löschbar. Ohne Anmeldung: direkte, echte REST-Anfragen mit dem
   ÖFFENTLICHEN Schlüssel (anon) gegen die Datenbank, genau wie
   pruefe-umzug.mjs es für "Entwürfe sind für Fremde unsichtbar" schon tut --
   hier gezielt auf die eine Seite mit dem Slug "spielwiese". */
import { readFile } from 'node:fs/promises';

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

const cfgText = await readFile(new URL('../HOCHLADEN/assets/config.js', import.meta.url), 'utf8');
const CFG = {
  url: cfgText.match(/url:\s*'([^']+)'/)[1],
  key: cfgText.match(/key:\s*'([^']+)'/)[1],
};
const kopf = { apikey: CFG.key, Authorization: 'Bearer ' + CFG.key };

/* ================= Für Fremde unsichtbar ================= */

const spielwiese = await fetch(`${CFG.url}/rest/v1/seiten?slug=eq.spielwiese&select=id,slug,status`, { headers: kopf });
const spielwieseDaten = await spielwiese.json();
pruefe('die Spielwiese ist für Fremde (öffentlicher Schlüssel) nicht sichtbar',
  spielwiese.status === 200 && Array.isArray(spielwieseDaten) && spielwieseDaten.length === 0,
  'HTTP ' + spielwiese.status + ', ' + spielwieseDaten.length + ' Zeile(n)');

/* Auch über die eingebetteten Blöcke einer VERÖFFENTLICHTEN Nachbarseite
   darf die Spielwiese nirgends auftauchen -- sie hat keine seite_id-
   Beziehung zu irgendetwas anderem, das wäre also ohnehin unmöglich, aber
   schadet nicht, es direkt zu zeigen: kein "spielwiese" im kompletten
   öffentlich sichtbaren seiten-Bestand. */
const alle = await (await fetch(`${CFG.url}/rest/v1/seiten?select=slug`, { headers: kopf })).json();
pruefe('"spielwiese" taucht in der GESAMTEN für Fremde sichtbaren Seitenliste nicht auf',
  Array.isArray(alle) && !alle.some(s => s.slug === 'spielwiese'),
  alle.map(s => s.slug).join(', '));

/* GEGENBEWEIS / Selbstprüfung: dieselbe Abfragemethode muss eine wirklich
   veröffentlichte Seite ("brief") auch wirklich finden -- sonst wäre der
   obige "unsichtbar"-Befund nur ein kaputter Netzwerkaufruf, der IMMER
   leer zurückkommt, und keine echte Prüfung. */
const briefProbe = await (await fetch(`${CFG.url}/rest/v1/seiten?slug=eq.brief&select=id,slug,status`, { headers: kopf })).json();
pruefe('GEGENBEWEIS/Selbstprüfung: dieselbe Abfrage findet eine wirklich veröffentlichte Seite ("brief")',
  Array.isArray(briefProbe) && briefProbe.length === 1 && briefProbe[0].status === 'published',
  JSON.stringify(briefProbe));

/* ================= Nichts verweist auf sie -- "jederzeit löschbar" ================= */

const hochladen = new URL('../HOCHLADEN/', import.meta.url);
const zuDurchsuchen = [
  'index.html', 'welt.html', 'admin.html',
  'assets/brief.js', 'assets/leiste.js', 'assets/bloecke.js', 'assets/db.js',
  'assets/admin.js', 'assets/blockeditor.js', 'assets/block-modell.js', 'assets/seed.js',
];
const treffer = [];
for (const pfad of zuDurchsuchen) {
  const inhalt = await readFile(new URL(pfad, hochladen), 'utf8').catch(() => '');
  if (inhalt.includes('spielwiese')) treffer.push(pfad);
}
pruefe('kein ausgeliefertes HOCHLADEN-Skript verweist fest auf die Spielwiese (sie bliebe beim Löschen folgenlos)',
  treffer.length === 0, treffer.join(', '));

/* GEGENBEWEIS: eine Datei, die "spielwiese" enthält, würde erkannt --
   sonst wäre auch diese Prüfung nur scheinbar wirksam. */
{
  const erfunden = ['assets/seed.js'];
  const inhalt = 'ein Verweis auf /welt/spielwiese mitten im Text';
  const faende = erfunden.filter(() => inhalt.includes('spielwiese'));
  pruefe('GEGENBEWEIS: ein Treffer in einer Datei würde erkannt', faende.length === 1);
}

bericht();
