/* Räumt die Seite fürs Veröffentlichen auf: alle Kommentare raus aus HTML,
   CSS und JavaScript, einheitlich formatiert. Im Repo bleiben die
   Kommentare stehen -- sie erklären der nächsten Sitzung, WARUM etwas so
   gebaut ist. Online geht nur die aufgeräumte Fassung.

     node tests/aufraeumen.mjs HOCHLADEN _site

   Läuft auf GitHub bei jedem Push (.github/workflows/veroeffentlichen.yml)
   und in tests/pruefe-aufraeumen.mjs, die die aufgeräumte Seite im Browser
   gegen das Original prüft.

   Das eigentliche Entfernen macht esbuild (ein echter JS/CSS-Leser, kein
   Suchen-und-Ersetzen: "//" in einer Adresse oder "/*" in einem Text bleibt
   heil). Fremder Code bleibt unangetastet: vendor/ (Lizenzhinweise müssen
   drinbleiben) und die schon verkleinerte scroll-timeline.js. */
import { cp, readFile, writeFile, readdir, rm, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, extname, relative } from 'node:path';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ESBUILD = 'esbuild@0.24.2';
const werkzeugOrdner = fileURLToPath(new URL('./.werkzeug/', import.meta.url));

function ladeEsbuild() {
  const req = createRequire(join(werkzeugOrdner, 'x.js'));
  try { return req('esbuild'); } catch {}
  execSync(`npm install --no-save --no-audit --no-fund --prefix "${werkzeugOrdner}" ${ESBUILD}`, { stdio: 'ignore' });
  return req('esbuild');
}

const FREMD = (pfad) => /(^|\/)vendor\//.test(pfad) || /\.min\.(m?js|css)$/.test(pfad) || /scroll-timeline\.js$/.test(pfad);

export async function aufraeumen(quelle, ziel) {
  const esbuild = ladeEsbuild();
  /* Zwei Durchgänge: Der erste presst alles zusammen -- nur so fallen
     WIRKLICH alle Kommentare (ohne das lässt esbuild manche stehen). Der
     zweite setzt es wieder lesbar mit Einrückung. Namen bleiben, wie sie
     sind; es wird nichts umbenannt oder umgebaut. */
  const durch = (loader) => (code) => {
    const o = { loader, legalComments: 'none', charset: 'utf8' };
    const flach = esbuild.transformSync(code, { ...o, minifyWhitespace: true }).code;
    return esbuild.transformSync(flach, o).code;
  };
  const js = durch('js'), css = durch('css');

  /* Inline-Skripte und -Stile im HTML gehen durch dieselben Leser; HTML-
     Kommentare außerhalb davon fliegen raus. Steht ein Kommentar allein
     auf seiner Zeile, verschwindet die ganze Zeile mit. */
  const html = (text) => {
    const teile = text.split(/(<script\b[^>]*>[\s\S]*?<\/script>|<style\b[^>]*>[\s\S]*?<\/style>)/i);
    return teile.map((t, i) => {
      if (i % 2 === 0) {
        return t.replace(/^[ \t]*<!--[\s\S]*?-->[ \t]*\r?\n/gm, '').replace(/<!--[\s\S]*?-->/g, '');
      }
      const m = t.match(/^(<(script|style)\b([^>]*)>)([\s\S]*?)(<\/\2>)$/i);
      const [, auf, art, attr, inhalt, zu] = m;
      if (!inhalt.trim()) return t;
      const einzug = (t0) => '\n' + t0.trim().split('\n').map(z => z ? '  ' + z : z).join('\n') + '\n';
      if (art.toLowerCase() === 'style') return auf + einzug(css(inhalt)) + zu;
      const typ = (attr.match(/type\s*=\s*["']?([^"'\s>]+)/i) || [])[1] || '';
      if (/json/i.test(typ)) return auf + JSON.stringify(JSON.parse(inhalt)) + zu;
      if (typ && !/^(module|text\/javascript)$/i.test(typ)) return t;
      return auf + einzug(js(inhalt)) + zu;
    }).join('').replace(/\n{3,}/g, '\n\n');
  };

  await rm(ziel, { recursive: true, force: true });
  await mkdir(ziel, { recursive: true });
  await cp(quelle, ziel, { recursive: true });

  const bearbeitet = [];
  async function gehe(ordner) {
    for (const e of await readdir(ordner, { withFileTypes: true })) {
      const pfad = join(ordner, e.name);
      if (e.isDirectory()) { await gehe(pfad); continue; }
      const rel = relative(ziel, pfad);
      if (FREMD(rel)) continue;
      const endung = extname(e.name).toLowerCase();
      const umwandeln = { '.js': js, '.mjs': js, '.css': css, '.html': html, '.svg': html }[endung];
      if (!umwandeln) continue;
      const vorher = await readFile(pfad, 'utf8');
      try {
        await writeFile(pfad, umwandeln(vorher));
      } catch (f) {
        throw new Error(`Aufräumen fehlgeschlagen bei ${rel}: ${f.message}`);
      }
      bearbeitet.push(rel);
    }
  }
  await gehe(ziel);
  return bearbeitet;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [quelle = 'HOCHLADEN', ziel = '_site'] = process.argv.slice(2);
  if (!existsSync(quelle)) { console.error('Ordner fehlt: ' + quelle); process.exit(1); }
  const liste = await aufraeumen(quelle, ziel);
  console.log(`${liste.length} Dateien aufgeräumt -> ${ziel}`);
}
