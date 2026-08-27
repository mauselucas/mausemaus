/* Prüft die Einblendungen beim Scrollen (assets/bewegung.css).

   Lucas' Anforderung, wörtlich: „wenn ich mitten in der animation aufhöre zu
   scrollen soll es auch stehen bleiben und wenn ich zurück scrolle soll es
   auch wieder so zurück animiert werden“.

   Das ist keine Geschmacksfrage, sondern eine messbare Aussage -- und genau
   so wird sie hier gemessen: an drei Scrollständen die Deckkraft ablesen,
   zurückscrollen, wieder ablesen. Eine gewöhnliche Einblendung (Animation
   auf einer Uhr, ausgelöst durch einen Beobachter) würde durchlaufen und
   beim Zurückscrollen NICHT zurückgehen -- sie fiele hier durch.

   Die zweite Prüfung ist die, die beim ersten Anlauf gefehlt hat. Damals
   stimmte rechnerisch alles -- und Lucas' erste Rückmeldung war trotzdem
   „es ist nichts animiert". Er hatte recht: der ganze Ablauf lag zwischen
   100% und 75% der Bildhöhe, also im untersten Viertel am Rand des
   Blickfelds. Die Prüfung hatte gemessen, OB sich etwas bewegt, aber nicht,
   WO auf dem Bildschirm. Eine Animation, die nur an der unteren Kante
   stattfindet, ist für den Betrachter keine.
   Deshalb jetzt zusätzlich: im unteren Viertel muss sie noch LAUFEN, bis
   zur Bildmitte muss sie FERTIG sein.

   Die dritte Hälfte ist die Sicherheitsseite: Inhalt darf durch eine
   Animation niemals verschwinden. Drei Wege, wie das passieren kann, werden
   ausgeschlossen:
   - am Seitenende hängenbleiben, weil der Scrollweg nicht reicht,
   - bei „Bewegung reduzieren“ unsichtbar bleiben,
   - das Layout beim Scrollen verschieben. */
import { readFile } from 'node:fs/promises';
import { starteChrome, oeffne, pruefe, bericht } from './chrome.mjs';
import { starteServer } from './server.mjs';

const wurzel = new URL('../HOCHLADEN/', import.meta.url).pathname;
const server = await starteServer({ wurzel, port: 8919 });
const chrome = await starteChrome({ port: 9359 });
const ADR = 'http://127.0.0.1:8919';

/* Alles, was eine Scroll-Animation trägt. Muss zur Auswahl in
   assets/bewegung.css passen -- steht bewusst NUR hier noch einmal, damit
   ein vergessener Eintrag dort hier als „nicht geprüft“ auffällt. */
const ANIMIERT = `'.br-gruss, .br-titel, .br-rolle, .br-kicker, .welt-titel, .welt-kicker, ' +
  '.br-text > p, .br-text > ul, .br-text > ol, .br-text > blockquote, .br-text > div, ' +
  '.welt-text > p, .welt-text > ul, .welt-text > div, ' +
  '.br-bild, .br-film, .welt-cover, .br-text > figure, ' +
  '.br-infos > div, .br-werkzeuge > div, .mm-kasten, .mm-zitat, ' +
  '.br-kontakt, .br-formular'`;

/* Scroll-Animationen werden vom Compositor gerechnet, nicht sofort beim
   Setzen von scrollTop. Wer direkt danach getComputedStyle() liest, bekommt
   den Stand von VORHER -- beim ersten Versuch las diese Prüfung deshalb
   überall 0 und meldete Fehler, wo keine waren. Nach jedem Scrollen also
   zwei Vollbilder abwarten. */
const BILD = `await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));`;

const s = await oeffne(ADR + '/', { port: 9359, breite: 1440, hoehe: 900 });
await s.warte(3500);
/* Sanftes Scrollen abschalten: sonst misst man irgendwo unterwegs. */
await s.werte(`document.querySelector('.br-scroller').style.scrollBehavior = 'auto'`);

/* ---------- Kann dieser Browser überhaupt Scroll-Animationen? ---------- */
const kann = await s.werte(`CSS.supports('animation-timeline: view()')`);
pruefe('der Prüf-Browser beherrscht Scroll-Animationen (sonst wäre alles Weitere hohl)',
  kann === true, String(kann));

/* ================= 1. Am Scrollen festgemacht ================= */

/* Ein Titel weit unten -- er ist beim Laden garantiert außerhalb des Bildes
   und wird also wirklich durch Scrollen eingeblendet. */
const messreihe = JSON.parse(await s.werte(`(async () => {
  const sc = document.querySelector('.br-scroller');
  const titel = [...document.querySelectorAll('.br-titel')];
  const el = titel[titel.length - 2];        // vorletzter: unten, aber nicht ganz am Ende
  const obenIm = el.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop;

  /* "entry 0px" ist erreicht, wenn die Oberkante des Elements gerade die
     Unterkante des Bildes berührt. Der Bereich für Titel läuft von dort
     90px bis 330px (siehe animation-range in bewegung.css) -- die
     Messpunkte unten liegen davor, mittendrin und dahinter. */
  const anfang = obenIm - sc.clientHeight;
  const lies = async (stand) => {
    sc.scrollTop = stand;
    ${BILD}
    const st = getComputedStyle(el);
    return { stand, deckkraft: Number(st.opacity), unschaerfe: st.filter, versatz: st.transform };
  };

  const punkte = [
    await lies(anfang + 40),        // davor (Bereich beginnt erst bei 90)
    await lies(anfang + 150),       // ein Viertel
    await lies(anfang + 210),       // die Hälfte
    await lies(anfang + 270),       // drei Viertel
    await lies(anfang + 400),       // danach (Bereich endet bei 330)
    await lies(anfang + 210),       // ZURÜCK auf die Hälfte
    await lies(anfang + 40),        // ganz zurück
  ];
  return JSON.stringify({ titel: el.textContent.slice(0, 24), punkte });
})()`));

const p = messreihe.punkte;
pruefe('vor dem Bereich ist der Titel noch ganz weg (Deckkraft 0)',
  p[0].deckkraft === 0, `„${messreihe.titel}“ bei ${p[0].stand}px: ${p[0].deckkraft}`);

pruefe('mitten im Scrollen steht er WIRKLICH mittendrin (Deckkraft zwischen 0 und 1)',
  p[2].deckkraft > 0.05 && p[2].deckkraft < 0.95, String(p[2].deckkraft));

pruefe('…und er wird mit jedem Stück Scrollen weiter sichtbar, Schritt für Schritt',
  p[1].deckkraft < p[2].deckkraft && p[2].deckkraft < p[3].deckkraft,
  p.slice(1, 4).map(x => x.deckkraft.toFixed(3)).join(' → '));

pruefe('nach dem Bereich ist er voll da (Deckkraft 1, keine Unschärfe, kein Versatz)',
  p[4].deckkraft === 1 && /blur\(0px\)|none/.test(p[4].unschaerfe),
  `${p[4].deckkraft} / ${p[4].unschaerfe} / ${p[4].versatz}`);

/* DAS ist Lucas' eigentlicher Wunsch: zurückscrollen dreht die Bewegung
   zurück. Eine Animation auf einer Uhr wäre hier längst durchgelaufen und
   bliebe bei 1 stehen. */
pruefe('zurückscrollen spielt die Bewegung rückwärts -- exakt auf denselben Wert wie hin',
  Math.abs(p[5].deckkraft - p[2].deckkraft) < 0.01,
  `hin ${p[2].deckkraft.toFixed(3)} · zurück ${p[5].deckkraft.toFixed(3)}`);

pruefe('…und ganz zurück ist er wieder ganz weg',
  p[6].deckkraft === 0, String(p[6].deckkraft));

/* GEGENBEWEIS: eine gewöhnliche Einblendung (Uhr statt Scrollstand) würde
   hier durchfallen -- sie läuft einmal durch und geht nicht zurück. */
{
  const g = JSON.parse(await s.werte(`(async () => {
    const sc = document.querySelector('.br-scroller');
    const titel = [...document.querySelectorAll('.br-titel')];
    const el = titel[titel.length - 2];
    const obenIm = el.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop;
    const anfang = obenIm - sc.clientHeight;
    el.style.animationTimeline = 'auto';           // der gewöhnliche Weg: auf der Uhr
    el.style.animationDuration = '600ms';
    sc.scrollTop = anfang + 100;                   // derselbe Stand wie oben in der Mitte
    await new Promise(r => setTimeout(r, 900));
    const hin = Number(getComputedStyle(el).opacity);
    sc.scrollTop = anfang - 40;                    // ganz zurueck, dort war es oben 0
    await new Promise(r => setTimeout(r, 200));
    const zurueck = Number(getComputedStyle(el).opacity);
    el.style.animationTimeline = ''; el.style.animationDuration = '';
    return JSON.stringify({ hin, zurueck });
  })()`));
  /* Nicht auf feste Zahlen prüfen -- wie weit eine Uhr in 900ms gekommen
     ist, hängt vom Rechner ab. Geprüft wird die EIGENSCHAFT: der Wert geht
     beim Zurückscrollen nicht zurück, er läuft einfach weiter. Genau da
     scheitert der gewöhnliche Weg an Lucas' Anforderung. */
  pruefe('GEGENBEWEIS: eine Einblendung auf der Uhr geht beim Zurückscrollen NICHT zurück',
    g.zurueck >= g.hin - 0.001 && g.zurueck > 0.5,
    `am selben Stand hin ${g.hin.toFixed(3)}, ganz zurückgescrollt ${g.zurueck.toFixed(3)}` +
    ` — statt wie oben auf 0 zurückzugehen`);
}

/* ================= 2. Sie findet dort statt, wo man hinschaut =================
   Gemessen wird nicht am Scrollstand, sondern an der LAGE des Elements auf
   dem Bildschirm -- denn darum geht es. */
{
  const lage = JSON.parse(await s.werte(`(async () => {
    const sc = document.querySelector('.br-scroller');
    const t = [...document.querySelectorAll('.br-titel')];
    const el = t[t.length - 2];
    const obenIm = el.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop;
    /* Das Element genau auf einen Anteil der Bildhöhe schieben. */
    const stelle = async (anteil) => {
      sc.scrollTop = obenIm - sc.clientHeight * anteil;
      ${BILD}
      return { y: Math.round(el.getBoundingClientRect().top / sc.clientHeight * 100),
               deckkraft: Number(getComputedStyle(el).opacity) };
    };
    return JSON.stringify({ unten: await stelle(0.75), mitte: await stelle(0.5) });
  })()`));

  pruefe('im unteren Viertel des Bildes LÄUFT die Einblendung noch (man sieht sie wirklich)',
    lage.unten.deckkraft > 0.05 && lage.unten.deckkraft < 0.95,
    `bei ${lage.unten.y}% von oben: Deckkraft ${lage.unten.deckkraft.toFixed(3)}`);
  pruefe('…und bis zur Bildmitte ist sie fertig (man liest nichts Halbdurchsichtiges)',
    lage.mitte.deckkraft === 1,
    `bei ${lage.mitte.y}% von oben: Deckkraft ${lage.mitte.deckkraft}`);

  /* GEGENBEWEIS: genau die erste Fassung wiederherstellen. Sie lief
     tadellos -- nur eben unsichtbar am unteren Bildrand. */
  const g = JSON.parse(await s.werte(`(async () => {
    const sc = document.querySelector('.br-scroller');
    const t = [...document.querySelectorAll('.br-titel')];
    const el = t[t.length - 2];
    const stil = document.createElement('style');
    stil.textContent = '.br-titel { animation-range: entry 0px entry 200px !important; }';
    document.head.appendChild(stil);
    const obenIm = el.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop;
    sc.scrollTop = obenIm - sc.clientHeight * 0.75;
    ${BILD}
    const deckkraft = Number(getComputedStyle(el).opacity);
    stil.remove();
    return JSON.stringify({ deckkraft });
  })()`));
  pruefe('GEGENBEWEIS: die erste Fassung war im unteren Viertel schon fertig — genau das, was Lucas sah',
    g.deckkraft === 1, 'Deckkraft ' + g.deckkraft + ' statt mittendrin');
}

/* ================= 3. Kein Layoutversatz ================= */

const layout = JSON.parse(await s.werte(`(() => {
  const sc = document.querySelector('.br-scroller');
  const el = [...document.querySelectorAll('.br-titel')].pop();
  const obenIm = () => el.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop;
  sc.scrollTop = 0;
  const hoeheAus = el.offsetHeight, obenAus = el.offsetTop;
  const seiteAus = sc.scrollHeight;
  sc.scrollTop = obenIm() - sc.clientHeight + 100;   // mitten in der Bewegung
  const hoeheDrin = el.offsetHeight, obenDrin = el.offsetTop;
  const seiteDrin = sc.scrollHeight;
  return JSON.stringify({ hoeheAus, hoeheDrin, obenAus, obenDrin, seiteAus, seiteDrin });
})()`));
pruefe('die Bewegung verschiebt kein Layout (Höhe und Lage bleiben gleich)',
  layout.hoeheAus === layout.hoeheDrin && layout.obenAus === layout.obenDrin,
  JSON.stringify(layout));
pruefe('…und die Seitenlänge ändert sich beim Scrollen nicht',
  Math.abs(layout.seiteAus - layout.seiteDrin) <= 1,
  `${layout.seiteAus}px / ${layout.seiteDrin}px`);

/* ================= 4. Am Seitenende bleibt nichts hängen ================= */

const ende = JSON.parse(await s.werte(`(async () => {
  const sc = document.querySelector('.br-scroller');
  sc.scrollTop = sc.scrollHeight;                  // so weit es geht
  ${BILD}
  const haengt = [];
  document.querySelectorAll(${ANIMIERT}).forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) return;   // nur, was jetzt im Bild ist
    const st = getComputedStyle(el);
    const unscharf = st.filter !== 'none' && st.filter !== 'blur(0px)';
    if (Number(st.opacity) < 0.99 || unscharf)
      haengt.push(el.tagName + '.' + (el.className || '') + ' ' + st.opacity + ' ' + st.filter);
  });
  return JSON.stringify({ stand: sc.scrollTop, max: sc.scrollHeight - sc.clientHeight, haengt });
})()`));
pruefe('ganz unten angekommen ist JEDES Element voll da -- nichts bleibt halb durchsichtig hängen',
  ende.haengt.length === 0, ende.haengt.slice(0, 5).join(' | '));

/* GEGENBEWEIS: genau die Falle -- ein Bereich, der länger ist als der
   Scrollweg, der hinter dem letzten Absatz noch übrig ist. */
{
  const g = JSON.parse(await s.werte(`(async () => {
    const sc = document.querySelector('.br-scroller');
    const stil = document.createElement('style');
    stil.id = 'gegenbeweis-ende';
    stil.textContent = '.br-formular, .br-kontakt, .br-text > p ' +
      '{ animation-range: entry 0px entry 4000px !important; }';
    document.head.appendChild(stil);
    sc.scrollTop = sc.scrollHeight;
    ${BILD}
    const haengt = [];
    document.querySelectorAll(${ANIMIERT}).forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) return;
      if (Number(getComputedStyle(el).opacity) < 0.99)
        haengt.push(el.tagName + '.' + (el.className || ''));
    });
    stil.remove();
    return JSON.stringify({ haengt });
  })()`));
  pruefe('GEGENBEWEIS: ein zu langer Bereich lässt das Seitenende halb durchsichtig stehen',
    g.haengt.length > 0, g.haengt.slice(0, 4).join(' | ') || 'nichts hängt — die Prüfung wäre blind!');
}

const fehler = s.fehlerAufSeite();
pruefe('Brief: keine JavaScript-Fehler', fehler.length === 0, fehler.join(' | '));
await s.zu();

/* ================= 5. Eine Welt animiert genauso ================= */
{
  const w = await oeffne(ADR + '/welt/verteidiger-isfj-t', { port: 9359, breite: 1440, hoehe: 900 });
  await w.warte(3000);
  /* site.css setzt html { scroll-behavior: smooth }. Ohne das Abschalten
     GLEITET window.scrollTo() ans Ziel, und direkt danach steht die Seite
     noch fast am Anfang -- beim ersten Versuch las diese Prüfung deshalb
     durchgehend 0. Im Brief ist es dieselbe Falle, dort am .br-scroller. */
  await w.werte(`document.documentElement.style.scrollBehavior = 'auto'`);
  const m = JSON.parse(await w.werte(`(async () => {
    const el = [...document.querySelectorAll('.welt-text > p')].pop();
    const oben = el.getBoundingClientRect().top + window.scrollY;
    const anfang = oben - innerHeight;
    const lies = async (y) => {
      window.scrollTo(0, y);
      ${BILD}
      return Number(getComputedStyle(el).opacity);
    };
    return JSON.stringify({ davor: await lies(anfang - 40), mitte: await lies(anfang + 80),
      danach: await lies(document.documentElement.scrollHeight) });
  })()`));
  pruefe('Welt: auch dort hängt die Einblendung am Scrollstand',
    m.davor === 0 && m.mitte > 0.05 && m.mitte < 0.95 && m.danach === 1,
    JSON.stringify(m));
  const wf = w.fehlerAufSeite();
  pruefe('Welt: keine JavaScript-Fehler', wf.length === 0, wf.join(' | '));
  await w.zu();
}

/* ================= 6. „Bewegung reduzieren“: alles einfach da =================
   Der Fall, in dem gar keine Animation laufen darf -- und in dem trotzdem
   (oder gerade deshalb) JEDES Element voll sichtbar sein muss.
   Vorgetäuscht wird das über das DevTools-Protokoll, nicht durch
   Überschreiben von window.matchMedia: Die ganze Absicherung steht in einer
   @media-Regel in CSS, und die sieht von einem überschriebenen matchMedia
   nichts. */
{
  const r = await oeffne(ADR + '/', { port: 9359, breite: 1440, hoehe: 900 });
  await r.medien({ 'prefers-reduced-motion': 'reduce' });
  await r.werte('location.reload()').catch(() => {});
  await r.warte(3500);
  const m = JSON.parse(await r.werte(`(() => {
    const versteckt = [];
    document.querySelectorAll(${ANIMIERT}).forEach(el => {
      const st = getComputedStyle(el);
      const unscharf = st.filter !== 'none' && st.filter !== 'blur(0px)';
      if (Number(st.opacity) < 0.99 || unscharf || st.animationName !== 'none')
        versteckt.push(el.tagName + '.' + (el.className || '') + ' ' + st.opacity + ' ' + st.animationName);
    });
    return JSON.stringify({ geprueft: document.querySelectorAll(${ANIMIERT}).length, versteckt });
  })()`));
  pruefe('bei „Bewegung reduzieren“ läuft keine Animation und alles ist von Anfang an sichtbar',
    m.geprueft > 20 && m.versteckt.length === 0,
    `${m.geprueft} Elemente geprüft` + (m.versteckt.length ? ' — ' + m.versteckt.slice(0, 4).join(' | ') : ''));

  /* GEGENBEWEIS: ohne die @media-Absicherung wären dieselben Elemente bei
     „Bewegung reduzieren“ unsichtbar -- die Regel ist also nicht bloß
     Zierrat, sie hält den Inhalt wirklich sichtbar. */
  const g = JSON.parse(await r.werte(`(async () => {
    const stil = document.createElement('style');
    stil.textContent = '.br-titel, .br-text > p { animation: mm-auf-titel linear both;' +
      ' animation-timeline: view(); animation-range: entry 0px entry 200px; }';
    document.head.appendChild(stil);
    ${BILD}
    const versteckt = [...document.querySelectorAll('.br-titel, .br-text > p')]
      .filter(el => Number(getComputedStyle(el).opacity) < 0.99).length;
    stil.remove();
    return JSON.stringify({ versteckt });
  })()`));
  pruefe('GEGENBEWEIS: ohne die @media-Absicherung wäre bei „Bewegung reduzieren“ Inhalt unsichtbar',
    g.versteckt > 5, g.versteckt + ' Elemente unter Deckkraft 1');
  await r.zu();
}

/* ================= 7. Die @supports-Absicherung steht wirklich um ALLES =================
   Ein Browser ohne Scroll-Animationen darf nie eine halbe Regel abbekommen:
   ohne animation-timeline liefe die Animation auf einer Uhr, und mit "both"
   bliebe der Anfangszustand kleben -- also unsichtbarer Inhalt. Diese Regel
   prüft die Datei selbst, ohne Browser: JEDE Zeile mit "animation" oder
   "animation-timeline" muss innerhalb des @supports-Blocks stehen. */
{
  const css = await readFile(new URL('../HOCHLADEN/assets/bewegung.css', import.meta.url), 'utf8');
  /* Den ganzen @supports-Block herausschneiden -- was danach an
     Animationsregeln übrig bleibt, stünde ungeschützt da. Keyframes zählen
     nicht: die sind nur Beschreibungen und lösen von sich aus nichts aus. */
  const ungeschuetzt = (text) => {
    const start = text.indexOf('@supports (animation-timeline: view())');
    if (start === -1) return ['kein @supports-Block gefunden'];
    let tiefe = 0, ende = text.length;
    for (let i = text.indexOf('{', start); i < text.length; i++) {
      if (text[i] === '{') tiefe++;
      else if (text[i] === '}') { tiefe--; if (tiefe === 0) { ende = i + 1; break; } }
    }
    const rest = text.slice(0, start) + text.slice(ende);
    return rest.split('\n')
      .map(z => z.trim())
      .filter(z => /^animation(-timeline|-range|-name|-duration)?\s*:/.test(z));
  };
  const draussen = ungeschuetzt(css);
  pruefe('in bewegung.css steht KEINE Animationsregel außerhalb des @supports-Blocks',
    draussen.length === 0, draussen.join(' | '));
  pruefe('GEGENBEWEIS: eine Regel außerhalb des Blocks würde erkannt',
    ungeschuetzt(css + '\n.br-titel {\n  animation: mm-auf-titel 1s both;\n}\n').length === 1,
    JSON.stringify(ungeschuetzt(css + '\n.br-titel {\n  animation: mm-auf-titel 1s both;\n}\n')));
}

chrome.beenden(); server.beenden();
bericht();
