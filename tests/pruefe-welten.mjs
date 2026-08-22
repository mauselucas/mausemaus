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
/* ACHTUNG, hier steckt die Falle:
   Ein <link>-Tag zu zählen beweist NICHTS. Es steht auch dann im Dokument,
   wenn die Datei nie geladen wurde. Und weil die Umschreibungsregel früher
   mit `*` alles unter /welt/ einfing, bekam selbst ein falscher Pfad eine
   Erfolgsmeldung mit HTML zurück — der Browser legte brav vier leere
   Stylesheet-Objekte an. Gemessen werden muss die WIRKUNG:
   Regeln vorhanden, und die Farbe wirklich gesetzt.
   Ebenso wenig taugt document.fonts.check(): Es findet auch Schriften, die
   auf dem Rechner installiert sind — auf diesem Mac liegt eine namens
   "Tropi Land". Stattdessen nachsehen, ob die Schrift aus einer
   @font-face-Regel der Seite stammt. */
const d = JSON.parse(await s.werte(`JSON.stringify({
  titel: document.title,
  grund: getComputedStyle(document.getElementById('welt')).backgroundColor,
  schrift: [...document.fonts].some(f => f.family === 'Tropi'),
  ueberschrift: (document.querySelector('.welt-titel')||{}).textContent || '',
  regeln: [...document.styleSheets].reduce((n, b) => {
    try { return n + b.cssRules.length; } catch { return n; } }, 0),
  zurueck: !!document.querySelector('.welt-zurueck')
})`));

pruefe('Welt lädt unter /welt/' + slug, !d.titel.includes('Nicht gefunden'), d.titel);
pruefe('CSS greift unter tiefer Adresse — Regeln sind wirklich da',
  d.regeln > 50, d.regeln + ' CSS-Regeln');
pruefe('CSS wirkt unter tiefer Adresse — Untergrund ist gesetzt',
  d.grund !== 'rgba(0, 0, 0, 0)' && d.grund !== 'transparent', d.grund);
pruefe('Schrift kommt aus fonts.css, nicht vom Rechner', d.schrift);
pruefe('Überschrift vorhanden', d.ueberschrift.length > 0, d.ueberschrift);
pruefe('Rückweg in den Brief vorhanden', d.zurueck);

/* Unbekannte Welt darf nicht abstürzen. */
const f = await oeffne('http://127.0.0.1:8905/welt/gibtesnicht', { port: 9337 });
await f.warte(2000);
pruefe('unbekannte Welt zeigt eine freundliche Seite',
  (await f.werte(`document.body.innerText`)).includes('Hier ist nichts'));

await s.zu(); await f.zu(); chrome.beenden(); server.beenden();
bericht();
