/* mausemaus — verteilt die Deko-Blumen an Ankern im Text.

   Bewusst KEIN Math.random(): Die Verteilung wird fest aus dem laufenden
   Index abgeleitet. Sie sieht gestreut aus, ist aber bei jedem Laden
   dieselbe. Wäre sie zufällig, wären Bildschirmfotos und Prüfungen wertlos
   -- man könnte nie sagen, ob sich etwas verändert hat oder nur der Würfel
   anders gefallen ist.

   Die Formen kommen aus #mm-blumen (siehe shared.js) und werden per <use>
   geholt. Die viewBox-Werte hier sind NACHGEMESSEN (getBBox), nicht
   geschätzt -- eine geratene viewBox hat die Blume schon einmal wochenlang
   an zwei Kanten abgesägt, siehe tests/pruefe-blume.mjs. */
(() => {
  const FORMEN = [
    { id: 'bl-a', box: '0 0 303.13 275.3' },
    { id: 'bl-b', box: '0 0 349.23 339.2' },
    { id: 'bl-c', box: '0 0 474.6 413.62' },
  ];

  /* Wertelisten mit unterschiedlichen, teilerfremden Längen (8, 7, 5 …).
     Dadurch wiederholt sich die Kombination erst nach sehr vielen Blumen,
     obwohl jede einzelne Liste kurz ist. */
  const BREITE  = [232, 168, 258, 196, 214, 150, 244, 182];   // 8
  const DREHUNG = [-14, 22, 8, -24, 16, -6, 26];              // 7
  /* Abstand zur Textkante. Die kleinste Zahl hier ist NICHT frei gewählt:
     Die Blumen sind gedreht, und eine Drehung macht das umschließende
     Rechteck breiter als die Blume selbst -- bei 232px Breite und 14 Grad
     rund 22px je Seite, bei 24 Grad bis zu 27px. Mit den ursprünglichen
     20px ragten dadurch zwei Blumen messbar in den Text (aufgefallen in
     pruefe-blumen.mjs, nicht im Bildschirmfoto). Alles ab 44px hat sicher
     Luft. */
  const RAUS    = [44, 92, 58, 120, 72];                      // 5  Abstand zur Spalte
  const HOEHE   = ['8%', '58%', '24%', '70%', '38%', '14%', '64%', '30%', '48%'];  // 9
  const KRAFT   = [1, .72, .92, .58, .84];                    // 5

  const hole = (liste, n) => liste[n % liste.length];

  function blumeBauen(n) {
    const form = FORMEN[n % FORMEN.length];
    const el = document.createElement('div');
    el.className = 'mm-blume mm-blume-' + (n % 2 ? 'rechts' : 'links');
    el.setAttribute('aria-hidden', 'true');
    el.style.width = hole(BREITE, n) + 'px';
    el.style.rotate = hole(DREHUNG, n) + 'deg';
    el.style.opacity = String(hole(KRAFT, n));
    el.style.setProperty('--raus', hole(RAUS, n) + 'px');
    el.style.setProperty('--y', hole(HOEHE, n));
    /* height="auto" gibt es nicht -- die Höhe kommt aus der viewBox und der
       Breite des Elements (siehe blumen.css). So kann das Seitenverhältnis
       gar nicht erst falsch werden. */
    el.innerHTML = '<svg viewBox="' + form.box + '" width="100%" aria-hidden="true">' +
      '<use href="#' + form.id + '"/></svg>';
    return el;
  }

  /* anker: Elemente, an denen Blumen hängen sollen (Abschnitte im Brief,
     einzelne Absätze in einer Welt).
     anzahl: Blumen je Anker. erste: zusätzliche Blumen am ERSTEN Anker --
     oben auf der Seite darf es etwas voller sein, dort schaut man hin. */
  window.mmBlumen = function (anker, { anzahl = 2, erste = 1 } = {}) {
    const liste = (anker || []).filter(Boolean);
    if (!liste.length) return 0;
    let n = 0;
    liste.forEach((el, i) => {
      el.classList.add('mm-blumen-anker');
      const wieViele = anzahl + (i === 0 ? erste : 0);
      for (let j = 0; j < wieViele; j++) el.appendChild(blumeBauen(n++));
    });
    return n;
  };
})();
