/* Prüft, dass es auf jeder Seite GENAU EINEN Scrollbereich gibt.

   Der Fehler, aus dem diese Prüfung entstanden ist: Das versteckte
   Spamfallen-Feld des Kontaktformulars war `position:absolute`, und
   `.br-scroller` war nicht positioniert. Ein absolut positioniertes Kind
   sucht sich seinen Bezugsrahmen beim nächsten POSITIONIERTEN Vorfahren --
   das war der <body>. Das Feld landete dadurch bei Dokumenthöhe 9303px,
   obwohl es im Scroller sitzt, und zog das ganze FENSTER auf 8403px
   Scrollhöhe auf.

   Sichtbar war das als zwei Rollbalken nebeneinander: Man konnte hinter das
   Seitenende weiterscrollen, und mit etwas Pech schob sich die ganze
   Anwendung nach oben aus dem Bild.

   Warum keine der 328 bisherigen Prüfungen das gesehen hat: Alle messen
   INNERHALB des Scrollers (Abschnittshöhen, Leistenpositionen, Textinhalt).
   Dass das Fenster daneben ebenfalls scrollt, fällt dabei nicht auf --
   die Messwerte im Scroller sind ja alle korrekt. */
import { starteChrome, oeffne, pruefe, bericht } from './chrome.mjs';
import { starteServer } from './server.mjs';

const wurzel = new URL('../HOCHLADEN/', import.meta.url).pathname;
const server = await starteServer({ wurzel, port: 8913 });
const chrome = await starteChrome({ port: 9353 });

/* Der Brief und eine Welt -- beide benutzen einen inneren Scrollbereich. */
const SEITEN = [
  { name: 'der Brief', pfad: '/' },
  { name: 'eine Welt', pfad: '/welt/the-race-automatisierung' },
];

for (const { name, pfad } of SEITEN) {
  const s = await oeffne('http://127.0.0.1:8913' + pfad, { port: 9353, breite: 1280, hoehe: 900 });
  await s.warte(3000);

  const mass = JSON.parse(await s.werte(`(() => {
    const d = document.documentElement;
    /* Wer ragt über die Fensterhöhe hinaus, obwohl er es nicht sollte? */
    const uebeltaeter = [];
    document.querySelectorAll('body *').forEach(el => {
      if (!el.offsetHeight) return;
      const unten = el.getBoundingClientRect().bottom + (document.scrollingElement.scrollTop || 0);
      if (unten > innerHeight + 40)
        uebeltaeter.push(el.tagName + '.' + (el.className || el.id || '')
          + ' bei ' + Math.round(unten) + 'px (pos=' + getComputedStyle(el).position + ')');
    });
    const sc = document.querySelector('.br-scroller, .welt-scroller, #scroller');
    const fensterUeberhang = d.scrollHeight - d.clientHeight;
    const innenUeberhang = sc ? sc.scrollHeight - sc.clientHeight : 0;
    return JSON.stringify({
      fensterUeberhang, innenUeberhang,
      scrollende: (fensterUeberhang > 1 ? 1 : 0) + (innenUeberhang > 1 ? 1 : 0),
      uebeltaeter: uebeltaeter.slice(0, 5),
    });
  })()`));

  /* Der Vertrag ist NICHT "das Fenster scrollt nie" -- eine Welt-Seite
     scrollt absichtlich im Fenster und hat gar keinen inneren Bereich.
     Der Vertrag ist: es scrollt GENAU EINER von beiden. Zwei gleichzeitig
     ergeben die zwei Rollbalken, über die Lucas gestolpert ist. */
  pruefe(`${name}: es scrollt genau ein Bereich, nicht zwei`,
    mass.scrollende === 1,
    `Fenster: ${mass.fensterUeberhang}px · innerer Bereich: ${mass.innenUeberhang}px`
    + (mass.scrollende !== 1 && mass.uebeltaeter.length ? ' — ' + mass.uebeltaeter.join(' | ') : ''));

  /* Und im inneren Bereich darf hinter dem letzten Inhalt keine halbe Seite
     Leerlauf stehen. Etwas Schluss-Luft ist Absicht (96px Polsterung),
     ein ganzer Bildschirm wäre ein Fehler. */
  const innen = JSON.parse(await s.werte(`(() => {
    const sc = document.querySelector('.br-scroller, .welt-scroller, #scroller');
    if (!sc) return JSON.stringify({ ohneScroller: true });
    let tiefste = 0, wer = '';
    sc.querySelectorAll('*').forEach(el => {
      if (!el.offsetHeight) return;
      const b = el.getBoundingClientRect().bottom - sc.getBoundingClientRect().top + sc.scrollTop;
      if (b > tiefste) { tiefste = b; wer = el.tagName + '.' + (el.className || ''); }
    });
    return JSON.stringify({
      ueberhang: Math.round(sc.scrollHeight - tiefste),
      hoehe: sc.clientHeight, tiefste: Math.round(tiefste), wer,
    });
  })()`));

  if (innen.ohneScroller) {
    /* Kein innerer Bereich ist voellig in Ordnung (Welt-Seiten) -- dann
       gilt dieselbe Frage fuer das Dokument selbst. */
    const doku = JSON.parse(await s.werte(`(() => {
      let tiefste = 0, wer = '';
      document.querySelectorAll('body *').forEach(el => {
        if (!el.offsetHeight) return;
        const b = el.getBoundingClientRect().bottom + (document.scrollingElement.scrollTop || 0);
        if (b > tiefste) { tiefste = b; wer = el.tagName + '.' + (el.className || ''); }
      });
      return JSON.stringify({ ueberhang: Math.round(document.documentElement.scrollHeight - tiefste),
        hoehe: innerHeight, wer });
    })()`));
    pruefe(`${name}: hinter dem letzten Inhalt steht kein halber Bildschirm Leerlauf`,
      doku.ueberhang < doku.hoehe * 0.5,
      doku.ueberhang + 'px hinter ' + doku.wer);
  } else {
    pruefe(`${name}: hinter dem letzten Inhalt steht kein halber Bildschirm Leerlauf`,
      innen.ueberhang < innen.hoehe * 0.5,
      innen.ueberhang + 'px hinter ' + innen.wer + ' (halber Bildschirm wären ' + Math.round(innen.hoehe * 0.5) + 'px)');
  }

  const fehler = s.fehlerAufSeite();
  pruefe(`${name}: keine JavaScript-Fehler`, fehler.length === 0, fehler.join(' | '));
  await s.zu();
}

/* GEGENBEWEIS: Genau den alten Zustand wieder herstellen und zeigen, dass
   die Prüfung dann fällt. Nur im Browser, die Datei auf der Platte bleibt
   unangetastet.

   Seit dem Umbau gehört DREIERLEI zum alten Zustand -- der fehlende
   Bezugsrahmen am Scroller allein reicht nicht mehr aus, um den Fehler
   auszulösen. Zwei spätere Änderungen fangen ihn nebenbei mit ab:

   - .br-rand schneidet die Deko-Blumen an den Seitenrändern ab
     ("overflow: clip" gilt für den ganzen Teilbaum).
   - .br-formular blendet sich beim Scrollen ein, und dabei steht eine
     Verschiebung (transform) darauf. Ein Element mit transform ist selbst
     Bezugsrahmen für absolut positionierte Kinder -- das Spamfallen-Feld
     kann dadurch gar nicht mehr bis zum <body> durchreichen.

   Beides wird hier mit ausgeschaltet. Sonst wäre dieser Gegenbeweis still
   verstummt und die Prüfung darüber ein Blindgänger geworden -- man hätte
   ihr nicht mehr angesehen, ob sie noch etwas misst. */
{
  const s = await oeffne('http://127.0.0.1:8913/', { port: 9353, breite: 1280, hoehe: 900 });
  await s.warte(3000);
  const vorher = await s.werte(`document.documentElement.scrollHeight - document.documentElement.clientHeight`);
  const nachher = await s.werte(`(() => {
    const sc = document.querySelector('.br-scroller');
    sc.style.position = 'static';                       // der alte, kaputte Zustand
    document.querySelector('.br-rand').style.overflowX = 'visible';   // und ohne den Schnitt
    document.querySelector('.br-formular').style.animation = 'none';   // und ohne die Verschiebung
    const v = document.querySelector('.versteckt');
    v.style.cssText = 'position:absolute; left:-9999px;';
    void document.documentElement.offsetHeight;         // Neuberechnung erzwingen
    return document.documentElement.scrollHeight - document.documentElement.clientHeight;
  })()`);
  pruefe('GEGENBEWEIS: ohne den Bezugsrahmen im Scroller scrollt das Fenster wieder',
    Number(vorher) <= 1 && Number(nachher) > 1000,
    `vorher ${vorher}px, ohne Bezugsrahmen ${nachher}px`);
  await s.zu();
}

chrome.beenden(); server.beenden();
bericht();
