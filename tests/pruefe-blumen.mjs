/* Prüft die Deko-Blumen im Brief und in den Welten (assets/blumen.js,
   assets/blumen.css).

   Worum es geht: Lucas hatte die Blumen auf der alten Startseite überall
   verteilt; beim Umbau auf den Brief sind sie verschwunden. Sie kommen
   zurück -- aber Deko darf nichts kaputtmachen. Genau diese drei Arten,
   etwas kaputtzumachen, deckt diese Prüfung ab, und alle drei sind hier
   schon einmal wirklich passiert:

   0. Zwei Blumen liegen übereinander und sehen aus wie ein Fleck.
   1. Deko liegt über dem Text und macht ihn schlechter lesbar.
   2. Deko ragt seitlich hinaus und erzeugt einen zweiten Rollbalken
      (siehe pruefe-scrollen.mjs -- damals war es das versteckte
      Spamfallen-Feld).
   3. Deko hängt unter dem letzten Absatz und klebt eine leere Fläche ans
      Seitenende.

   Dazu die Lehre aus pruefe-blume.mjs: ein GERATENES Maß hat die Blume
   schon einmal an zwei Kanten abgesägt. Hier wird deshalb im Browser
   nachgemessen, ob das Seitenverhältnis der gezeichneten Blume wirklich zu
   ihrer viewBox passt. */
import { starteChrome, oeffne, pruefe, bericht } from './chrome.mjs';
import { starteServer } from './server.mjs';

const wurzel = new URL('../HOCHLADEN/', import.meta.url).pathname;
const server = await starteServer({ wurzel, port: 8917 });
const chrome = await starteChrome({ port: 9357 });
const ADR = 'http://127.0.0.1:8917';

/* Die drei nachgemessenen Formen. Muss zu FORMEN in assets/blumen.js und zu
   den <g id="bl-…"> in assets/shared.js passen. */
const FORMEN = {
  'bl-a': [303.13, 275.3],
  'bl-b': [349.23, 339.2],
  'bl-c': [474.6, 413.62],
};

/* Was als "Text" gilt. Ein <figure> mit Bild ist bewusst NICHT dabei: ein
   Bild in voller Breite darf eine Blume verdecken (sie liegt dahinter),
   das stört niemanden. Lesbarkeit ist die Frage, nicht Überlappung. */
const TEXT_MESSUNG = `(() => {
  const textig = [...document.querySelectorAll('#brief *, #inhalt *')].filter(el => {
    if (!el.offsetWidth || !el.offsetHeight) return false;
    if (el.closest('.mm-blume')) return false;
    /* nur Elemente mit EIGENEM sichtbarem Text, nicht deren Hüllen --
       sonst zählte jede <section> als ein riesiger Textblock */
    return [...el.childNodes].some(k => k.nodeType === 3 && k.textContent.trim());
  }).map(el => { const r = el.getBoundingClientRect();
    return { l: r.left, r: r.right, o: r.top, u: r.bottom,
             wer: el.tagName + '.' + (el.className || ''), text: el.textContent.trim().slice(0, 30) }; });

  const blumen = [...document.querySelectorAll('.mm-blume')].map(el => {
    const r = el.getBoundingClientRect();
    return { l: r.left, r: r.right, o: r.top, u: r.bottom, breite: r.width, hoehe: r.height };
  });

  const treffer = [];
  for (const b of blumen) for (const t of textig) {
    if (b.r > t.l && b.l < t.r && b.u > t.o && b.o < t.u)
      treffer.push(t.wer + ' „' + t.text + '“');
  }
  return JSON.stringify({ blumen: blumen.length, textstellen: textig.length, treffer: treffer.slice(0, 6) });
})()`;

/* ================= Der Brief ================= */
{
  const s = await oeffne(ADR + '/', { port: 9357, breite: 1440, hoehe: 900 });
  await s.warte(3500);

  const d = JSON.parse(await s.werte(`(() => {
    const blumen = [...document.querySelectorAll('.mm-blume')];
    const abschnitte = [...document.querySelectorAll('.br-abschnitt')];
    return JSON.stringify({
      anzahl: blumen.length,
      abschnitte: abschnitte.length,
      ohneBlume: abschnitte.filter(a => !a.querySelector(':scope > .mm-blume')).length,
      /* Form und viewBox jeder einzelnen Blume, so wie sie WIRKLICH im
         Dokument steht -- nicht so, wie sie im Quelltext aussieht. */
      formen: blumen.map(el => ({
        id: (el.querySelector('use')?.getAttribute('href') || '').replace('#', ''),
        box: el.querySelector('svg')?.getAttribute('viewBox') || '(fehlt)',
        /* NICHT getBoundingClientRect() nehmen: die Blume ist gedreht, und
           das waere die umschliessende Box der DREHUNG -- mit einem ganz
           anderen Seitenverhaeltnis. offsetWidth/offsetHeight sind die
           Layout-Masse und von der Drehung unberuehrt. (Auf dem <svg>
           gaebe es sie gar nicht, das ist kein HTML-Element.) */
        verhaeltnis: el.offsetHeight ? el.offsetWidth / el.offsetHeight : 0,
      })),
    });
  })()`));

  pruefe('es gibt überhaupt Blumen zu prüfen (sonst wäre die Prüfung hohl)',
    d.anzahl >= 12, d.anzahl + ' Blumen auf ' + d.abschnitte + ' Abschnitten');
  pruefe('jeder Abschnitt trägt mindestens eine Blume',
    d.abschnitte > 0 && d.ohneBlume === 0, d.ohneBlume + ' Abschnitte ohne');

  const falscheBox = d.formen.filter(f => {
    const soll = FORMEN[f.id];
    return !soll || f.box !== `0 0 ${soll[0]} ${soll[1]}`;
  });
  pruefe('jede Blume trägt die nachgemessene viewBox ihrer eigenen Form',
    falscheBox.length === 0,
    falscheBox.map(f => f.id + ': ' + f.box).join(' | '));

  const falschesVerhaeltnis = d.formen.filter(f => {
    const soll = FORMEN[f.id]; if (!soll) return true;
    return Math.abs(f.verhaeltnis - soll[0] / soll[1]) / (soll[0] / soll[1]) > 0.03;
  });
  pruefe('…und wird auf dem Bildschirm im richtigen Seitenverhältnis gezeichnet (nicht gestaucht)',
    falschesVerhaeltnis.length === 0,
    falschesVerhaeltnis.map(f => f.id + ': ' + f.verhaeltnis.toFixed(3)).join(' | '));

  /* ---- Keine Blume liegt auf einer anderen ----
     Nachgereicht: Die erste Fassung hat jede Blume gegen den TEXT gemessen
     und dabei übersehen, dass zwei Blumen einander überlappen können. Im
     ersten Abschnitt lagen genau deshalb zwei übereinander -- Lucas hat es
     im ersten Blick gesehen, die Prüfung nie. Eine Prüfung, die nur eine
     von zwei möglichen Überlappungen kennt, ist keine halbe Prüfung,
     sondern eine, der man nicht ansieht, was sie NICHT abdeckt. */
  const UEBEREINANDER = `(() => {
    const b = [...document.querySelectorAll('.mm-blume')].map(el => {
      const r = el.getBoundingClientRect();
      return { l: r.left, r: r.right, o: r.top, u: r.bottom,
               wer: el.className.replace('mm-blume ', '') + ' ' + el.style.width };
    });
    const paare = [];
    for (let i = 0; i < b.length; i++) for (let k = i + 1; k < b.length; k++) {
      const a = b[i], c = b[k];
      const quer = Math.min(a.r, c.r) - Math.max(a.l, c.l);
      const hoch = Math.min(a.u, c.u) - Math.max(a.o, c.o);
      /* Ein paar Pixel Berührung an den Ecken sind bei gedrehten Formen
         kaum zu sehen. Erst eine echte gemeinsame Fläche zählt. */
      if (quer > 12 && hoch > 12)
        paare.push(\`\${i}(\${a.wer}) × \${k}(\${c.wer}): \${Math.round(quer)}×\${Math.round(hoch)}px\`);
    }
    return JSON.stringify({ anzahl: b.length, paare });
  })()`;

  for (const breite of [1440, 1180, 900]) {
    await s.groesse(breite, 900);
    await s.warte(350);
    const u = JSON.parse(await s.werte(UEBEREINANDER));
    pruefe(`bei ${breite}px liegt KEINE Blume auf einer anderen`,
      u.paare.length === 0, u.paare.slice(0, 4).join(' | ') || u.anzahl + ' Blumen geprüft');
  }

  /* GEGENBEWEIS: zwei Blumen absichtlich übereinanderlegen. */
  {
    await s.groesse(1440, 900); await s.warte(300);
    const g = JSON.parse(await s.werte(`(() => {
      const b = [...document.querySelectorAll('.mm-blume')];
      const alt = b[1].style.cssText;
      /* Nummer 1 auf Nummer 0 schieben: gleiche Seite, gleiche Höhe. */
      b[1].className = b[0].className;
      b[1].style.setProperty('--y', b[0].style.getPropertyValue('--y'));
      b[1].style.setProperty('--raus', b[0].style.getPropertyValue('--raus'));
      void b[1].offsetHeight;
      const m = ${UEBEREINANDER};
      b[1].className = 'mm-blume mm-blume-rechts'; b[1].style.cssText = alt;
      return m;
    })()`));
    pruefe('GEGENBEWEIS: zwei übereinandergeschobene Blumen würden erkannt',
      g.paare.length > 0, g.paare.slice(0, 2).join(' | ') || 'kein Treffer — die Prüfung wäre blind!');
  }

  /* ---- Der Kernvertrag: keine Blume liegt hinter Text ---- */
  for (const breite of [1440, 1180, 900]) {
    await s.groesse(breite, 900);
    await s.warte(350);
    const m = JSON.parse(await s.werte(TEXT_MESSUNG));
    pruefe(`bei ${breite}px liegt KEINE Blume hinter Text`,
      m.treffer.length === 0,
      `${m.blumen} Blumen gegen ${m.textstellen} Textstellen` +
      (m.treffer.length ? ' — ' + m.treffer.join(' | ') : ''));
  }

  /* ---- Kein zweiter Rollbalken ---- */
  await s.groesse(1440, 900); await s.warte(300);
  const rollen = JSON.parse(await s.werte(`(() => {
    const sc = document.querySelector('.br-scroller');
    const rand = document.querySelector('.br-rand');
    const d = document.documentElement;
    return JSON.stringify({
      randX: getComputedStyle(rand).overflowX,
      innenQuer: sc.scrollWidth - sc.clientWidth,
      fensterQuer: d.scrollWidth - d.clientWidth,
    });
  })()`));
  pruefe('die Blumen erzeugen keinen waagerechten Rollbalken',
    rollen.innenQuer <= 1 && rollen.fensterQuer <= 1, JSON.stringify(rollen));
  /* Der erste Versuch stand als "overflow-x: clip" direkt am Scroller -- und
     der Browser hatte daraus stillschweigend "hidden" gemacht, weil die
     andere Achse scrollt. Kein Rollbalken, aber weiterhin ein Scrollbereich:
     scrollWidth meldete 4px Überstand, und per Skript liess sich die Spalte
     seitlich verschieben. Deshalb wird hier ausdrücklich nachgesehen, dass
     wirklich "clip" gilt und nicht die stille Ersatzform. */
  pruefe('…und zwar durch echtes Abschneiden ("clip"), nicht durch die stille Ersatzform "hidden"',
    rollen.randX === 'clip', 'overflow-x am .br-rand ist "' + rollen.randX + '"');

  /* ---- Kein Leerlauf am Seitenende ---- */
  const laenge = JSON.parse(await s.werte(`(() => {
    const sc = document.querySelector('.br-scroller');
    const mit = sc.scrollHeight;
    const blumen = [...document.querySelectorAll('.mm-blume')];
    blumen.forEach(b => { b.style.display = 'none'; });
    void sc.offsetHeight;
    const ohne = sc.scrollHeight;
    blumen.forEach(b => { b.style.display = ''; });
    return JSON.stringify({ mit, ohne });
  })()`));
  pruefe('die Blumen verlängern die Seite nicht (kein Leerlauf hinter dem letzten Absatz)',
    Math.abs(laenge.mit - laenge.ohne) <= 1,
    `mit Blumen ${laenge.mit}px, ohne ${laenge.ohne}px`);

  /* ================= GEGENBEWEISE =================
     Alle drei Verträge werden LIVE im Browser verletzt. Die Dateien auf der
     Platte bleiben unangetastet. */

  const g1 = JSON.parse(await s.werte(`(() => {
    const b = document.querySelector('.mm-blume');
    const alt = b.style.cssText;
    b.style.right = 'auto'; b.style.left = '40px';        // mitten in die Spalte
    void b.offsetHeight;
    const m = ${TEXT_MESSUNG};
    b.style.cssText = alt;
    return m;
  })()`));
  pruefe('GEGENBEWEIS: eine Blume mitten in der Spalte würde erkannt',
    g1.treffer.length > 0, g1.treffer.join(' | ') || 'kein Treffer — die Prüfung wäre blind!');

  /* Bei 900px ragen die rechten Blumen wirklich über den Rand -- und nur
     rechts zählt: Überstand nach LINKS ist in einer Links-nach-rechts-Seite
     gar nicht erreichbar und erzeugt nie einen Rollbalken. Bei 1440px gäbe
     es deshalb nichts zu sehen, und der Gegenbeweis wäre ein Blindgänger
     (genau so ist er beim ersten Versuch durchgefallen). */
  await s.groesse(900, 900); await s.warte(350);
  const g2 = JSON.parse(await s.werte(`(() => {
    const sc = document.querySelector('.br-scroller');
    const rand = document.querySelector('.br-rand');
    rand.style.overflowX = 'visible';                     // der Zustand ohne den Schnitt
    void sc.offsetHeight;
    const quer = sc.scrollWidth - sc.clientWidth;
    rand.style.overflowX = '';
    return JSON.stringify({ quer });
  })()`));
  pruefe('GEGENBEWEIS: ohne "overflow-x: clip" schiebt die Deko den Scroller quer auf',
    g2.quer > 20, g2.quer + 'px waagerecht bei 900px Fensterbreite');
  await s.groesse(1440, 900); await s.warte(350);

  const g3 = JSON.parse(await s.werte(`(() => {
    const sc = document.querySelector('.br-scroller');
    const vorher = sc.scrollHeight;
    const letzter = [...document.querySelectorAll('.br-abschnitt')].pop();
    const b = letzter.querySelector('.mm-blume');
    b.style.bottom = '-900px';                            // hängt unter den Anker
    void sc.offsetHeight;
    const nachher = sc.scrollHeight;
    b.style.bottom = '';
    return JSON.stringify({ vorher, nachher });
  })()`));
  pruefe('GEGENBEWEIS: eine Blume, die unter ihren Anker ragt, verlängert die Seite',
    g3.nachher > g3.vorher + 100, `${g3.vorher}px -> ${g3.nachher}px`);

  const fehler = s.fehlerAufSeite();
  pruefe('Brief: keine JavaScript-Fehler', fehler.length === 0, fehler.join(' | '));

  await s.groesse(1440, 900); await s.warte(300);
  await s.bild(new URL('./bilder/blumen-brief.png', import.meta.url).pathname);
  await s.zu();
}

/* ================= Eine Welt ================= */
{
  const s = await oeffne(ADR + '/welt/verteidiger-isfj-t', { port: 9357, breite: 1440, hoehe: 900 });
  await s.warte(3000);

  const anzahl = Number(await s.werte(`document.querySelectorAll('.mm-blume').length`));
  pruefe('auch eine Welt bekommt Blumen', anzahl >= 3, String(anzahl));

  const m = JSON.parse(await s.werte(TEXT_MESSUNG));
  pruefe('Welt: keine Blume liegt hinter Text', m.treffer.length === 0,
    `${m.blumen} Blumen gegen ${m.textstellen} Textstellen` +
    (m.treffer.length ? ' — ' + m.treffer.join(' | ') : ''));

  const quer = Number(await s.werte(
    `document.documentElement.scrollWidth - document.documentElement.clientWidth`));
  pruefe('Welt: kein waagerechter Rollbalken', quer <= 1, quer + 'px');

  const fehler = s.fehlerAufSeite();
  pruefe('Welt: keine JavaScript-Fehler', fehler.length === 0, fehler.join(' | '));
  await s.bild(new URL('./bilder/blumen-welt.png', import.meta.url).pathname);
  await s.zu();
}

chrome.beenden(); server.beenden();
bericht();
