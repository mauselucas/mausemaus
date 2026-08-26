/* Prüft, dass Breite, Farbe und Rahmen (assets/bloecke.js, assets/site.css)
   auf der öffentlichen Seite sichtbar wirken -- UND dass sie für den ganz
   überwiegenden Bestand an Inhalt (Breite "normal", keine Farbe) am
   ausgelieferten HTML rein GAR NICHTS ändern. Letzteres ist der wichtigere
   Teil: die vier gesperrten Prüfungen (pruefe-bestand/leiste/brief/welten)
   verlassen sich darauf.

   Das frühere Feld "Bewegung" je Block gibt es nicht mehr -- die Seite
   animiert seit dem Umbau alles von selbst am Scrollstand
   (assets/bewegung.css, geprüft in tests/pruefe-scroll-bewegung.mjs). Was
   hier davon übrig bleibt, ist der UMZUGS-Vertrag: alte Werte, die noch in
   der Datenbank stehen, dürfen nichts mehr bewirken und dürfen vor allem
   nichts unsichtbar machen. */
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
  ({ typ, inhalt, breite, bewegung, sort_order: 1 });   // bewegung: Altbestand aus der Datenbank

/* ================= Standardfall: unverändert, byte-genau ================= */

{
  const roh = { roh: 'Ein ganz normaler Absatz.' };
  const ohneHuelle = await s.werte(`window.mm.renderMarkdown(${JSON.stringify(roh.roh)})`);
  await s.werte(`window.__zeichne([${JSON.stringify(block('text', roh))}], null)`);
  const html = await s.werte(`document.getElementById('ziel').innerHTML`);
  pruefe('Standard-Block (Breite normal, ohne Farbe) bekommt KEINE Hülle',
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

/* ================= Altbestand "bewegung" ist wirkungslos =================

   Bis zum Umbau konnte man je Block eine Bewegung wählen; bloecke.js hängte
   dafür eine Klasse mm-bewegung-* an, und ein Beobachter blendete den Block
   beim Erscheinen ein. Beides ist weg -- die Seite animiert jetzt alles von
   selbst am Scrollstand (assets/bewegung.css). In der Datenbank stehen die
   alten Werte aber weiter; die Spalte wird bewusst NICHT angefasst.

   Der Vertrag lautet deshalb: Ein Block mit altem Bewegungswert sieht aus
   wie jeder andere. Keine Klasse, keine Hülle, volle Deckkraft. Die
   Deckkraft ist der wichtige Teil -- der alte Weg machte Blöcke absichtlich
   unsichtbar und verließ sich darauf, dass ein Skript sie wieder einblendet.
   Bliebe davon irgendein Rest stehen, wäre Inhalt weg. */
{
  const funde = [];
  for (const wert of ['einblenden', 'hochschieben', 'wachsen', 'zeilenweise']) {
    await s.werte(`window.__zeichne([${JSON.stringify(
      block('text', { roh: 'Absatz mit altem Bewegungswert aus der Datenbank.' }, 'normal', wert))}], null)`);
    const gemessen = JSON.parse(await s.werte(`(() => {
      const ziel = document.getElementById('ziel');
      return JSON.stringify({
        klasse: ziel.innerHTML.includes('mm-bewegung-'),
        huelle: ziel.innerHTML.includes('mm-baustein'),
        deckkraft: Number(getComputedStyle(ziel.querySelector('p')).opacity),
      });
    })()`));
    funde.push({ wert, ...gemessen });
  }
  pruefe('alte Bewegungswerte erzeugen KEINE mm-bewegung-Klasse mehr',
    funde.every(f => !f.klasse), funde.filter(f => f.klasse).map(f => f.wert).join(', '));
  pruefe('…und auch keine Hülle — der Block bleibt bytegleich zum Standardfall',
    funde.every(f => !f.huelle), funde.filter(f => f.huelle).map(f => f.wert).join(', '));
  pruefe('…und der Text ist voll sichtbar (Deckkraft 1), nie halb versteckt',
    funde.every(f => f.deckkraft === 1), funde.map(f => f.wert + ':' + f.deckkraft).join(', '));
}

/* GEGENBEWEIS: genau den alten Zustand wiederherstellen -- Klasse anhängen
   und die alte CSS-Regel wieder einsetzen. Alle drei Prüfungen oben würden
   ihn erkennen. Nur im Browser, die Dateien auf der Platte bleiben
   unangetastet. */
{
  const alt = JSON.parse(await s.werte(`(() => {
    const stil = document.createElement('style');
    stil.textContent = '.mm-bewegung-einblenden.mm-bereit { opacity: 0 }';
    document.head.appendChild(stil);
    const ziel = document.getElementById('ziel');
    ziel.innerHTML = '<div class="mm-baustein mm-bewegung-einblenden mm-bereit"><p>x</p></div>';
    const erg = JSON.stringify({
      klasse: ziel.innerHTML.includes('mm-bewegung-'),
      huelle: ziel.innerHTML.includes('mm-baustein'),
      deckkraft: Number(getComputedStyle(ziel.querySelector('p').parentElement).opacity),
    });
    stil.remove(); ziel.innerHTML = '';
    return erg;
  })()`));
  pruefe('GEGENBEWEIS: der alte Zustand (Klasse, Hülle, Deckkraft 0) würde von allen drei erkannt',
    alt.klasse === true && alt.huelle === true && alt.deckkraft === 0, JSON.stringify(alt));
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
