/* Prüft, dass Breite und Bewegung (assets/bloecke.js, assets/site.css)
   auf der öffentlichen Seite sichtbar wirken -- UND dass sie für den ganz
   überwiegenden Bestand an Inhalt (Breite "normal", Bewegung "keine") am
   ausgelieferten HTML rein GAR NICHTS ändern. Letzteres ist der wichtigere
   Teil: die vier gesperrten Prüfungen (pruefe-bestand/leiste/brief/welten)
   verlassen sich darauf. */
import { existsSync, rmSync, symlinkSync } from 'node:fs';
import { starteChrome, oeffne, pruefe, bericht } from './chrome.mjs';
import { starteServer } from './server.mjs';

const feste = new URL('../HOCHLADEN/tests-feste', import.meta.url).pathname;
if (existsSync(feste)) rmSync(feste, { recursive: true, force: true });
symlinkSync(new URL('./feste', import.meta.url).pathname, feste, 'dir');
process.on('exit', () => rmSync(feste, { recursive: true, force: true }));

const wurzel = new URL('../HOCHLADEN/', import.meta.url).pathname;
const server = await starteServer({ wurzel, port: 8909 });
const chrome = await starteChrome({ port: 9349 });
const s = await oeffne('http://127.0.0.1:8909/tests-feste/baustein-probe.html',
  { port: 9349, breite: 1280, hoehe: 1000 });
await s.warte(200);

const block = (typ, inhalt, breite = 'normal', bewegung = 'keine') =>
  ({ typ, inhalt, breite, bewegung, sort_order: 1 });

/* ================= Standardfall: unverändert, byte-genau ================= */

{
  const roh = { roh: 'Ein ganz normaler Absatz.' };
  const ohneHuelle = await s.werte(`window.mm.renderMarkdown(${JSON.stringify(roh.roh)})`);
  await s.werte(`window.__zeichne([${JSON.stringify(block('text', roh))}], null)`);
  const html = await s.werte(`document.getElementById('ziel').innerHTML`);
  pruefe('Standard-Block (Breite normal, Bewegung keine) bekommt KEINE Hülle',
    !html.includes('mm-baustein'), html.slice(0, 120));
  pruefe('…und ist mit dem alten Umsetzer bytegleich (nur um den Abstands-Block ergänzt)',
    html.replace('<div id="abstand"></div>', '').trim() === ohneHuelle.trim());
}

/* GEGENBEWEIS: eine Hülle, die IMMER greift (auch im Standardfall), würde
   von der ersten Prüfung oben erkannt -- sie ist also kein Blindgänger. */
{
  const immerHuellen = (html) => '<div class="mm-baustein">' + html + '</div>';
  const kaputt = immerHuellen('<p>x</p>');
  pruefe('GEGENBEWEIS: eine Hülle ohne Ausnahme für den Standardfall würde erkannt',
    kaputt.includes('mm-baustein'));
}

/* ================= Breite wirkt sichtbar ================= */

{
  await s.werte(`window.__zeichne([${JSON.stringify(block('text', { roh: 'Schmaler Text.' }, 'schmal'))}], null)`);
  const klasse = await s.werte(`document.querySelector('.mm-baustein')?.className`);
  pruefe('Breite "schmal" erzeugt die Klasse mm-breite-schmal', (klasse || '').includes('mm-breite-schmal'), klasse);
  const breiteVoll = await s.werte(`document.getElementById('ziel').clientWidth`);
  const breiteBlock = await s.werte(`document.querySelector('.mm-breite-schmal').getBoundingClientRect().width`);
  pruefe('…und ist auf dem Bildschirm tatsächlich schmaler als die volle Spalte',
    breiteBlock < breiteVoll * 0.9, `${breiteBlock} < ${breiteVoll}`);
}

{
  await s.werte(`window.__zeichne([${JSON.stringify(block('text', { roh: 'Randnotiz-Breite.' }, 'randnotiz'))}], null)`);
  const el = await s.werte(`(() => { const e = document.querySelector('.mm-breite-randnotiz');
    return e ? { deckkraft: getComputedStyle(e).opacity, breite: e.getBoundingClientRect().width } : null; })()`);
  pruefe('Breite "randnotiz" ist schmaler und etwas leiser (geringere Deckkraft)',
    el && Number(el.deckkraft) < 1, JSON.stringify(el));
}

{
  /* Ein normaler Block direkt daneben zeigt die INNERE Kante (nach dem
     26px-Innenabstand von .br-spalte) -- das ist der richtige Vergleich,
     nicht die äußere Kante von .br-spalte selbst (dort liegt der
     voll-Block ohnehin genau, da er den Innenabstand exakt aufhebt). */
  await s.werte(`window.__zeichne([
    ${JSON.stringify(block('text', { roh: 'Normale Breite.' }))},
    ${JSON.stringify({ ...block('text', { roh: 'Volle Breite.' }, 'voll'), sort_order: 2 })}
  ], null)`);
  const raender = await s.werte(`(() => {
    const normal = document.querySelector('p').getBoundingClientRect();
    const el = document.querySelector('.mm-breite-voll').getBoundingClientRect();
    return { linksRausgebrochen: el.left < normal.left, rechtsRausgebrochen: el.right > normal.right };
  })()`);
  pruefe('Breite "voll" bricht über den Innenabstand der Spalte hinaus (breiter als ein normaler Block)',
    raender.linksRausgebrochen && raender.rechtsRausgebrochen, JSON.stringify(raender));
}

/* ================= Bewegung: sicher ohne Skript, wirksam mit Skript ================= */

/* Ohne __einrichten() aufzurufen (so, als würde bewegungEinrichten() aus
   irgendeinem Grund nie laufen) MUSS der Block normal sichtbar bleiben --
   das ist die wichtigste Prüfung in diesem Abschnitt: geht sie kaputt,
   kann Inhalt bei einem Skriptfehler unsichtbar werden. */
{
  await s.werte(`window.__zeichne([${JSON.stringify(block('text', { roh: 'Bewegter Text ohne Einrichtung.' }, 'normal', 'einblenden'))}], null)`);
  const deckkraft = await s.werte(`getComputedStyle(document.querySelector('.mm-bewegung-einblenden')).opacity`);
  pruefe('OHNE bewegungEinrichten() bleibt ein Bewegungs-Block normal sichtbar (Deckkraft 1)',
    Number(deckkraft) === 1, deckkraft);
}

/* Mit Einrichtung: außerhalb des Bildschirms unsichtbar, nach dem
   Scrollen ins Bild sichtbar. */
{
  await s.werte(`window.__zeichne([${JSON.stringify(block('text', { roh: 'Bewegter Text.' }, 'normal', 'hochschieben'))}], null)`);
  await s.werte(`window.__einrichten()`);
  await s.werte(`window.scrollTo(0, 0)`);
  await s.warte(80);
  const vorher = await s.werte(`getComputedStyle(document.querySelector('.mm-bewegung-hochschieben')).opacity`);
  pruefe('nach dem Einrichten, außerhalb des Bildschirms, ist der Block unsichtbar',
    Number(vorher) === 0, vorher);

  /* Nicht blind eine Dauer abwarten: Die Seite scrollt sanft, der Block
     kommt also erst verzögert ins Bild, und die Animation startet
     entsprechend später. Eine feste Wartezeit misst dann mitten in der
     Bewegung (beobachtet: 0.52). Stattdessen warten, bis sich die Deckkraft
     nicht mehr ändert -- das ist zugleich strenger, weil es den ECHTEN
     Endzustand prüft statt einen Zwischenwert nach Zufall. */
  const nachher = await s.werte(`(async () => {
    const el = document.querySelector('.mm-bewegung-hochschieben');
    el.scrollIntoView({ block: 'center' });
    let vorher = -1, gleich = 0;
    for (let i = 0; i < 40; i++) {                 // höchstens 4 Sekunden
      await new Promise(r => setTimeout(r, 100));
      const jetzt = Number(getComputedStyle(el).opacity);
      if (jetzt === vorher) { if (++gleich >= 3) break; } else { gleich = 0; }
      vorher = jetzt;
    }
    return String(vorher);
  })()`);
  /* Nicht exakt 1 verlangen -- Chrome rundet die Deckkraft am Ende einer
     Animation manchmal minimal ab (z.B. 0.9977), ohne dass optisch noch
     etwas zu sehen wäre. */
  pruefe('…und nach dem Scrollen ins Bild wird er (fast vollständig) sichtbar',
    Number(nachher) > 0.97, nachher);
  const sichtbarKlasse = await s.werte(`document.querySelector('.mm-bewegung-hochschieben').classList.contains('mm-sichtbar')`);
  pruefe('…die Klasse "mm-sichtbar" wurde gesetzt', sichtbarKlasse === true);
}

/* prefers-reduced-motion: reduce -- window.matchMedia wird direkt auf der
   Seite überschrieben (zuverlässiger als eine echte CDP-Emulation für
   dieses eine, klar abgegrenzte Verhalten) und bewegungEinrichten() erneut
   mit frischen Blöcken aufgerufen. */
{
  await s.werte(`window.__zeichne([${JSON.stringify(block('text', { roh: 'Bewegter Text mit reduzierter Bewegung.' }, 'normal', 'wachsen'))}], null)`);
  await s.werte(`(() => {
    window.matchMedia = () => ({ matches: true, addEventListener(){}, removeEventListener(){} });
  })()`);
  await s.werte(`window.__einrichten()`);
  const klasse = await s.werte(`document.querySelector('.mm-bewegung-wachsen').className`);
  const deckkraft = await s.werte(`getComputedStyle(document.querySelector('.mm-bewegung-wachsen')).opacity`);
  pruefe('bei prefers-reduced-motion:reduce wird "mm-bereit" NIE gesetzt (keine Bewegung ausgelöst)',
    !klasse.includes('mm-bereit'), klasse);
  pruefe('…der Block bleibt durchgehend sichtbar', Number(deckkraft) === 1, deckkraft);
}

/* Bildschirmfoto für den Bericht: alle vier Breiten nebeneinander. */
await s.werte(`window.__zeichne([
  ${JSON.stringify({ ...block('ueberschrift', { roh: '## Breiten im Vergleich' }), sort_order: 1 })},
  ${JSON.stringify({ ...block('text', { roh: 'Normale Breite -- der Standard, wie bisher jeder Text.' }), sort_order: 2 })},
  ${JSON.stringify({ ...block('text', { roh: 'Schmale Breite -- eine schlankere, zentrierte Spalte.' }, 'schmal'), sort_order: 3 })},
  ${JSON.stringify({ ...block('text', { roh: 'Randnotiz-Breite -- kleiner und etwas leiser gesetzt.' }, 'randnotiz'), sort_order: 4 })},
  ${JSON.stringify({ ...block('text', { roh: 'Volle Breite -- bricht bis an den Rand der Spalte aus.' }, 'voll'), sort_order: 5 })}
], null)`);
await s.werte(`window.scrollTo(0, document.getElementById('abstand').getBoundingClientRect().height + window.scrollY)`);
await s.warte(150);
await s.bild(new URL('./bilder/bausteine-breiten.png', import.meta.url).pathname);

const jsFehler = s.fehlerAufSeite();
pruefe('keine JavaScript-Fehler auf der Prüfseite', jsFehler.length === 0, jsFehler.join(' | '));
await s.zu();

/* ================= zeilenweise: gestaffelte Verzögerung je Kind =================
   Eigene, frische Seite -- der vorige Abschnitt hat window.matchMedia
   überschrieben, und das lässt sich nicht sauber zurücksetzen. */
const z = await oeffne('http://127.0.0.1:8909/tests-feste/baustein-probe.html',
  { port: 9349, breite: 1280, hoehe: 1000 });
await z.warte(200);
await z.werte(`window.__zeichne([${JSON.stringify(block('text', { roh: 'Erste Zeile.\n\nZweite Zeile.\n\nDritte Zeile.' }, 'normal', 'zeilenweise'))}], null)`);
await z.werte(`window.scrollTo(0, 0)`);
await z.werte(`window.__einrichten()`);
const verzoegerungen = JSON.parse(await z.werte(`JSON.stringify([...document.querySelector('.mm-bewegung-zeilenweise').children].map(k => k.style.getPropertyValue('--mm-verzoegerung')))`));
pruefe('"zeilenweise" gibt jedem Kind eine eigene, steigende Verzögerung',
  verzoegerungen.length >= 2 && verzoegerungen[0] === '0ms' && verzoegerungen[1] !== '0ms',
  verzoegerungen.join(', '));

const jsFehler2 = z.fehlerAufSeite();
pruefe('keine JavaScript-Fehler bei "zeilenweise"', jsFehler2.length === 0, jsFehler2.join(' | '));
await z.zu();

/* ---------- Kasten, Zitat und die Farben ---------- */
{
  const f = await oeffne('http://127.0.0.1:8909/', { port: 9349, breite: 1000, hoehe: 800 });
  await f.warte(2800);
  const erg = JSON.parse(await f.werte(`(() => {
    const r = (o) => window.mmBloecke.render(o);
    const d = document.createElement('div');
    document.body.appendChild(d);
    const messe = (html) => { d.innerHTML = html; const el = d.firstElementChild;
      const cs = getComputedStyle(el);
      return { klassen: el.className, grund: cs.backgroundColor, balken: cs.borderLeftColor,
        balkenBreite: cs.borderLeftWidth }; };

    const kastenOhne  = messe(r({ typ:'kasten', breite:'normal', bewegung:'keine', inhalt:{ roh:'x', farbe:'' } }));
    const kastenRot   = messe(r({ typ:'kasten', breite:'normal', bewegung:'keine', inhalt:{ roh:'x', farbe:'terrakotta' } }));
    const zitatViolett= messe(r({ typ:'zitat',  breite:'normal', bewegung:'keine', inhalt:{ roh:'x', farbe:'violett' } }));
    /* Ein erfundener Wert aus der Datenbank darf NICHT als Klasse durchrutschen. */
    const boese = r({ typ:'kasten', breite:'normal', bewegung:'keine',
      inhalt:{ roh:'x', farbe:'" onload="alert(1)' } });
    /* Vorgabe-Bild und Bild ohne Rahmen */
    const bildNormal = r({ typ:'bild', breite:'normal', bewegung:'keine', inhalt:{ roh:'![](/favicon.svg)' } });
    const bildNackt  = r({ typ:'bild', breite:'normal', bewegung:'keine', inhalt:{ roh:'![](/favicon.svg)', ohne_rahmen:true } });
    d.remove();
    return JSON.stringify({ kastenOhne, kastenRot, zitatViolett, boese, bildNormal, bildNackt });
  })()`));

  pruefe('ein Kasten ohne Farbe hat einen ruhigen neutralen Grund',
    erg.kastenOhne.klassen === 'mm-kasten' && erg.kastenOhne.grund !== 'rgba(0, 0, 0, 0)',
    erg.kastenOhne.klassen + ' / ' + erg.kastenOhne.grund);
  pruefe('ein Kasten mit Farbe bekommt einen ANDEREN, farbigen Grund',
    erg.kastenRot.grund !== erg.kastenOhne.grund && erg.kastenRot.klassen.includes('mm-farbe-terrakotta'),
    erg.kastenRot.klassen + ' / ' + erg.kastenRot.grund);
  pruefe('ein Zitat trägt die Farbe im Balken links',
    erg.zitatViolett.balken === 'rgb(142, 78, 155)' && parseFloat(erg.zitatViolett.balkenBreite) >= 2,
    erg.zitatViolett.balken + ' / ' + erg.zitatViolett.balkenBreite);

  /* Sicherheitsnetz: Farbnamen kommen aus der Datenbank ins HTML. Ohne
     Positivliste liesse sich darüber ein Attribut einschleusen. */
  pruefe('ein erfundener Farbwert wird NICHT als Klasse übernommen',
    !erg.boese.includes('onload') && !erg.boese.includes('mm-farbe-"'),
    erg.boese.slice(0, 90));

  pruefe('ein Bild ohne Rahmen trägt die Kennzeichnung, ein normales nicht',
    erg.bildNackt.includes('mm-ohne-rahmen') && !erg.bildNormal.includes('mm-ohne-rahmen'));
  /* Der wichtigste Teil: der VORHANDENE Bestand darf sich nicht ändern. */
  pruefe('ein Bild mit Vorgabewerten erzeugt weiterhin exakt dasselbe HTML wie bisher',
    !erg.bildNormal.includes('mm-baustein'), erg.bildNormal.slice(0, 70));
  await f.zu();
}

/* ---------- "Volle Breite" muss wirklich breit sein ----------
   Vorher brach ein Block mit Breite "voll" genau um den Innenabstand der
   Lesespalte aus -- 26px je Seite. Der Unterschied zu "normal" waren damit
   52px, und Lucas' Reaktion war voellig richtig: "veraendert sich nur
   minimal". Der Vertrag ist also nicht "voll ist anders", sondern
   "voll ist DEUTLICH breiter" -- und ragt trotzdem nie aus dem
   Scrollbereich heraus, auch nicht auf schmalen Fenstern. */
for (const breite of [1440, 1280, 1024, 700]) {
  const b = await oeffne('http://127.0.0.1:8909/', { port: 9349, breite, hoehe: 800 });
  await b.warte(2800);
  const mass = JSON.parse(await b.werte(`(() => {
    const sp = document.querySelector('.br-spalte');
    const sc = document.querySelector('.br-scroller');
    const probe = document.createElement('div');
    probe.className = 'mm-breite-voll';
    probe.style.height = '10px';
    sp.appendChild(probe);
    const r = probe.getBoundingClientRect(), rs = sc.getBoundingClientRect();
    const erg = {
      normal: Math.round(sp.getBoundingClientRect().width - 52),
      voll: Math.round(r.width),
      ragtHeraus: r.left < rs.left - 1 || r.right > rs.right + 1,
    };
    probe.remove();
    return JSON.stringify(erg);
  })()`));
  const zugewinn = mass.voll - mass.normal;
  /* Bei 700px Fensterbreite ist schlicht kein Platz fuer viel Ausbruch --
     dort genuegt, dass er ueberhaupt greift und nichts herausragt. */
  const erwartet = breite >= 1024 ? 180 : 40;
  pruefe(`bei ${breite}px ist "voll" deutlich breiter als "normal" (mind. ${erwartet}px mehr)`,
    zugewinn >= erwartet, `normal=${mass.normal}px, voll=${mass.voll}px, Zugewinn=${zugewinn}px`);
  pruefe(`bei ${breite}px ragt "voll" NICHT aus dem Scrollbereich heraus`,
    mass.ragtHeraus === false);
  await b.zu();
}

chrome.beenden(); server.beenden();
bericht();
