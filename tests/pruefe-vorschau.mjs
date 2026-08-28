/* Prueft, was tests/hochladen.mjs vorbaut: die Teilen-Vorschau der Welten,
   die sitemap und die Adressen.

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
import { starteChrome, oeffne, pruefe, bericht } from './chrome.mjs';
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
  const bild = wert(html, /<meta property="og:image" content="([^"]*)"/);
  pruefe(`[${kurz}] og:image ist eine vollständige Adresse`,
    /^https?:\/\//.test(bild), bild);
  /* WhatsApp, Facebook und LinkedIn zeigen WebP als Vorschau unzuverlaessig
     bis gar nicht -- und genau dieses Bild sieht, wer einen Projektlink
     bekommt. Auf der Seite selbst bleibt das WebP; nur die Vorschau wird
     zum JPEG (tests/hochladen.mjs). */
  pruefe(`[${kurz}] og:image ist ein JPEG, kein WebP`,
    /\.jpe?g(\?|$)/i.test(bild), bild.split('/').pop());
  pruefe(`[${kurz}] og:image und twitter:image sind dasselbe Bild`,
    wert(html, /<meta name="twitter:image" content="([^"]*)"/) === bild,
    wert(html, /<meta name="twitter:image" content="([^"]*)"/));
  /* Google nimmt fuer den Ausschnitt in den Ergebnissen bevorzugt DIESE
     Angabe, nicht og:description. */
  const beschreibung = wert(html, /<meta name="description" content="([^"]*)"/);
  pruefe(`[${kurz}] hat eine eigene meta description`,
    beschreibung.length > 0 && beschreibung !== 'Video Editor und Motion Designer in Köln.',
    beschreibung.slice(0, 60));
  pruefe(`[${kurz}] …die nicht laenger als 160 Zeichen ist`,
    beschreibung.length <= 160, beschreibung.length + ' Zeichen');
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

/* ---------- 3. Adressen ----------
   Der eigentliche Kern: liefert /welt/<slug> die VORGEBAUTE Seite oder die
   allgemeine welt.html? Frueher entschieden das ausdrueckliche Zeilen in
   _redirects. Diese Datei ist geloescht -- GitHub Pages hat sie nie gelesen.
   Es haengt jetzt allein daran, dass der Hoster von sich aus ".html" anhaengt.
   tests/server.mjs bildet genau das nach (an der echten Seite gemessen). */

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
pruefe('die alte /blog/-Adresse fuehrt ebenfalls auf die vorgebaute Seite',
  (await titelVon('/blog/' + welten[0].slug)) === welten[0].titel + ' — mausemaus',
  await titelVon('/blog/' + welten[0].slug));

/* Eine unbekannte Welt landet auf der 404-Seite -- mit dem richtigen
   Statuscode. Eine 404-Seite, die 200 meldet, laesst Suchmaschinen die
   Fehlerseite indexieren. */
const unbekannt = await fetch('http://127.0.0.1:8908/welt/gibt-es-nicht');
pruefe('eine unbekannte Welt antwortet mit Status 404', unbekannt.status === 404,
  'HTTP ' + unbekannt.status);

/* ---------- 4. Die Bruecke fuer frisch angelegte Welten ----------
   Legt Lucas im Admin eine Welt an, steht sie sofort im Brief -- die
   vorgebaute Datei entsteht aber erst beim naechsten Hochladen. Unter
   Netlify fing die Sammelregel das ab; GitHub Pages hat keine. Deshalb
   reicht 404.html solche Adressen an welt.html weiter, die den Inhalt live
   aus der Datenbank holt.

   Das braucht einen echten Browser: die Weiterleitung passiert in
   JavaScript, am rohen Quelltext sieht man sie nicht wirken. */

const chrome = await starteChrome({ port: 9355 });
const bekannt = welten[0].slug;
const b = await oeffne('http://127.0.0.1:8908/welt/' + bekannt + '-frisch-angelegt', { port: 9355 });
await b.warte(2500);
const gelandet = JSON.parse(await b.werte(`JSON.stringify({
  pfad: location.pathname, abfrage: location.search, titel: document.title,
  text: document.body.innerText.slice(0, 120)
})`));
pruefe('eine unbekannte Welt-Adresse wird an welt.html weitergereicht',
  gelandet.pfad !== '/404.html' && !gelandet.titel.includes('Nichts gefunden'),
  gelandet.pfad + gelandet.abfrage + ' — ' + gelandet.titel);
pruefe('…und welt.html zeigt dort ihre eigene freundliche Seite, keine Schleife',
  gelandet.text.includes('Hier ist nichts'), gelandet.text.replace(/\n/g, ' ').slice(0, 70));
await b.zu();

/* Und der Fall, um den es eigentlich geht: eine Welt, die es in der
   Datenbank GIBT, deren vorgebaute Datei aber fehlt. Nachgestellt, indem
   eine Adresse aufgerufen wird, die es als Datei nicht gibt -- mit dem Slug
   einer echten Welt in der Abfrage. */
const f = await oeffne('http://127.0.0.1:8908/welt.html?s=' + bekannt, { port: 9355 });
await f.warte(3000);
const frisch = JSON.parse(await f.werte(`JSON.stringify({
  titel: document.title, pfad: location.pathname, abfrage: location.search,
  ueberschrift: (document.querySelector('.welt-titel')||{}).textContent || ''
})`));
pruefe('eine noch nicht vorgebaute Welt laedt trotzdem ihren Inhalt',
  frisch.ueberschrift.length > 0 && !frisch.titel.includes('Nicht gefunden'),
  frisch.titel);
pruefe('…und die Adresse wird danach auf die schoene Form gebracht',
  frisch.pfad === '/welt/' + bekannt && frisch.abfrage === '',
  frisch.pfad + frisch.abfrage);
await f.zu();
chrome.beenden();

server.beenden();
bericht();
