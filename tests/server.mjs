/* Netlify-Nachbau: statische Dateien plus die Umschreibungen aus _redirects. */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';

const TYPEN = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8',
  '.js':'text/javascript; charset=utf-8', '.mjs':'text/javascript; charset=utf-8',
  '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png',
  '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.webp':'image/webp', '.gif':'image/gif',
  '.woff2':'font/woff2', '.txt':'text/plain; charset=utf-8' };

async function regeln(wurzel) {
  try {
    const roh = await readFile(join(wurzel, '_redirects'), 'utf8');
    return roh.split('\n').map(z => z.trim())
      .filter(z => z && !z.startsWith('#'))
      .map(z => { const [von, nach, code] = z.split(/\s+/); return { von, nach, code: +(code || 301) }; });
  } catch { return []; }
}

export async function starteServer({ wurzel, port = 8901 }) {
  const liste = await regeln(wurzel);

  const s = createServer(async (req, res) => {
    const pfad = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let datei = join(wurzel, pfad);

    try { if ((await stat(datei)).isDirectory()) datei = join(datei, 'index.html'); }
    catch {
      /* keine Datei -> Umschreibungen durchgehen, wie Netlify es tut */
      const treffer = liste.find(r => {
        const muster = '^' + r.von.replace(/:[A-Za-z_]+/g, '[^/]+').replace(/\*/g, '.*') + '$';
        return new RegExp(muster).test(pfad);
      });
      if (treffer && treffer.code === 200) datei = join(wurzel, treffer.nach);
      else if (treffer) { res.writeHead(treffer.code, { Location: treffer.nach }); return res.end(); }
      else datei = join(wurzel, '404.html');
    }

    try {
      const inhalt = await readFile(datei);
      res.writeHead(datei.endsWith('404.html') ? 404 : 200,
        { 'Content-Type': TYPEN[extname(datei)] || 'application/octet-stream' });
      res.end(inhalt);
    } catch { res.writeHead(404); res.end('weg'); }
  });

  await new Promise(r => s.listen(port, r));
  return { port, beenden: () => s.close() };
}
