/* Prueft, was tests/hochladen.mjs vorbaut: die Teilen-Vorschau der Welten,
   die sitemap und das Wegerecht in _redirects.

   WARUM das ueberhaupt geprueft werden muss: welt.html setzt seine
   og-Angaben erst im Browser. Google fuehrt JavaScript aus, WhatsApp,
   LinkedIn, Slack und Twitter aber NICHT -- deren Vorschau liest nur den
   rohen Quelltext. Ob dort die richtigen Angaben stehen, sieht man einer
   im Browser geoeffneten Seite nicht an. Deshalb wird hier bewusst der
   ROHE Text geprueft, ohne Browser: genau so, wie ein Vorschau-Dienst
   ihn sieht.

   Braucht kein Netz: die Vergleichsdaten kommen aus dem seed.js, das
   hochladen.mjs im selben Lauf aus derselben Quelle geschrieben hat --
   damit faellt zugleich auf, wenn seed.js und die vorgebauten Seiten
   auseinanderlaufen. */

import { readFile, readdir } from 'node:fs/promises';
import { pruefe, bericht } from './chrome.mjs';
import { starteServer } from './server.mjs';

const HOCH = new URL('../HOCHLADEN/', import.meta.url);
const lies = (p) => readFile(new URL(p, HOCH), 'utf8');

/* seed.js ist eine Browser-Datei (window.…) -- fuer Node ein window erfinden. */
const seedRoh = await lies('./assets/seed.js');
const fenster = {};
new Function('window', seedRoh)(fenster);
const welten = (fenster.SEED_SEITEN || {}).welten || [];

pruefe('seed.js enthält mindestens eine Welt', welten.length > 0, welten.length + ' Welten');

/* ---------- 1. Vorgebaute Seiten ---------- */

const dateien = await readdir(new URL('./welt/', HOCH)).catch(() => []);
pruefe('für jede veröffentlichte Welt gibt es eine vorgebaute Seite',
  welten.every(w => dateien.includes(w.slug + '.html')),
  dateien.join(', '));
pruefe('keine verwaisten vorgebauten Seiten',
  dateien.filter(n => n.endsWith('.html')).length === welten.length,
  dateien.length + ' Dateien für ' + welten.length + ' Welten');

const wert = (html, muster) => (html.match(muster) || [])[1] || '';

for (const w of welten) {
  const html = await lies('./welt/' + w.slug + '.html');
  const kurz = w.slug.slice(0, 22);
  const erwarteterTitel = w.titel + ' — mausemaus';
  const adresse = 'https://mausemaus.com/welt/' + w.slug;

  pruefe(`[${kurz}] <title> steht schon im Quelltext`,
    wert(html, /<title>([^<]*)<\/title>/) === erwarteterTitel,
    wert(html, /<title>([^<]*)<\/title>/));
  pruefe(`[${kurz}] og:title trägt den echten Titel`,
    wert(html, /id="og-title"[^>]*/) && html.includes(`content="${erwarteterTitel.replace(/&/g,'&amp;')}" id="og-title"`)
      || wert(html, /<meta property="og:title" content="([^"]*)" id="og-title">/) === erwarteterTitel,
    wert(html, /<meta property="og:title" content="([^"]*)" id="og-title">/));
  pruefe(`[${kurz}] og:url und canonical zeigen auf die schöne Adresse`,
    wert(html, /<meta property="og:url" content="([^"]*)"/) === adresse &&
    wert(html, /<link rel="canonical" href="([^"]*)"/) === adresse,
    wert(html, /<meta property="og:url" content="([^"]*)"/));
  pruefe(`[${kurz}] og:image ist eine vollständige Adresse`,
    /^https?:\/\//.test(wert(html, /<meta property="og:image" content="([^"]*)"/)),
    wert(html, /<meta property="og:image" content="([^"]*)"/));
  pruefe(`[${kurz}] Twitter-Karte ist groß und trägt dieselben Angaben`,
    html.includes('content="summary_large_image"') &&
    wert(html, /<meta name="twitter:title" content="([^"]*)"/) === erwarteterTitel,
    wert(html, /<meta name="twitter:title" content="([^"]*)"/));
  /* Die vorgebaute Seite darf KEINE tote Kopie sein: sie muss den Inhalt
     weiterhin live aus der Datenbank holen, sonst zeigte sie ewig den
     Stand des letzten Hochladens. */
  pruefe(`[${kurz}] holt den Inhalt weiterhin live nach`,
    html.includes('mmLoadSeite') && html.includes('/assets/db.js'),
    'db.js + mmLoadSeite vorhanden');
  pruefe(`[${kurz}] kein Platzhalter aus der Vorlage übrig`,
    !html.includes('<title>mausemaus</title>'));
}

/* ---------- 2. sitemap.xml ---------- */

const sitemap = await lies('./sitemap.xml');
pruefe('sitemap nennt die Startseite', sitemap.includes('<loc>https://mausemaus.com/</loc>'));
pruefe('sitemap nennt jede veröffentlichte Welt',
  welten.every(w => sitemap.includes(`<loc>https://mausemaus.com/welt/${w.slug}</loc>`)));
pruefe('sitemap enthält nichts sonst',
  (sitemap.match(/<loc>/g) || []).length === welten.length + 1,
  (sitemap.match(/<loc>/g) || []).length + ' Adressen');
pruefe('sitemap nennt admin.html NICHT', !sitemap.includes('admin'));
pruefe('robots.txt verweist auf die sitemap',
  (await lies('./robots.txt')).includes('Sitemap: https://mausemaus.com/sitemap.xml'));

/* ---------- 3. Wegerecht ----------
   Der eigentliche Kern: liefert /welt/<slug> die VORGEBAUTE Seite oder die
   allgemeine welt.html? Nur ausdrueckliche Zeilen in _redirects entscheiden
   das zuverlaessig -- der Dateivorrang allein tut es im Nachbau messbar
   nicht (siehe Kommentar in hochladen.mjs). */

const server = await starteServer({ wurzel: HOCH.pathname, port: 8908 });
const titelVon = async (pfad) => {
  const r = await fetch('http://127.0.0.1:8908' + pfad);
  return wert(await r.text(), /<title>([^<]*)<\/title>/);
};

for (const w of welten) {
  pruefe(`[${w.slug.slice(0, 22)}] /welt/${w.slug} liefert die vorgebaute Seite`,
    (await titelVon('/welt/' + w.slug)) === w.titel + ' — mausemaus',
    await titelVon('/welt/' + w.slug));
}
pruefe('eine unbekannte Welt fällt weiter auf die Sammelregel zurück',
  (await titelVon('/welt/gibt-es-nicht')) === 'mausemaus',
  await titelVon('/welt/gibt-es-nicht'));
pruefe('die alte /blog/-Adresse führt ebenfalls auf die vorgebaute Seite',
  (await titelVon('/blog/' + welten[0].slug)) === welten[0].titel + ' — mausemaus',
  await titelVon('/blog/' + welten[0].slug));

server.beenden();
bericht();
