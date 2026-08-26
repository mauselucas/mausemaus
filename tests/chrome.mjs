/* Chrome fernsteuern — ohne eine einzige fremde Abhängigkeit.
   Node bringt WebSocket seit v22 mit, Chrome spricht das DevTools-Protokoll. */
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
/* Das Chrome-Profil gehört NICHT unter tests/: Dieser Projektordner liegt
   auf dem Schreibtisch und wird mit iCloud abgeglichen. Die Ablage hält
   Dateien offen, das Aufräumen scheitert dann mit ENOTEMPTY und reißt den
   ganzen Prüflauf mit. Jeder Lauf bekommt deshalb ein eigenes Profil im
   Systemtemp — dort mischt sich niemand ein. */
const PROFIL = join(tmpdir(), 'mm-chrome-' + process.pid);

export async function starteChrome({ port = 9333 } = {}) {
  try { rmSync(PROFIL, { recursive: true, force: true }); } catch {}
  mkdirSync(PROFIL, { recursive: true });
  const p = spawn(CHROME, [
    '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${PROFIL}`,
    '--no-first-run', '--no-default-browser-check', '--disable-gpu', 'about:blank',
  ], { stdio: 'ignore' });

  for (let i = 0; i < 50; i++) {
    try { await fetch(`http://127.0.0.1:${port}/json/version`); return { port, beenden() {
        p.kill();
        /* Best effort: Ein liegengebliebener Temp-Ordner ist harmlos,
           ein abgebrochener Prüflauf nicht. */
        setTimeout(() => { try { rmSync(PROFIL, { recursive: true, force: true }); } catch {} }, 300);
      } }; }
    catch { await new Promise(r => setTimeout(r, 200)); }
  }
  throw new Error('Chrome ist nicht hochgekommen');
}

export async function oeffne(url, { port = 9333, breite = 1280, hoehe = 900 } = {}) {
  const ziel = await (await fetch(
    `http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' })).json();
  const ws = new WebSocket(ziel.webSocketDebuggerUrl);
  await new Promise(r => (ws.onopen = r));

  let n = 0; const offen = new Map(); const fehler = [];
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.id && offen.has(m.id)) { offen.get(m.id)(m); offen.delete(m.id); return; }
    /* Fehler der Seite mitschreiben. Log.entryAdded meldet auch Dateien, die
       nicht geladen werden konnten — genau der Fehler, der die Blog-Seiten
       schon einmal ohne CSS ausgeliefert hat. */
    if (m.method === 'Runtime.exceptionThrown')
      fehler.push(m.params?.exceptionDetails?.exception?.description
               || m.params?.exceptionDetails?.text || 'Ausnahme');
    if (m.method === 'Log.entryAdded' && m.params?.entry?.level === 'error')
      fehler.push(m.params.entry.text + (m.params.entry.url ? ' — ' + m.params.entry.url : ''));
  };
  const ruf = (method, params = {}) => new Promise(res => {
    const id = ++n; offen.set(id, res); ws.send(JSON.stringify({ id, method, params })); });

  await ruf('Page.enable'); await ruf('Runtime.enable'); await ruf('Log.enable');
  /* Feste Fenstergröße — sonst misst jeder Rechner etwas anderes.
     Unter 520 px liefert Chrome nur einen Ausschnitt, nie schmaler prüfen. */
  await ruf('Emulation.setDeviceMetricsOverride',
    { width: breite, height: hoehe, deviceScaleFactor: 1, mobile: breite < 768 });

  return {
    /* Fenstergröße MITTEN in einer laufenden Sitzung ändern (ohne neu zu
       laden) -- für Prüfungen, die einen Bildschirmwechsel (z.B. über die
       760px-Grenze) simulieren müssen, während die Seite offen bleibt. */
    async groesse(breiteNeu, hoeheNeu = hoehe) {
      await ruf('Emulation.setDeviceMetricsOverride',
        { width: breiteNeu, height: hoeheNeu, deviceScaleFactor: 1, mobile: breiteNeu < 768 });
    },
    /* Ein Medienmerkmal vortäuschen, z.B. "Bewegung reduzieren":
         await s.medien({ 'prefers-reduced-motion': 'reduce' })
       Das geht über das DevTools-Protokoll und wirkt auf ECHTE CSS-Regeln
       (@media). Der frühere Weg -- window.matchMedia auf der Seite
       überschreiben -- erreicht nur JavaScript und lässt CSS-Regeln kalt;
       für eine Gestaltung, die allein in CSS steht, wäre er wertlos.
       Ohne Argumente wird die Vortäuschung wieder aufgehoben. */
    async medien(merkmale = {}) {
      await ruf('Emulation.setEmulatedMedia', {
        features: Object.entries(merkmale).map(([name, value]) => ({ name, value })),
      });
    },
    async werte(ausdruck) {
      const r = await ruf('Runtime.evaluate',
        { expression: ausdruck, returnByValue: true, awaitPromise: true });
      if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description
        || r.result.exceptionDetails.text);
      return r.result.result.value;
    },
    warte: ms => new Promise(r => setTimeout(r, ms)),
    async bild(pfad) {
      const r = await ruf('Page.captureScreenshot', { format: 'png' });
      writeFileSync(pfad, Buffer.from(r.result.data, 'base64'));
      return pfad;
    },
    /* Alles, was die Seite an Fehlern gemeldet hat, seit sie geöffnet wurde. */
    fehlerAufSeite() { return fehler.slice(); },
    async zu() { ws.close(); await fetch(`http://127.0.0.1:${port}/json/close/${ziel.id}`); },
  };
}

/* ---- kleine Behauptungssammlung ---- */
const ergebnisse = [];
export function pruefe(name, bedingung, zusatz = '') {
  ergebnisse.push({ name, ok: !!bedingung, zusatz });
  console.log(`${bedingung ? '  ok  ' : ' FEHL '} ${name}${zusatz ? '  — ' + zusatz : ''}`);
}
export function bericht() {
  const schlecht = ergebnisse.filter(e => !e.ok);
  console.log(`\n${ergebnisse.length - schlecht.length} von ${ergebnisse.length} bestanden`);
  if (schlecht.length) { process.exitCode = 1; }
  return schlecht.length === 0;
}
