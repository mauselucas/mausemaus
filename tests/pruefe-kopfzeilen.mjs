/* Misst, was der Hoster WIRKLICH ausliefert -- an der oeffentlichen Seite,
   nicht an einer Datei im Projektordner.

   WARUM diese Pruefung existiert: Bis zum 28.08.2026 pruefte
   tests/pruefe-tempo.mjs den Inhalt von HOCHLADEN/_headers. Acht Pruefungen,
   alle gruen. Nur liest GitHub Pages diese Datei gar nicht -- sie stammt von
   Netlify. Die Seite lief also ohne jede Sicherheits-Kopfzeile und mit zehn
   Minuten Zwischenspeicher, waehrend die Pruefung ein Jahr und drei
   Schutzkopfzeilen meldete.

   Diese Datei haelt deshalb den ECHTEN Ist-Stand fest. Schlaegt sie an, hat
   sich am Hoster etwas geaendert -- und das wollen wir wissen, in beide
   Richtungen. Wird eine Erwartung hier besser als notiert, ist das kein
   Fehler, sondern eine Nachricht: dann gehoert der Wert nach oben korrigiert.

   Sie braucht Netz. Ohne Netz bricht sie mit Code 2 ab -- ausdruecklich
   unterscheidbar von "gemessen und falsch" (Code 1). */

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { pruefe, bericht } from './chrome.mjs';

const BASIS = 'https://mausemaus.com';

async function hole(pfad, optionen = {}) {
  try {
    return await fetch(BASIS + pfad, { redirect: 'manual', ...optionen });
  } catch (e) {
    console.error(`\nNICHT GEMESSEN: ${BASIS}${pfad} nicht erreichbar — ${e.message}`);
    console.error('Diese Pruefung braucht Netz. Nichts wurde geprueft, nichts ist widerlegt.');
    process.exit(2);
  }
}

/* ---------- 1. Die toten Netlify-Dateien sind weg und bleiben weg ---------- */

const HOCH = new URL('../HOCHLADEN/', import.meta.url);
for (const name of ['_headers', '_redirects']) {
  pruefe(`${name} liegt nicht mehr im Ausgabeordner`,
    !existsSync(new URL('./' + name, HOCH).pathname),
    'GitHub Pages liest die Datei nicht — sie taeuscht nur Wirkung vor');
}
/* Gegenprobe zur Pruefung oben: sie darf nicht deshalb gruen sein, weil der
   Ordner selbst fehlt oder falsch berechnet ist. */
pruefe('…und der Ordner, in dem sie fehlen, ist ueberhaupt der richtige',
  existsSync(new URL('./index.html', HOCH).pathname));

/* Auch der Nachbau darf sie nicht mehr auswerten -- sonst antworten Test und
   Wirklichkeit wieder unterschiedlich. */
const nachbau = await readFile(new URL('./server.mjs', import.meta.url), 'utf8');
pruefe('der Testserver bildet GitHub Pages nach, nicht Netlify',
  !nachbau.includes("readFile(join(wurzel, '_redirects')"),
  nachbau.includes('GitHub-Pages-Nachbau') ? 'GitHub-Pages-Nachbau' : 'unklar');

/* ---------- 2. Verschluesselung ---------- */

const start = await hole('/');
pruefe('die Startseite antwortet', start.status === 200, 'HTTP ' + start.status);

let unverschluesselt;
try {
  unverschluesselt = await fetch('http://mausemaus.com/', { redirect: 'manual' });
} catch (e) {
  console.error('\nNICHT GEMESSEN: http:// nicht erreichbar — ' + e.message);
  process.exit(2);
}
pruefe('http:// wird auf https:// umgeleitet',
  unverschluesselt.status === 301 &&
  (unverschluesselt.headers.get('location') || '').startsWith('https://'),
  unverschluesselt.status + ' → ' + unverschluesselt.headers.get('location'));

/* HSTS sagt dem Browser: diese Seite kuenftig NIE unverschluesselt aufrufen.
   Ohne die Kopfzeile geht der allererste Aufruf einmal ueber http und laesst
   sich unterwegs umbiegen -- die Umleitung oben schuetzt also erst ab dem
   zweiten Besuch vollstaendig.

   HIER STAND EINE FALSCHE BEHAUPTUNG: "GitHub Pages setzt sie, wenn
   'Enforce HTTPS' angehakt ist." Das stimmt nicht. Der Haken ist gesetzt,
   und die Kopfzeile kommt trotzdem nicht -- gemessen am 28.08.2026, und
   nicht nur hier: jekyllrb.com und electronjs.org laufen ebenfalls auf
   GitHub Pages mit eigener Domain und liefern sie genauso wenig. GitHub
   sendet HSTS nur auf *.github.io; ueber die Regeln einer fremden Domain
   will es nicht entscheiden. "Enforce HTTPS" bewirkt die Umleitung, mehr
   nicht.

   Damit ist HSTS auf diesem Hoster nicht erreichbar -- es braeuchte einen
   Dienst davor (Cloudflare o.ae.). Bewusst nicht gemacht.

   Diese Pruefung ist deshalb eine WACHE, keine Forderung: Kommt die
   Kopfzeile eines Tages doch, hat GitHub etwas geaendert, und dann gehoert
   dieser Block umgeschrieben statt weitergeschleppt. */
pruefe('bekannt und hingenommen: GitHub Pages setzt bei eigener Domain kein HSTS',
  !start.headers.get('strict-transport-security'),
  start.headers.get('strict-transport-security')
    ? 'ANGEKOMMEN: ' + start.headers.get('strict-transport-security') + ' — diese Pruefung gehoert jetzt umgeschrieben'
    : 'fehlt, wie erwartet — der Schutz liegt allein an der 301-Umleitung oben');

/* ---------- 3. Was GitHub Pages beim Zwischenspeichern tut ---------- */

const stil = await hole('/assets/site.css');
pruefe('ein Asset kommt als CSS an',
  (stil.headers.get('content-type') || '').startsWith('text/css'),
  stil.headers.get('content-type'));
pruefe('Assets tragen ueberhaupt eine Cache-Regel',
  !!stil.headers.get('cache-control'), stil.headers.get('cache-control'));
/* Der Ist-Stand: zehn Minuten. Das laesst sich bei GitHub Pages nicht
   einstellen -- ein Jahr, wie es die ?v=-Stempel erlauben wuerden, gaebe es
   nur mit einem Dienst davor. Festgehalten, damit wir es merken, wenn es
   sich aendert. */
pruefe('…und zwar die zehn Minuten, die GitHub Pages vorgibt',
  /max-age=600/.test(stil.headers.get('cache-control') || ''),
  stil.headers.get('cache-control'));
/* Der ETag ist der Grund, warum die zehn Minuten nicht wehtun: danach fragt
   der Browser nur nach und bekommt meist ein leeres "unveraendert" zurueck. */
pruefe('…und es gibt einen ETag, sonst waere das teuer', !!stil.headers.get('etag'),
  stil.headers.get('etag'));

const gepackt = await hole('/assets/seed.js', { headers: { 'Accept-Encoding': 'gzip' } });
pruefe('grosse Dateien kommen gepackt an',
  (gepackt.headers.get('content-encoding') || '').includes('gzip'),
  gepackt.headers.get('content-encoding') || 'ungepackt');

/* ---------- 4. Sicherheits-Kopfzeilen: der Ist-Stand ist "keine" ----------

   Ohne einen Dienst davor kann GitHub Pages keine eigenen Kopfzeilen setzen.
   Das hier ist bewusst KEINE Erfolgsmeldung, sondern eine Wache: Kommen die
   Kopfzeilen eines Tages doch an, hat jemand etwas umgestellt, und dann
   gehoert dieser Block umgeschrieben statt stillschweigend weitergeschleppt. */

const fehlend = ['x-frame-options', 'x-content-type-options', 'referrer-policy']
  .filter(k => !start.headers.get(k));
pruefe('bekannt und hingenommen: GitHub Pages setzt keine Sicherheits-Kopfzeilen',
  fehlend.length === 3,
  fehlend.length === 3 ? 'alle drei fehlen, wie erwartet'
    : 'ANGEKOMMEN: ' + ['x-frame-options', 'x-content-type-options', 'referrer-policy']
        .filter(k => start.headers.get(k)).join(', ') + ' — diese Pruefung gehoert jetzt umgeschrieben');

/* ---------- 5. Adressen: dass die schoenen Adressen ohne _redirects gehen ---------- */

for (const [pfad, erwartet] of [['/welt/verteidiger-isfj-t', 200], ['/blog/verteidiger-isfj-t', 200]]) {
  const r = await hole(pfad);
  pruefe(`${pfad} antwortet ohne jede Umschreibungsregel`, r.status === erwartet,
    'HTTP ' + r.status);
}
/* GEGENBEWEIS: Waere die Pruefung oben blind fuer Fehler, muesste auch eine
   erfundene Adresse "gruen" sein. Sie ist es nicht. */
const erfunden = await hole('/welt/gibt-es-wirklich-nicht-42');
pruefe('GEGENBEWEIS: eine erfundene Welt liefert wirklich 404',
  erfunden.status === 404, 'HTTP ' + erfunden.status);

/* ---------- 6. Fremde Skripte ---------- */

const inhalt = await readFile(new URL('./assets/inhalt.js', HOCH), 'utf8');
const quelle = (inhalt.match(/const HLJS = '([^']*)'/) || [])[1] || '';
/* "@11" waere ein bewegliches Ziel: was ausgefuehrt wird, koennte sich
   jederzeit aendern, ohne dass jemand etwas anfasst. */
pruefe('highlight.js haengt an einer festen Version, nicht an "@11"',
  /@\d+\.\d+\.\d+\//.test(quelle), (quelle.match(/@[^/]*/) || ['-'])[0]);
pruefe('…und wird gegen einen Hash geprueft (integrity)',
  /const HLJS_HASH = 'sha(256|384|512)-/.test(inhalt) && inhalt.includes('s.integrity = HLJS_HASH'),
  (inhalt.match(/sha\d+-[A-Za-z0-9+/=]{10}/) || ['fehlt'])[0] + '…');
/* Ohne crossorigin kann der Browser die Antwort nicht pruefen und fuehrt
   sie gar nicht erst aus -- integrity allein waere also sogar schaedlich. */
pruefe('…mit crossorigin, ohne das integrity gar nicht greift',
  inhalt.includes("s.crossOrigin = 'anonymous'"));

for (const name of ['index.html', 'welt.html']) {
  const h = await readFile(new URL('./' + name, HOCH), 'utf8');
  pruefe(`${name}: der Zaehler wird ueber https geholt, nicht protokollrelativ`,
    h.includes('https://gc.zgo.at/count.js') && !h.includes('"//gc.zgo.at'),
    h.includes('"//gc.zgo.at') ? '//gc.zgo.at (veraltet)' : 'https://');
}

bericht();
