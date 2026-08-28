/* GitHub-Pages-Nachbau: statische Dateien, aufgeloest in genau der
   Reihenfolge, die der echte Hoster verwendet.

   Frueher stand hier ein NETLIFY-Nachbau, der die Umschreibungen aus
   _redirects auswertete. Seit dem Umzug ist das falsch: GitHub Pages liest
   _redirects nicht -- die Datei war eine gewoehnliche, wirkungslose Textdatei
   im Ausgabeordner. Der Nachbau haette also etwas geprueft, was die
   Wirklichkeit gar nicht tut.

   Die Reihenfolge unten ist am 28.08.2026 an der echten Seite gemessen,
   nicht aus der Dokumentation abgeschrieben:

     /welt   -> 200   (welt.html gewinnt, obwohl es auch einen Ordner gibt)
     /welt/  -> 404   (Ordner ohne index.html)
     /blog   -> 301 auf /blog/   (kein blog.html, also Ordner-Umleitung)

   Daraus ergibt sich: erst die genaue Datei, dann <pfad>.html, DANN erst der
   Ordner. Das ".html" hat Vorrang vor dem Ordner -- deshalb funktionieren
   /welt/<slug> und /blog/<slug> ohne jede Umschreibungsregel. */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';

const TYPEN = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8',
  '.js':'text/javascript; charset=utf-8', '.mjs':'text/javascript; charset=utf-8',
  '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png',
  '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.webp':'image/webp', '.gif':'image/gif',
  '.mp4':'video/mp4', '.webm':'video/webm',
  '.woff2':'font/woff2', '.txt':'text/plain; charset=utf-8', '.xml':'application/xml' };

const istDatei = async (p) => { try { return (await stat(p)).isFile(); } catch { return false; } };
const istOrdner = async (p) => { try { return (await stat(p)).isDirectory(); } catch { return false; } };

export async function starteServer({ wurzel, port = 8901 }) {
  const s = createServer(async (req, res) => {
    const pfad = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const roh = join(wurzel, pfad);
    let datei = null;

    if (pfad.endsWith('/')) {
      /* Mit Schraegstrich am Ende sucht GitHub Pages NUR die index.html des
         Ordners -- kein Anhaengen von ".html", keine Umleitung mehr. */
      if (await istDatei(join(roh, 'index.html'))) datei = join(roh, 'index.html');
    } else if (await istDatei(roh)) {
      datei = roh;
    } else if (await istDatei(roh + '.html')) {
      datei = roh + '.html';                       /* VOR dem Ordner, gemessen */
    } else if (await istOrdner(roh)) {
      res.writeHead(301, { Location: pfad + '/' }); return res.end();
    }

    if (!datei) {
      /* Eigene 404-Seite mit dem RICHTIGEN Statuscode -- eine 404-Seite, die
         200 meldet, laesst Suchmaschinen die Fehlerseite indexieren. */
      try {
        const inhalt = await readFile(join(wurzel, '404.html'));
        res.writeHead(404, { 'Content-Type': TYPEN['.html'] });
        return res.end(inhalt);
      } catch { res.writeHead(404); return res.end('weg'); }
    }

    try {
      const inhalt = await readFile(datei);
      res.writeHead(200, { 'Content-Type': TYPEN[extname(datei)] || 'application/octet-stream' });
      res.end(inhalt);
    } catch { res.writeHead(404); res.end('weg'); }
  });

  await new Promise(r => s.listen(port, r));
  return { port, beenden: () => s.close() };
}
