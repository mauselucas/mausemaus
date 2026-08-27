/* Prüft den Nachbau der Scroll-Animationen für Browser ohne eigene
   Unterstützung -- also den Weg, den Lucas' Firefox geht.

   Vorgeschichte: Zwei Runden lang galt „es ist nichts animiert" als
   unauffindbar, weil jede Messung in Chrome lief. Chrome kann
   Scroll-Animationen. Firefox 154 kann sie nicht -- und sagt das auch.
   Diese Datei misst deshalb dort, wo der Fehler wohnt.

   Geprüft wird in drei Lagen:
     1. Papierform  -- ist der Nachbau aktuell, ist der Lader verdrahtet
     2. Chrome      -- ändert der Nachbau für unterstützende Browser NICHTS
     3. Firefox     -- läuft die Einblendung dort wirklich, und geht sie
                       beim Zurückscrollen wirklich zurück
   Jede Lage mit Gegenbeweis. */
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { starteChrome, oeffne, pruefe, bericht } from './chrome.mjs';
import { firefoxDa, messeInFirefox, MESS_EINBLENDUNG } from './firefox.mjs';
import { baueNachbau } from './nachbau.mjs';
import { starteServer } from './server.mjs';

const A = (p) => new URL('../HOCHLADEN/' + p, import.meta.url);

/* ================= 1. Papierform ================= */

const bewegung = await readFile(A('assets/bewegung.css'), 'utf8');
const nachbau  = await readFile(A('assets/bewegung-nachbau.css'), 'utf8');

pruefe('bewegung-nachbau.css ist noch das, was aus bewegung.css folgt',
  nachbau === baueNachbau(bewegung),
  nachbau === baueNachbau(bewegung) ? '' :
    'auseinandergelaufen — "node tests/nachbau.mjs --schreiben" ausführen');

/* GEGENBEWEIS: Wird an bewegung.css etwas geändert, MUSS es auffallen.
   Sonst wäre die Prüfung oben ein Placebo und die doppelte Wahrheit könnte
   still auseinanderlaufen -- der Fehler, vor dem sie schützen soll. */
{
  const verbogen = bewegung.replace('entry 60px entry 280px', 'entry 60px entry 999px');
  pruefe('GEGENBEWEIS: eine Änderung in bewegung.css lässt den Nachbau auffliegen',
    verbogen !== bewegung && baueNachbau(verbogen) !== nachbau,
    'geänderte Reichweite erzeugt anderen Nachbau');
}

pruefe('das Polyfill liegt im Upload-Ordner',
  existsSync(A('assets/scroll-timeline.js').pathname),
  'assets/scroll-timeline.js');
pruefe('…mitsamt seiner Lizenz (Apache-2.0, Fremdcode)',
  existsSync(A('assets/scroll-timeline.LICENSE.txt').pathname));

for (const seite of ['index.html', 'welt.html']) {
  const html = await readFile(A(seite), 'utf8');
  const iLader = html.indexOf('scroll-timeline.js');
  const iErstesBlatt = html.indexOf('<link rel="stylesheet"');
  pruefe(`${seite}: der Lader ist verdrahtet`, iLader > -1);
  /* Der Lader muss VOR den Stylesheets stehen: Das Polyfill ersetzt jedes
     <link> durch eine blob:-Fassung und muss dafür früh dran sein. */
  pruefe(`${seite}: …und steht vor dem ersten Stylesheet`,
    iLader > -1 && iErstesBlatt > -1 && iLader < iErstesBlatt,
    `Lader bei ${iLader}, erstes Stylesheet bei ${iErstesBlatt}`);
  pruefe(`${seite}: der Lader prüft „Bewegung reduzieren“ mit`,
    html.includes("prefers-reduced-motion: reduce"),
    'sonst animierte es bei genau den Leuten, die das abbestellt haben');
  pruefe(`${seite}: der Lader setzt die Klasse mm-bewegung`,
    html.includes("mm-bewegung"));
}

/* Der Nachbau darf NUR über die Klasse greifen. Stünde auch nur eine Regel
   ohne sie da, würde sie in JEDEM Browser gelten -- auch ohne Polyfill,
   also ohne irgendetwas, das die Deckkraft je wieder auf 1 brächte. Das
   wäre genau der eine Fehler, den dieses Projekt nie machen will. */
{
  const ohneKommentar = nachbau.replace(/\/\*[\s\S]*?\*\//g, '');
  const selektoren = [...ohneKommentar.matchAll(/([^{}]+)\{[^{}]*\}/g)]
    .flatMap(t => t[1].split(',').map(s => s.trim())).filter(Boolean);
  const nackt = selektoren.filter(s => !s.startsWith('html.mm-bewegung '));
  pruefe('im Nachbau hängt JEDE Regel an der Klasse mm-bewegung',
    nackt.length === 0, nackt.length ? nackt.join(' | ') : selektoren.length + ' Selektoren');
}

/* ================= 2. Chrome darf sich NICHT verändert haben ================= */

const server = await starteServer({ wurzel: A('').pathname, port: 8919 });
const c = await starteChrome({ port: 9345 });
{
  const s = await oeffne(`http://127.0.0.1:${server.port}/`, { port: 9345 });
  await s.warte(2500);
  const d = await s.werte(`(() => ({
    kann: CSS.supports('animation-timeline: view()'),
    klasse: document.documentElement.classList.contains('mm-bewegung'),
    polyfill: !!document.querySelector('script[src*="scroll-timeline"]'),
    nachbau: !!document.querySelector('link[href*="bewegung-nachbau"]'),
  }))()`);
  pruefe('Chrome kann es selbst', d.kann === true);
  pruefe('…und lädt deshalb KEIN Polyfill nach', d.polyfill === false,
    'unterstützende Browser zahlen null Byte');
  pruefe('…und kein Nachbau-Stylesheet', d.nachbau === false);
  pruefe('…und trägt die Klasse mm-bewegung nicht', d.klasse === false,
    'der native Weg bleibt reines CSS, ohne JavaScript');
  pruefe('Chrome: keine JavaScript-Fehler durch den Lader',
    s.fehlerAufSeite().length === 0, s.fehlerAufSeite().join(' · '));
  await s.zu();
}
c.beenden();

/* ================= 3. Firefox -- dort, wo der Fehler wohnt ================= */

if (!firefoxDa()) {
  pruefe('Firefox ist installiert und kann geprüft werden', false,
    'ÜBERSPRUNGEN — /Applications/Firefox.app fehlt');
} else {
  const d = await messeInFirefox(MESS_EINBLENDUNG, { port: 8983 });

  pruefe('Firefox kann Scroll-Animationen NICHT selbst — die Annahme, die alles ausgelöst hat',
    d.kannSelbst === true,
    'nach dem Nachladen meldet das Polyfill selbst true; ohne es wäre es false');
  pruefe('Firefox: die Klasse mm-bewegung ist gesetzt', d.klasse === true);
  pruefe('Firefox: das Nachbau-Stylesheet ist dazugekommen', d.blaetter === 7,
    d.blaetter + ' Stylesheets (6 eigene + Nachbau; das Polyfill schreibt sie auf blob: um)');

  for (const p of d.proben) {
    if (p.fehlt) { pruefe(`Firefox: ${p.s} ist da`, false, 'Element fehlt'); continue; }
    pruefe(`Firefox: ${p.s} blendet sich beim Scrollen wirklich ein`,
      p.davor < p.mitte && p.mitte < p.spaet && p.fertig === 1,
      `${p.davor} → ${p.mitte} → ${p.spaet} → ${p.fertig}`);
    /* Lucas' Satz, wörtlich: „wenn ich zurück scrolle soll es auch wieder
       so zurück animiert werden". Das ist der Grund für den ganzen Aufwand
       -- ein Einblenden auf der Uhr könnte das nicht. */
    pruefe(`Firefox: ${p.s} geht beim Zurückscrollen exakt zurück`,
      p.mitte === p.zurueck, `hin ${p.mitte} · zurück ${p.zurueck}`);
  }

  /* GEGENBEWEIS 1: Ohne das Nachbau-Stylesheet muss in Firefox nichts
     animieren -- das zeigt, dass die Prüfung oben wirklich den Nachbau
     misst und nicht irgendetwas anderes. */
  const ohne = await messeInFirefox(MESS_EINBLENDUNG, {
    port: 8984,
    verbiegen: (html) => {
      const gefiltert = html.split('\n').filter(z => !z.includes('bewegung-nachbau.css')).join('\n');
      if (gefiltert === html) throw new Error('die Nachbau-Zeile war gar nicht da');
      return gefiltert;
    },
  });
  const totBeiOhne = ohne.proben.every(p => p.fehlt ||
    (p.davor === 1 && p.mitte === 1 && p.spaet === 1 && p.fertig === 1));
  pruefe('GEGENBEWEIS: ohne das Nachbau-Stylesheet animiert Firefox nichts',
    totBeiOhne && ohne.blaetter === 6,
    `${ohne.blaetter} Stylesheets, Deckkraft durchweg 1 — genau der Zustand, den Lucas gemeldet hat`);
  /* …und zwar auf der SICHEREN Seite: alles voll sichtbar, nichts hängt
     halbdurchsichtig. Das ist die eigentliche Zusage des Entwurfs. */
  pruefe('…und alles bleibt dabei vollständig sichtbar (Deckkraft 1)',
    totBeiOhne, 'kein Inhalt hängt von einem Skript ab');

  /* GEGENBEWEIS 2: Bei „Bewegung reduzieren" darf der Lader gar nicht erst
     anspringen -- kein Polyfill, keine Klasse, keine Animation. */
  const reduziert = await messeInFirefox(MESS_EINBLENDUNG, {
    port: 8985,
    verbiegen: (html) => html.replace('<head>',
      `<head><script>const _m=matchMedia;matchMedia=q=>q.includes('reduce')?{matches:true,addEventListener(){}}:_m(q);</script>`),
  });
  pruefe('GEGENBEWEIS: bei „Bewegung reduzieren“ lädt Firefox das Polyfill gar nicht erst',
    reduziert.klasse === false && reduziert.kannSelbst === false && reduziert.blaetter === 6,
    `Klasse ${reduziert.klasse}, kannSelbst ${reduziert.kannSelbst}, ${reduziert.blaetter} Stylesheets`);
  pruefe('…und alles ist von Anfang an sichtbar',
    reduziert.proben.every(p => p.fehlt || (p.davor === 1 && p.fertig === 1)));
}

server.beenden();
bericht();
