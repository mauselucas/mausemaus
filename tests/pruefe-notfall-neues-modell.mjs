/* Prüft den Rückfall auf assets/seed.js (SEED_SEITEN, neues Modell
   seiten/bloecke) wirklich unter den Bedingungen, die im Auftrag verlangt
   sind: "mit unerreichbarer Datenbank in einer Kopie außerhalb des
   Projektordners" -- für Brief UND Welt-Seiten.

   Eine Kopie ist wichtig, nicht nur ein umgebogenes MM_CONFIG.url auf der
   laufenden Seite (das macht pruefe-brief.mjs bereits, aber NUR für
   settings/SEED_SETTINGS, dem alten Modell) -- eine frische Kopie hat
   garantiert KEINEN localStorage-Zwischenspeicher, trifft also wirklich
   die dritte, letzte Rückfallstufe (seed.js) und keine zweite (Browser-
   Zwischenspeicher). */
import { readFile, writeFile, cp, rm, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { starteChrome, oeffne, pruefe, bericht } from './chrome.mjs';
import { starteServer } from './server.mjs';

const quelle = new URL('../HOCHLADEN/', import.meta.url).pathname;

/* "außerhalb des Projektordners": ein System-Temp-Verzeichnis, garantiert
   nicht unterhalb dieses Repos. */
const kopie = await mkdtemp(join(tmpdir(), 'mausemaus-notfall-'));
await cp(quelle, kopie, { recursive: true });

/* Unerreichbare Datenbank: eine URL, an der garantiert nichts lauscht --
   kein DNS-Warten (anders als bei einer erfundenen Domain), der Verbindungs-
   aufbau scheitert sofort mit "connection refused". Port 65535 statt eines
   der ganz niedrigen Ports: Chrome blockiert bekannte "unsichere" Ports
   (1, 7, 9, …) selbst mit einem eigenen ERR_UNSAFE_PORT-Log-Eintrag, der
   sonst fälschlich als JavaScript-Fehler durchschlagen würde. */
const cfgPfad = join(kopie, 'assets', 'config.js');
const cfgAlt = await readFile(cfgPfad, 'utf8');
const cfgNeu = cfgAlt.replace(/url:\s*'[^']+'/, "url: 'http://127.0.0.1:65535'");
if (cfgNeu === cfgAlt) throw new Error('config.js in der Kopie konnte nicht umgeschrieben werden -- Abbruch.');
await writeFile(cfgPfad, cfgNeu);

const server = await starteServer({ wurzel: kopie, port: 8913 });
const chrome = await starteChrome({ port: 9353 });

/* ================= Brief (index.html) ================= */

const brief = await oeffne('http://127.0.0.1:8913/', { port: 9353, breite: 1280, hoehe: 900 });
await brief.warte(2500);   // die Kopie muss den Verbindungsversuch erst scheitern lassen
const briefHtml = await brief.werte(`document.getElementById('brief').innerHTML`);
pruefe('Brief-Seite zeigt trotz unerreichbarer Datenbank Inhalt (nicht leer)',
  briefHtml && briefHtml.trim().length > 200, 'Länge: ' + (briefHtml || '').length);
pruefe('…und zwar den ECHTEN Begrüßungstext aus seed.js (SEED_SEITEN.brief)',
  briefHtml.includes('Hallo ich bin'), briefHtml.slice(0, 200));
const briefKontakt = await brief.werte(`document.getElementById('brief').innerHTML.includes('lucasschoenwald03@gmail.com')`);
pruefe('…die Kontakt-Sektion aus dem Brief-Block ist ebenfalls da', briefKontakt === true);
/* "Failed to load resource ... ERR_CONNECTION_REFUSED" ist hier ERWÜNSCHTES
   Rauschen: genau das beweist, dass der Aufruf wirklich versucht und
   wirklich verweigert wurde -- kein echter Skriptfehler. Nur andere
   Meldungen (echte, unbehandelte Ausnahmen) zählen hier als Fehler. */
const echterFehler = (m) => !m.includes('Failed to load resource') && !m.includes('ERR_CONNECTION_REFUSED');
const briefFehler = brief.fehlerAufSeite().filter(echterFehler);
pruefe('keine ECHTEN JavaScript-Fehler auf der Brief-Seite (die verweigerte DB-Anfrage selbst zählt nicht)',
  briefFehler.length === 0, briefFehler.join(' | '));
await brief.zu();

/* ================= Welt-Seite (welt.html) ================= */

const welt = await oeffne('http://127.0.0.1:8913/welt/the-race-automatisierung',
  { port: 9353, breite: 1280, hoehe: 900 });
await welt.warte(2500);
/* Die Kopie läuft nicht hinter Netlify -- ohne die _redirects-Umschreibung
   simuliert zu haben, würde /welt/… 404 liefern. server.mjs bildet die
   Umschreibung aber nach (liest _redirects), das ist also der reguläre Weg. */
const weltTitel = await welt.werte(`document.querySelector('.welt-titel')?.textContent`);
pruefe('Welt-Seite zeigt trotz unerreichbarer Datenbank den ECHTEN Titel aus seed.js',
  weltTitel === 'Wie ich die Grafik-Pipeline von The Race automatisiert habe', weltTitel);
const weltText = await welt.werte(`document.querySelector('.welt-text')?.textContent || ''`);
pruefe('…und echten Blockinhalt (z. B. die Überschrift "Das Werkzeug")',
  weltText.includes('Das Werkzeug'), weltText.slice(0, 160));
const weltFehler = welt.fehlerAufSeite().filter(echterFehler);
pruefe('keine ECHTEN JavaScript-Fehler auf der Welt-Seite (die verweigerte DB-Anfrage selbst zählt nicht)',
  weltFehler.length === 0, weltFehler.join(' | '));
await welt.zu();

/* ================= GEGENBEWEIS: leere Notfall-Daten -> Prüfung würde fallen ================= */
/* Beweist, dass die obigen Prüfungen nicht blind bestehen, egal was
   passiert: mit ABSICHTLICH geleerten SEED_SEITEN muss der Brief leer
   bleiben und die Welt-Seite "nichts gefunden" zeigen. */
const seedPfad = join(kopie, 'assets', 'seed.js');
await writeFile(seedPfad, (await readFile(seedPfad, 'utf8')) + '\nwindow.SEED_SEITEN = { brief: null, projekte: [], welten: [] };\n');

const briefKaputt = await oeffne('http://127.0.0.1:8913/', { port: 9353, breite: 1280, hoehe: 900 });
await briefKaputt.warte(2500);
const briefHtmlKaputt = await briefKaputt.werte(`document.getElementById('brief').innerHTML`);
pruefe('GEGENBEWEIS: mit geleerten Notfall-Daten bleibt der Brief leer (die obige Prüfung ist also nicht blind)',
  !briefHtmlKaputt || briefHtmlKaputt.trim().length === 0, 'Länge: ' + (briefHtmlKaputt || '').length);
await briefKaputt.zu();

const weltKaputt = await oeffne('http://127.0.0.1:8913/welt/the-race-automatisierung',
  { port: 9353, breite: 1280, hoehe: 900 });
await weltKaputt.warte(2500);
const weltTitelKaputt = await weltKaputt.werte(`document.querySelector('.welt-titel')?.textContent`);
pruefe('GEGENBEWEIS: mit geleerten Notfall-Daten zeigt die Welt-Seite "Hier ist nichts" statt des echten Titels',
  weltTitelKaputt === 'Hier ist nichts.', weltTitelKaputt);
await weltKaputt.zu();

chrome.beenden(); server.beenden();
await rm(kopie, { recursive: true, force: true });
bericht();
