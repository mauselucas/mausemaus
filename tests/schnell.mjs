#!/usr/bin/env node
// tests/schnell.mjs — der schnelle Durchlauf.
//
// Führt nur die Prüfungen aus, die OHNE Browser und OHNE Netz auskommen.
// Gedacht für: während der Arbeit, nach jeder Änderung, auch von Claude Code.
// NICHT gedacht für: vor dem Hochladen. Dafür `node tests/voll.mjs`.
//
//   node tests/schnell.mjs            nur die schnellen (Sekunden)
//   node tests/schnell.mjs --mittel   dazu alles mit Chrome (rund eine Minute)
//   node tests/schnell.mjs --liste    zeigt die Einteilung, führt nichts aus
//   node tests/voll.mjs               alles (dieselbe Datei, anderer Name)
//
// Warum drei Stufen und nicht zwei: Die schnelle Gruppe prüft nur Logik --
// Blockmodell, Vorlagen, Auszeichnung. Für eine Änderung am Aussehen sagt
// sie NICHTS aus. Genau dafür ist --mittel da: alles, was Chrome braucht,
// läuft mit; draußen bleiben nur die vier echten Minutenfresser (drei
// starten zusätzlich Firefox, eine misst die echte Seite über das Netz).
// Bei UI-Arbeit ist --mittel der richtige Lauf.
//
// Die Einteilung wird NICHT von Hand gepflegt, sondern gemessen: jede
// pruefe-*.mjs wird als Text gelesen und gilt als langsam, sobald sie einen
// Browser startet oder ans echte Netz geht. Eine neue Prüfung landet damit
// von selbst in der richtigen Gruppe — im Zweifel in der langsamen.

import { readdir, readFile } from 'node:fs/promises';
import { spawn, spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HIER = dirname(fileURLToPath(import.meta.url));
const VOLL = process.argv[1].endsWith('voll.mjs') || process.argv.includes('--voll');
const MITTEL = process.argv.includes('--mittel');
const NUR_LISTE = process.argv.includes('--liste');

// Was eine Prüfung langsam macht. Trifft eins davon zu, gehört sie in den
// vollen Lauf. Lieber eine schnelle Prüfung zu viel im langsamen Topf als
// eine langsame, die den Arbeitsfluss aufhält.
// Die vier, die wirklich Minuten kosten. Sie laufen NUR im vollen Lauf.
// Bewusst eine kurze, ausgeschriebene Liste statt eines Textmusters: es sind
// genau vier, sie ändern sich selten, und wer eine dazuschreibt soll das
// bewusst tun. Gemessen am Volllauf vom 05.09.2026.
const SEHR_LANGSAM = [
  /from '\.\/firefox\.mjs'/,   // Firefox fernsteuern -- der Hauptkostenpunkt
];

// Prüfungen, die die ECHTE Seite über das Netz messen. Bewusst eine
// ausgeschriebene Liste und KEIN Textmuster auf "mausemaus.com": drei
// weitere Dateien nennen die Adresse nur in einem Kommentar oder in einem
// Beispieltext und wären dadurch fälschlich in den langsamen Topf gewandert
// (nachgesehen am 05.09.2026). Kommt eine dazu, gehört sie hier hinein.
const AM_NETZ = new Set([
  'pruefe-kopfzeilen.mjs',
]);

const LANGSAM_WENN = [
  /chrome\.mjs/,            // Chrome im Kopflos-Betrieb
  /firefox\.mjs/,           // Firefox fernsteuern
  /server\.mjs/,            // eigener Testserver hochfahren
  /--headless/,             // Chrome direkt aufgerufen
  /puppeteer|playwright/,   // falls je dazukommt
  /https?:\/\/mausemaus\.com/, // misst die ECHTE Seite über das Netz
  /screenshot/i,
  /virtual-time-budget/,
];

// Ausnahmen: Dateien, die zwar nach Browser aussehen, aber keiner sind.
// (pruefe-formular.mjs ersetzt window.fetch und schickt bewusst nie etwas ab —
// aber falls sie doch Chrome startet, greift die Messung oben und sie wandert
// von selbst nach "langsam". Diese Liste ist nur für echte Fehleinordnungen.)
const IMMER_SCHNELL = new Set([
  // 'pruefe-irgendwas.mjs',
]);

async function einteilen() {
  const dateien = (await readdir(HIER))
    .filter((n) => n.startsWith('pruefe-') && n.endsWith('.mjs'))
    .sort();

  const schnell = [];
  const langsam = [];      // braucht Chrome
  const sehrLangsam = [];  // braucht Firefox oder das echte Netz

  for (const name of dateien) {
    if (IMMER_SCHNELL.has(name)) { schnell.push(name); continue; }
    const text = await readFile(join(HIER, name), 'utf8');
    if (AM_NETZ.has(name)) { sehrLangsam.push({ name, grund: 'misst die echte Seite' }); continue; }
    const teuer = SEHR_LANGSAM.find((r) => r.test(text));
    if (teuer) { sehrLangsam.push({ name, grund: 'startet Firefox' }); continue; }
    const grund = LANGSAM_WENN.find((r) => r.test(text));
    if (grund) langsam.push({ name, grund: String(grund) });
    else schnell.push(name);
  }
  return { schnell, langsam, sehrLangsam };
}

function laufen(name) {
  return new Promise((fertig) => {
    const start = Date.now();
    const kind = spawn(process.execPath, [join(HIER, name)], { stdio: 'pipe' });
    let ausgabe = '';
    kind.stdout.on('data', (d) => (ausgabe += d));
    kind.stderr.on('data', (d) => (ausgabe += d));
    kind.on('close', (code) => {
      fertig({ name, code, ausgabe, dauer: Date.now() - start });
    });
  });
}

/* Vor dem Lauf aufraeumen. Jede Pruefung belegt einen festen Port und
   startet einen eigenen kopflosen Browser. Bricht ein Lauf ab -- Strg+C,
   Zeitueberschreitung, geschlossenes Fenster --, ueberleben Server und
   Browser und blockieren den naechsten Lauf. Der Fehler sieht dann aus wie
   ein kaputter Test ("EADDRINUSE", 0,1 s rot) und ist keiner.
   Beobachtet am 05.09.2026 an pruefe-sprache.mjs. */
function aufraeumen() {
  for (const muster of ['tests/pruefe-', 'Google Chrome.*--headless']) {
    spawnSync('pkill', ['-f', muster], { stdio: 'ignore' });
  }
}

if (!NUR_LISTE) aufraeumen();

const { schnell, langsam, sehrLangsam } = await einteilen();

if (NUR_LISTE) {
  console.log(`\nSCHNELL (${schnell.length}) — Sekunden, nur Logik, kein Browser:`);
  for (const n of schnell) console.log('  ' + n);
  console.log(`\nMITTEL (${langsam.length}) — mit --mittel, brauchen Chrome:`);
  for (const { name } of langsam) console.log('  ' + name);
  console.log(`\nLANGSAM (${sehrLangsam.length}) — nur im vollen Lauf:`);
  for (const { name, grund } of sehrLangsam) console.log(`  ${name}   ${grund}`);
  console.log('');
  process.exit(0);
}

const auszufuehren = VOLL
  ? [...schnell, ...langsam.map((l) => l.name), ...sehrLangsam.map((l) => l.name)]
  : MITTEL
    ? [...schnell, ...langsam.map((l) => l.name)]
    : schnell;

console.log(
  VOLL
    ? `Voller Lauf — ${auszufuehren.length} Prüfungen. Das dauert.`
    : MITTEL
      ? `Mittlerer Lauf — ${auszufuehren.length} Prüfungen mit Chrome (${sehrLangsam.length} übersprungen: Firefox und echtes Netz).`
      : `Schneller Lauf — ${schnell.length} Prüfungen (${langsam.length + sehrLangsam.length} übersprungen, brauchen Browser/Netz).`
);

const ergebnisse = [];
for (const name of auszufuehren) {
  const e = await laufen(name);
  ergebnisse.push(e);
  const zeichen = e.code === 0 ? 'OK  ' : 'ROT ';
  console.log(`${zeichen} ${name}  (${(e.dauer / 1000).toFixed(1)}s)`);
  if (e.code !== 0) console.log(e.ausgabe.trim().split('\n').map((z) => '     ' + z).join('\n'));
}

const rot = ergebnisse.filter((e) => e.code !== 0);
const gesamt = (ergebnisse.reduce((s, e) => s + e.dauer, 0) / 1000).toFixed(1);

console.log(`\n${ergebnisse.length - rot.length}/${ergebnisse.length} grün, ${gesamt}s gesamt.`);

if (!VOLL && rot.length === 0) {
  const offen = auszufuehren.length;
  const gesamtzahl = schnell.length + langsam.length + sehrLangsam.length;
  console.log(`Hinweis: ${gesamtzahl - offen} Prüfungen liefen NICHT.`
    + (MITTEL ? ' Vor dem Hochladen: node tests/voll.mjs'
              : ' Bei Änderungen am Aussehen: node tests/schnell.mjs --mittel'));
}

process.exit(rot.length ? 1 : 0);
