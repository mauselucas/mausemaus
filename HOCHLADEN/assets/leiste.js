/* mausemaus — Zeitleiste. Weiß nichts von Projekten, Supabase oder dem Brief:
   sie bekommt eine Liste von Abschnitten und einen Scroll-Bereich, sonst nichts. */
(() => {
  const HALTEN = 760;      // wie lang sie nach Scrollbeginn noch offen bleibt
  const NACH_MAUS = 1100;  // wie lang sie nach Mausaustritt noch offen bleibt
  const SCHWELLE = 120;    // ab wie viel Scrollen sie überhaupt zugeht
  const LUFT = 8;          // Mindestabstand zwischen zwei Etiketten
  const LUFT_SEG = 6;      // sichtbarer Abstand zwischen zwei Segmenten (~6 px, s. Vorgaben)
  const BLASS = '#D6D3C4';
  const LAENGE = 214;      // Sekunden, auf die der Timecode abgebildet wird

  window.mmLeiste = function (wurzel, abschnitte, { scroller }) {
    wurzel.className = 'mml';
    wurzel.innerHTML =
      '<div class="mml-marke">mausemaus<em>.</em></div>' +
      '<div class="mml-mini">m</div>' +
      '<div class="mml-gleis"></div>' +
      '<div class="mml-sicht"></div>' +
      '<div class="mml-etiketten"></div>' +
      '<div class="mml-kopf"><div class="mml-rund"></div><div class="mml-zeit">00:00</div></div>' +
      '<div class="mml-fuss">' +
        '<div><span style="background:#3E5A78"></span>berufliche Projekte</div>' +
        '<div><span style="background:' + BLASS + '"></span>persönliches</div>' +
      '</div>' +
      '<div class="mml-griff" title="offen halten">‹</div>';

    const gleis = wurzel.querySelector('.mml-gleis'),
          lage  = wurzel.querySelector('.mml-etiketten'),
          kopf  = wurzel.querySelector('.mml-kopf'),
          zeit  = wurzel.querySelector('.mml-zeit'),
          sicht = wurzel.querySelector('.mml-sicht'),
          griff = wurzel.querySelector('.mml-griff');

    let etiketten = [], angepinnt = false, uhr = null,
        letzterStand = 0, zeigerDrin = false, springtGerade = 0;

    const gh = () => gleis.getBoundingClientRect().height;
    const gt = () => gleis.offsetTop;   // gleis liegt in .mml (position:relative) — hier stimmt offsetTop
    const stopUhr = () => { clearTimeout(uhr); uhr = null; };

    /* ACHTUNG: element.offsetTop zählt ab dem nächsten POSITIONIERTEN Vorfahren,
       nicht ab dem Scroll-Bereich. Auf dem Handy scrollt das Fenster statt des
       Kastens, und dann stimmt offsetTop nicht mehr. Deshalb immer über die
       tatsächliche Lage rechnen — das gilt in beiden Fällen. */
    const amFenster = () => scroller === document.scrollingElement;
    const obenVon = el => amFenster()
      ? el.getBoundingClientRect().top + window.scrollY
      : el.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
    const hoeheVon = el => el.getBoundingClientRect().height;
    const standVon = () => amFenster() ? window.scrollY : scroller.scrollTop;

    /* Zeiger in der Leiste -> niemals von selbst zuklappen. Das wird hier
       geprüft, nicht schon in aktualisieren(): der Zeitgeber darf ruhig
       anlaufen, wenn wer wegscrollt, während der Zeiger drin ist — er
       verfängt nur nicht. Zwei Prüfstellen für dieselbe Sperre wären von
       außen nicht unterscheidbar (keine Prüfung könnte zeigen, ob eine
       davon fehlt) und sind darum bewusst auf eine einzige reduziert. */
    function zumachen() {
      if (angepinnt || zeigerDrin) return;
      wurzel.classList.add('mml-zu');
    }
    function aufmachen() { wurzel.classList.remove('mml-zu'); }

    /* Klick auf Etikett oder Segment: springen, ohne dass das Scrollen
       als Nutzer-Scrollen gewertet wird — sonst klappt die Leiste zu. */
    function springe(el) {
      springtGerade = Date.now();
      const ziel = Math.max(0, obenVon(el) - 16);
      if (amFenster()) window.scrollTo({ top: ziel, behavior: 'smooth' });
      else scroller.scrollTo({ top: ziel, behavior: 'smooth' });
    }

    function bauen() {
      gleis.querySelectorAll('.mml-seg').forEach(s => s.remove());
      lage.innerHTML = ''; etiketten = [];
      const ganz = scroller.scrollHeight, H = gh(), T = gt(), mitten = [];
      const LUECKE = LUFT_SEG / H * 100;   // Lücke in Prozent des Gleises

      /* Jedes Segment reicht bis zum Beginn des nächsten Abschnitts — nicht
         nur bis zum Ende des eigenen Textblocks. Sonst richtet sich die
         Lücke zwischen zwei Segmenten nach zufälligem Weißraum im Fließtext
         (z. B. dem Absatzabstand) statt nach einem festen, sichtbaren Maß.
         Das erste Segment beginnt am Anfang des Gleises, das letzte reicht
         bis zu dessen Ende — wie bei einer echten Schnittzeitleiste beginnt
         der erste Clip am Bandanfang und der letzte endet am Bandende, egal
         wie viel Polsterung (z. B. padding-top/-bottom) davor oder danach
         im Text steht. Sonst bleibt das Gleis oben und unten ungefüllt. */
      const anfang = abschnitte.map((ab, i) => i === 0 ? 0 : obenVon(ab.element) / ganz * 100);
      const ende = abschnitte.map((ab, i) => i < abschnitte.length - 1 ? anfang[i + 1] : 100);

      abschnitte.forEach((ab, i) => {
        const s = document.createElement('div');
        s.className = 'mml-seg';
        const o = anfang[i];
        const h = Math.max(2.2, ende[i] - o - LUECKE);
        s.style.top = o + '%'; s.style.height = h + '%';
        s.style.background = ab.farbe || BLASS;
        s.onclick = () => springe(ab.element);
        gleis.appendChild(s);
        mitten.push(T + (o + h / 2) / 100 * H);
      });

      abschnitte.forEach(ab => {
        const e = document.createElement('div');
        e.className = 'mml-et';
        e.innerHTML = '<span class="mml-punkt" style="background:' + (ab.farbe || BLASS) + '"></span>' +
                      '<span class="mml-titel"></span>';
        e.querySelector('.mml-titel').textContent = ab.titel;
        e.onclick = () => springe(ab.element);
        lage.appendChild(e); etiketten.push(e);
      });

      /* Etiketten stoßen sich ab: erst nach unten durchschieben, dann,
         falls es unten rausläuft, von hinten wieder zurück. */
      const hh = etiketten.map(e => e.getBoundingClientRect().height);
      const z = mitten.map((m, i) => m - hh[i] / 2);
      const OBEN = T - 4, UNTEN = T + H + 4;
      for (let i = 1; i < z.length; i++) {
        const min = z[i - 1] + hh[i - 1] + LUFT;
        if (z[i] < min) z[i] = min;
      }
      if (z[z.length - 1] + hh[hh.length - 1] > UNTEN) {
        z[z.length - 1] = UNTEN - hh[hh.length - 1];
        for (let i = z.length - 2; i >= 0; i--) {
          const max = z[i + 1] - hh[i] - LUFT;
          if (z[i] > max) z[i] = max;
        }
      }
      if (z[0] < OBEN) z[0] = OBEN;

      etiketten.forEach((e, i) => {
        e.style.top = z[i] + 'px';
        const eigen = z[i] + hh[i] / 2, weg = eigen - mitten[i];
        if (Math.abs(weg) > 7) {
          const f = document.createElement('div');
          f.className = 'mml-fuehrung';
          f.style.left = '40px';
          f.style.top = Math.min(eigen, mitten[i]) + 'px';
          f.style.height = Math.abs(weg) + 'px';
          lage.appendChild(f);
        }
      });
    }

    const mmss = f => {
      const s = Math.round(f * LAENGE);
      return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
    };

    function aktualisieren() {
      const stand = standVon();
      const max = scroller.scrollHeight - scroller.clientHeight;
      const f = max > 0 ? Math.min(1, stand / max) : 0;
      const anteil = stand / scroller.scrollHeight;
      const sichtbar = scroller.clientHeight / scroller.scrollHeight;

      kopf.style.top = (gt() + anteil * gh()) + 'px';
      sicht.style.top = (gt() + anteil * gh()) + 'px';
      sicht.style.height = (sichtbar * gh()) + 'px';
      zeit.textContent = mmss(f);

      const mitte = stand + scroller.clientHeight * 0.45;
      let akt = 0;
      abschnitte.forEach((ab, i) => { if (obenVon(ab.element) <= mitte) akt = i; });
      /* Der letzte Abschnitt kann nie bis zur Schwelle hochscrollen,
         weil darunter kein Text mehr kommt — also ganz unten immer er. */
      if (max > 0 && stand >= max - 4) akt = abschnitte.length - 1;
      etiketten.forEach((e, i) => e.classList.toggle('mml-jetzt', i === akt));

      const runter = stand > letzterStand;
      letzterStand = stand;

      if (angepinnt) return;
      /* Ein durch Klick oder Tipp ausgelöster Sprung ist kein Wegscrollen.
         Auf Berührungsgeräten gibt es kein mouseenter — dort ist das die
         EINZIGE Sperre, die das Zuklappen beim Antippen eines Projekts
         verhindert. Genau dieser Fehler wurde gemeldet. */
      if (Date.now() - springtGerade < 900) return;
      /* Hinweis: "Zeiger ist in der Leiste" wird NICHT hier abgefangen,
         sondern allein in zumachen(). Zwei Sperren für dieselbe Sache
         lassen sich einzeln nicht widerlegen — nimmt man eine weg,
         ändert sich nichts Sichtbares, und keine Prüfung merkt es. */

      /* Hier gibt es KEINEN Zweig, der die Leiste wieder aufmacht — das ist
         die ganze Regel. Ist sie zu, bleibt sie zu: `!contains('mml-zu')`
         verhindert, dass überhaupt noch ein Zeitgeber anläuft, und geöffnet
         wird nur noch über die Maus oder den Griff. Ein Kippschalter, der bei
         jedem Abschnittswechsel aufspringt, ist lästiger als eine Leiste, die
         man einmal selbst aufmacht.
         Ein zusätzlicher Merker dafür wäre totes Gewicht: Man könnte ihn
         entfernen, ohne dass sich etwas ändert — und genau solche Sperren
         lassen sich nicht widerlegen. */
      if (stand <= SCHWELLE) { stopUhr(); return; }
      if (runter && !wurzel.classList.contains('mml-zu') && !uhr)
        uhr = setTimeout(() => { uhr = null; zumachen(); }, HALTEN);
    }

    const rein  = () => { zeigerDrin = true;  stopUhr(); aufmachen(); };
    const raus  = () => {
      zeigerDrin = false; stopUhr();
      if (!angepinnt && standVon() > SCHWELLE)
        uhr = setTimeout(() => { uhr = null; zumachen(); }, NACH_MAUS);
    };
    wurzel.addEventListener('mouseenter', rein);
    wurzel.addEventListener('mouseleave', raus);
    griff.onclick = () => {
      angepinnt = !angepinnt; griff.textContent = angepinnt ? '›' : '‹';
      stopUhr(); if (angepinnt) aufmachen();
    };
    /* Scrollt das Fenster, hängt das Ereignis am Fenster — nicht am Element. */
    const wo = amFenster() ? window : scroller;
    wo.addEventListener('scroll', aktualisieren, { passive: true });
    const beiGroesse = () => { bauen(); aktualisieren(); };
    window.addEventListener('resize', beiGroesse);

    bauen(); aktualisieren();

    return {
      neuBerechnen: beiGroesse,
      zerstoeren() {
        stopUhr();
        wurzel.removeEventListener('mouseenter', rein);
        wurzel.removeEventListener('mouseleave', raus);
        wo.removeEventListener('scroll', aktualisieren);
        window.removeEventListener('resize', beiGroesse);
        wurzel.innerHTML = '';
      },
    };
  };
})();
