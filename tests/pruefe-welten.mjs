import { starteChrome, oeffne, pruefe, bericht } from './chrome.mjs';
import { starteServer } from './server.mjs';

const wurzel = new URL('../HOCHLADEN/', import.meta.url).pathname;
const server = await starteServer({ wurzel, port: 8905 });
const chrome = await starteChrome({ port: 9337 });

/* Einen echten Slug aus der Datenbank holen. */
const start = await oeffne('http://127.0.0.1:8905/', { port: 9337 });
await start.warte(2500);
const slug = await start.werte(`window.mmLoadPosts().then(l => (l[0]||{}).slug || '')`);
await start.zu();
pruefe('mindestens eine Welt vorhanden', !!slug, slug);

const s = await oeffne('http://127.0.0.1:8905/welt/' + slug, { port: 9337 });
await s.warte(2500);
const d = JSON.parse(await s.werte(`JSON.stringify({
  titel: document.title,
  grund: getComputedStyle(document.getElementById('welt')).backgroundColor,
  schrift: document.fonts.check('16px Tropi'),
  ueberschrift: (document.querySelector('.welt-titel')||{}).textContent || '',
  stylesheets: [...document.styleSheets].length,
  zurueck: !!document.querySelector('.welt-zurueck')
})`));

pruefe('Welt lädt unter /welt/' + slug, !d.titel.includes('Nicht gefunden'), d.titel);
pruefe('CSS greift unter tiefer Adresse', d.stylesheets >= 4, d.stylesheets + ' Stylesheets');
pruefe('Schrift lädt unter tiefer Adresse', d.schrift);
pruefe('Überschrift vorhanden', d.ueberschrift.length > 0, d.ueberschrift);
pruefe('Rückweg in den Brief vorhanden', d.zurueck);

/* Unbekannte Welt darf nicht abstürzen. */
const f = await oeffne('http://127.0.0.1:8905/welt/gibtesnicht', { port: 9337 });
await f.warte(2000);
pruefe('unbekannte Welt zeigt eine freundliche Seite',
  (await f.werte(`document.body.innerText`)).includes('Hier ist nichts'));

await s.zu(); await f.zu(); chrome.beenden(); server.beenden();
bericht();
