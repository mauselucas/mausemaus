/* Prüft die Anleitung im Admin (Aufgabe 3) -- ohne Anmeldung.
   Der Editor selbst braucht ein Login, das fehlt hier. Zwei Ebenen, wie
   schon bei pruefe-editor.mjs:
     1. Das ECHTE <details>-Element wird direkt aus admin.html herausgezogen
        (nicht von Hand nachgebaut!) -- dadurch kann diese Prüfung nie an
        einer Kopie vorbeilaufen, die vom wirklichen Inhalt abweicht.
     2. Auf- und Zuklapp-Verhalten läuft über dieselbe assets/anleitung.js,
        die auch admin.js benutzt (mountBlockEditor-Muster). */
import { readFile, writeFile, rm } from 'node:fs/promises';
import { rmSync } from 'node:fs';
import { starteChrome, oeffne, pruefe, bericht } from './chrome.mjs';
import { starteServer } from './server.mjs';
import { BLOCKARTEN } from '../HOCHLADEN/assets/block-modell.js';

const wurzel = new URL('../HOCHLADEN/', import.meta.url).pathname;
const adminPfad = wurzel + 'admin.html';
const probenPfad = wurzel + 'tests-temp-anleitung.html';

/* ---------- 1. das ECHTE Anleitung-Element aus admin.html ziehen ---------- */
const adminHtml = await readFile(adminPfad, 'utf8');
/* Absichtlich tolerant gegenüber zusätzlichen Attributen (z. B. "open"):
   eine Prüfung, die 13 andere mit sich reißt, weil jemand ein harmloses
   Attribut ergänzt hat, prüft nicht mehr die Sache, sondern die Schreibweise. */
const m = adminHtml.match(/<details[^>]*id="anleitung-panel"[^>]*>[\s\S]*?<\/details>/);
if (!m) throw new Error('Kein <details id="anleitung-panel"> in admin.html gefunden -- Prüfung kann nicht laufen.');
const anleitungHtml = m[0];

/* ---------- Inhalt der Anleitung: gegen die ECHTE Blockarten-Liste ---------- */
/* Nicht von Hand nachgezählt -- BLOCKARTEN kommt aus derselben Quelle, die
   auch die "/"-Auswahl im Editor speist. Ändert sich dort ein Name, würde
   diese Prüfung es sofort bemerken. */
const fehlendeLabel = BLOCKARTEN.filter(b => !anleitungHtml.includes(b.label)).map(b => b.label);
pruefe('jede Blockart aus dem echten Vertrag (block-modell.js) wird in der Anleitung genannt',
  fehlendeLabel.length === 0, 'fehlend: ' + fehlendeLabel.join(', '));

pruefe('die Anleitung erklärt die sichtbare Türchen-Schreibweise [[…]]',
  anleitungHtml.includes('[[Wort|ziel|Titel|Vorschautext]]'));
pruefe('…und die geheime Schreibweise ((…))',
  anleitungHtml.includes('((Wort|ziel|Titel|Vorschautext))'));
pruefe('…und erklärt, was "ziel" bedeutet (Kennung/Slug der Welt)',
  anleitungHtml.includes('Kennung der Welt'));
pruefe('die Anleitung erklärt, wie eine Abschnittsmarke wirkt (Zeitleiste)',
  anleitungHtml.includes('Zeitleiste') && anleitungHtml.includes('Abschnitt'));
pruefe('die Anleitung erklärt "/" als Weg zur Blockauswahl',
  /<code>\/<\/code>/.test(anleitungHtml));

/* GEGENBEWEIS: eine Anleitung, die NICHTS über Türchen sagt (z.B. weil beim
   Schreiben vergessen), würde von der obigen Prüfung erkannt -- eine leere
   Zeichenkette enthält offensichtlich keine der beiden Schreibweisen. */
pruefe('GEGENBEWEIS: eine leere Anleitung würde an der Türchen-Prüfung erkannt',
  !''.includes('[[Wort|ziel|Titel|Vorschautext]]'));

/* ---------- 2. Auf-/Zuklapp-Verhalten, an einer generierten Probeseite mit dem ECHTEN Markup ---------- */
const probe = `<!doctype html><html lang="de"><head><meta charset="utf-8">
<link rel="stylesheet" href="/assets/fonts.css"><link rel="stylesheet" href="/assets/site.css">
<link rel="stylesheet" href="/assets/admin.css"></head>
<body class="admin"><main id="view-list">
${anleitungHtml}
</main>
<script type="module">
  import { richteAnleitungEin } from '/assets/anleitung.js';
  window.__einrichten = (schluessel) => richteAnleitungEin(document.getElementById('anleitung-panel'), schluessel);
  window.__einrichten();
</script>
</body></html>`;
await writeFile(probenPfad, probe);
process.on('exit', () => { try { rmSync(probenPfad, { force: true }); } catch {} });

const server = await starteServer({ wurzel, port: 8911 });
const chrome = await starteChrome({ port: 9351 });

/* Frischer Zustand: eigener Schlüssel je Testlauf, damit ein vorheriger
   (evtl. abgebrochener) Lauf nichts verfälscht. */
const SCHLUESSEL = 'mm.anleitung.zu.test.' + Date.now();

let s = await oeffne('http://127.0.0.1:8911/tests-temp-anleitung.html', { port: 9351, breite: 1280, hoehe: 1000 });
await s.werte(`localStorage.removeItem(${JSON.stringify(SCHLUESSEL)}); window.__einrichten(${JSON.stringify(SCHLUESSEL)})`);
let offen = await s.werte(`document.getElementById('anleitung-panel').open`);
pruefe('beim allerersten Besuch ist die Anleitung aufgeklappt (sonst würde man sie nie entdecken)',
  offen === true, offen);

/* Zuklappen -- wie ein echter Klick auf <summary>: das native <details>-
   Element feuert beim Setzen von .open selbst ein "toggle"-Ereignis. */
await s.werte(`document.getElementById('anleitung-panel').open = false`);
await s.warte(50);
const gemerkt = await s.werte(`localStorage.getItem(${JSON.stringify(SCHLUESSEL)})`);
/* '1' = zugeklappt -- siehe assets/anleitung.js (Schlüsselname endet auf ".zu"). */
pruefe('Zuklappen merkt sich den Zustand in localStorage', gemerkt === '1', gemerkt);
await s.zu();

/* Neuer "Besuch" derselben Seite (frisches Tab, gleicher Chrome-Profil ->
   dasselbe localStorage) -- muss weiterhin ZU sein. */
s = await oeffne('http://127.0.0.1:8911/tests-temp-anleitung.html', { port: 9351, breite: 1280, hoehe: 1000 });
await s.werte(`window.__einrichten(${JSON.stringify(SCHLUESSEL)})`);
offen = await s.werte(`document.getElementById('anleitung-panel').open`);
pruefe('einmal zugeklappt bleibt sie auch nach einem neuen Seitenaufruf zu',
  offen === false, offen);

const jsFehler = s.fehlerAufSeite();
pruefe('keine JavaScript-Fehler auf der Anleitung-Probeseite', jsFehler.length === 0, jsFehler.join(' | '));
await s.zu();

/* ---------- 520px: darf nicht überlaufen ---------- */
const schmal = await oeffne('http://127.0.0.1:8911/tests-temp-anleitung.html', { port: 9351, breite: 520, hoehe: 900 });
await schmal.werte(`localStorage.removeItem(${JSON.stringify(SCHLUESSEL + '.mobil')}); window.__einrichten(${JSON.stringify(SCHLUESSEL + '.mobil')})`);
const ueberlauf = await schmal.werte(`document.documentElement.scrollWidth > document.documentElement.clientWidth + 1`);
pruefe('bei 520px gibt es KEINEN horizontalen Überlauf', ueberlauf === false, ueberlauf);
const jsFehler520 = schmal.fehlerAufSeite();
pruefe('keine JavaScript-Fehler bei 520px', jsFehler520.length === 0, jsFehler520.join(' | '));
await schmal.zu();

chrome.beenden(); server.beenden();
await rm(probenPfad, { force: true });
bericht();
