/* mausemaus — Sprachwahl (Deutsch / Englisch).

   Grundsatz: Deutsch ist die Seite. Englisch ist eine ERGÄNZUNG, die nur
   dort greift, wo tatsächlich eine Übersetzung hinterlegt ist. Fehlt sie,
   steht der deutsche Text da -- nie eine Lücke. Für einen deutschen
   Besucher ändert dieses Skript nichts: es setzt kein Attribut um und
   tauscht keinen Text.

   Woher die Sprache kommt, in dieser Reihenfolge:
     1. ?lang=en / ?lang=de in der Adresse  (das ist der Link zum Verschicken)
     2. die zuletzt selbst getroffene Wahl  (localStorage)
     3. Deutsch
   Die Sprache des BROWSERS wird bewusst NICHT ausgewertet. Wer die Adresse
   ohne Anhängsel aufruft, bekommt Deutsch -- so ist es gewollt.

   Wird von index.html, welt.html und 404.html im <head> geladen, zusammen
   mit texte.js. Im Kopf, damit <html lang> steht, bevor irgendetwas
   gezeichnet wird; die Arbeit am Dokument wartet auf DOMContentLoaded. */
(() => {
  const SPEICHER = 'mm.sprache';

  /* ---------- 1. Welche Sprache? ---------- */

  const ausAdresse = new URLSearchParams(location.search).get('lang');
  let sprache = 'de';
  if (ausAdresse === 'en' || ausAdresse === 'de') {
    sprache = ausAdresse;
    try { localStorage.setItem(SPEICHER, sprache); } catch {}
  } else {
    try { if (localStorage.getItem(SPEICHER) === 'en') sprache = 'en'; } catch {}
  }

  window.mmSprache = sprache;
  const englisch = sprache === 'en';
  document.documentElement.lang = sprache;

  /* ---------- 2. Feste Texte ---------- */

  window.mmText = function (schluessel) {
    const e = (window.MM_TEXTE || {})[schluessel];
    if (!e) return '';
    return (englisch && e.en) || e.de || '';
  };

  /* ---------- 3. Inhalt aus der Datenbank ----------

     `inhalt_en` überschreibt `inhalt` FELDWEISE und nur mit nicht-leeren
     Werten. Damit behält ein halb übersetzter Block seine übrigen Felder:
     eine Randnotiz mit englischem Titel behält Zeile 1, Zeile 2 und den
     grünen Punkt; ein Türchen behält sein Ziel, ein Kasten seine Farbe.

     Bei Deutsch wird das URSPRÜNGLICHE Objekt zurückgegeben, nicht eine
     Kopie -- so ist ausgeschlossen, dass sich hier etwas einschleicht. */
  window.mmInhaltVon = function (block) {
    const inhalt = (block && block.inhalt) || {};
    if (!englisch) return inhalt;
    const en = block && block.inhalt_en;
    if (!en || typeof en !== 'object') return inhalt;
    const zusammen = Object.assign({}, inhalt);
    for (const [feld, wert] of Object.entries(en)) {
      if (typeof wert === 'string' ? wert.trim() !== '' : wert != null) zusammen[feld] = wert;
    }
    return zusammen;
  };

  /* Titel und Untertitel einer Seite (Tabelle `seiten`). */
  window.mmFeldVon = function (seite, feld) {
    if (!seite) return '';
    if (englisch) {
      const en = seite[feld + '_en'];
      if (typeof en === 'string' && en.trim() !== '') return en;
    }
    return seite[feld] || '';
  };

  /* ---------- 4. Scrollstand über den Sprachwechsel retten ----------
     Der Wechsel lädt die Seite neu (siehe unten). Ohne das hier stünde man
     danach wieder ganz oben -- mitten im Brief besonders ärgerlich. */
  const SCROLL = 'mm.sprache.scroll';

  function scrollMerken(y) {
    try { sessionStorage.setItem(SCROLL, JSON.stringify({ pfad: location.pathname, y })); } catch {}
  }

  window.mmScrollWiederherstellen = function (scroller) {
    let stand = null;
    try {
      stand = JSON.parse(sessionStorage.getItem(SCROLL) || 'null');
      sessionStorage.removeItem(SCROLL);
    } catch {}
    if (!stand || stand.pfad !== location.pathname || !stand.y) return;
    const ziel = scroller || document.scrollingElement;
    ziel.scrollTo({ top: stand.y, behavior: 'auto' });
  };

  /* ---------- 5. Am Dokument arbeiten ---------- */

  function anwenden() {
    umschalterEinrichten();
    if (!englisch) return;              // Deutsch: das HTML stimmt schon

    /* data-mm-t="schluessel"            -> Textinhalt
       data-mm-t-placeholder="schluessel" -> Attribut placeholder
       …dasselbe für title, aria-label, value, content. */
    document.querySelectorAll('[data-mm-t]').forEach(el => {
      const t = window.mmText(el.dataset.mmT);
      if (t) el.textContent = t;
    });
    const attribute = [
      ['data-mm-t-placeholder', 'mmTPlaceholder', 'placeholder'],
      ['data-mm-t-title',       'mmTTitle',       'title'],
      ['data-mm-t-aria-label',  'mmTAriaLabel',   'aria-label'],
      ['data-mm-t-value',       'mmTValue',       'value'],
    ];
    for (const [auswahl, datensatz, attribut] of attribute) {
      document.querySelectorAll('[' + auswahl + ']').forEach(el => {
        const t = window.mmText(el.dataset[datensatz]);
        if (t) el.setAttribute(attribut, t);
      });
    }

    const locale = document.querySelector('meta[property="og:locale"]');
    if (locale) locale.setAttribute('content', 'en_US');
  }


  /* ---------- 6. Der Umschalter ----------

     Im HTML steht ein vollstaendiges <details>: aufklappen kann der
     Browser selbst, die Auswahl sind echte Links. Alles hier ist
     Zugabe -- faellt diese Datei aus, bleibt ein bedienbarer Umschalter
     stehen, nur ohne Feinheiten. */

  const NAMEN = { de: 'Deutsch', en: 'English', nl: 'Nederlands' };

  /* Wie lange der Knopf nach dem ersten Scrollen noch in voller Breite
     stehen bleibt. Bewusst viel laenger als die Zeitleiste links (760 ms):
     Der Umschalter ist fuer jemanden da, der die Seite nicht lesen kann. */
  const BLEIBT = 4200;
  const BLEIBT_NACH_KLICK = 2600;   // nach dem Zuklappen kuerzer
  const SCHWELLE = 100;             // ab so viel Scrollen faengt die Uhr an
  /* Wie lange nach der Sprachwahl die Adresse wechselt. Kein Warten: der
     Browser zeigt die alte Seite weiter, bis die neue antwortet. Die
     380 ms sorgen nur dafuer, dass der letzte Buchstabe gelandet ist. */
  const WECHSEL_DAUER = 380;
  const ZU_DAUER = 220;             // muss zu mms-zu in site.css passen

  /* Flagge und Name im Knopf auf die gewaehlte Sprache setzen.
     Laeuft ZWEIMAL: sofort (Zeile direkt hinter dem Markup) und spaeter
     mit allem Uebrigen -- sonst blitzt bei einem englischen Aufruf kurz
     "Deutsch" auf. */
  let standGesetzt = false;
  window.mmUmschalterStand = function () {
    const kasten = document.querySelector('.mm-sprache');
    if (!kasten || standGesetzt) return;
    const flagge = kasten.querySelector('.mms-flagge');
    const name = kasten.querySelector('.mms-name');
    if (!flagge || !name) return;
    if (sprache !== 'de') {
      flagge.src = '/assets/flaggen/' + sprache + '.png';
      name.textContent = NAMEN[sprache];
    }
    standGesetzt = true;
  };

  function umschalterEinrichten() {
    const kasten = document.querySelector('.mm-sprache');
    if (!kasten) return;
    const knopf   = kasten.querySelector('.mms-knopf');
    const flagge  = kasten.querySelector('.mms-flagge');
    const name    = kasten.querySelector('.mms-name');
    const liste   = kasten.querySelector('.mms-liste');
    const hinweis = kasten.querySelector('.mms-hinweis');

    const sanft = !matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ---- Stand: welche Sprache steht gerade im Knopf ---- */
    window.mmUmschalterStand();
    const wahlText = window.mmText('sprache-waehlen');
    knopf?.setAttribute('title', wahlText);
    knopf?.setAttribute('aria-label', wahlText);

    /* ---- Die Auswahl: Adressen und Markierung ---- */
    kasten.querySelectorAll('.mms-wahl[href]').forEach(a => {
      const ziel = a.dataset.sprache;
      const adresse = new URL(location.href);
      adresse.searchParams.set('lang', ziel);
      a.href = adresse.pathname + adresse.search + adresse.hash;
      if (ziel === sprache) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    });

    /* ---- Die gleitende Karte ----
       Eine weisse Karte in der grauen Schiene, die unter dem gewaehlten
       Eintrag liegt und beim Ueberfahren (Maus UND Tastatur) zum Eintrag
       gleitet. Wird hier erzeugt, nicht im HTML: sie ist Zierde. Kommt ans
       ENDE der Liste, damit die Eintraege ihre nth-child-Nummern behalten.
       mms-hat-karte schaltet den CSS-Fallback (starre Karte) ab. */
    let karte = null;
    if (liste) {
      karte = document.createElement('span');
      karte.className = 'mms-karte';
      karte.setAttribute('aria-hidden', 'true');
      liste.appendChild(karte);
      liste.classList.add('mms-hat-karte');
    }
    const gewaehlt = () => liste?.querySelector('.mms-wahl[aria-current="true"]');
    function karteZu(el, sofort) {
      if (!karte || !el) return;
      if (sofort) karte.classList.add('mms-sofort');
      karte.style.left   = el.offsetLeft   + 'px';
      karte.style.top    = el.offsetTop    + 'px';
      karte.style.width  = el.offsetWidth  + 'px';
      karte.style.height = el.offsetHeight + 'px';
      karte.classList.toggle('mms-blass', el.classList.contains('mms-bald'));
      if (sofort) { void karte.offsetWidth; karte.classList.remove('mms-sofort'); }
    }
    /* Beim Oeffnen liegt die Blase erst jetzt im Layout -- also erst jetzt
       messen und die Karte ohne Bewegung hinlegen. */
    kasten.addEventListener('toggle', () => { if (kasten.open) karteZu(gewaehlt(), true); });
    window.addEventListener('resize', () => { if (kasten.open) karteZu(gewaehlt(), true); });
    liste?.addEventListener('mouseover', e => {
      const w = e.target.closest('.mms-wahl'); if (w) karteZu(w);
    });
    liste?.addEventListener('mouseleave', () => karteZu(gewaehlt()));
    liste?.addEventListener('focusin', e => {
      const w = e.target.closest('.mms-wahl'); if (w) karteZu(w);
    });
    liste?.addEventListener('focusout', e => {
      if (!liste.contains(e.relatedTarget)) karteZu(gewaehlt());
    });

    /* ---- Zusammenziehen, aber erst spaet ---- */
    let uhr = null;
    const klein = () => {
      if (kasten.open) return;
      kasten.classList.add('mms-klein');
      /* Die Flagge "schluckt" den Namen. Per Klasse, nicht per .mms-klein
         im CSS -- siehe Kommentar dort. */
      if (sanft && flagge) {
        flagge.classList.remove('mms-schluckt');
        void flagge.offsetWidth;
        flagge.classList.add('mms-schluckt');
      }
    };
    const gross = () => { clearTimeout(uhr); uhr = null; kasten.classList.remove('mms-klein'); };
    const uhrStellen = (ms) => { clearTimeout(uhr); uhr = setTimeout(klein, ms); };

    /* Auf dem Brief scrollt ein Kasten, auf einer Welt das Fenster --
       beide beobachten, statt zu raten, welcher es ist. */
    const scroller = document.getElementById('scroller');
    const stand = () => Math.max(window.scrollY, scroller ? scroller.scrollTop : 0);
    let gestartet = false;
    function beimScrollen() {
      if (gestartet || stand() < SCHWELLE) return;
      gestartet = true;
      uhrStellen(BLEIBT);
    }
    window.addEventListener('scroll', beimScrollen, { passive: true });
    scroller?.addEventListener('scroll', beimScrollen, { passive: true });

    /* ---- Auf- und Zuklappen ----
       <details> schaltet `open` von sich aus um. Beim SCHLIESSEN muss das
       warten, bis die Blase ausgeblendet ist. */
    let schliesstGerade = false;
    knopf?.addEventListener('click', (e) => {
      if (!kasten.open) { gross(); return; }        // Aufklappen: Browser macht es
      if (schliesstGerade) return;
      e.preventDefault();
      zuklappen();
    });

    function zuklappen() {
      if (!kasten.open || schliesstGerade) return;
      schliesstGerade = true;
      const fertig = () => {
        kasten.classList.remove('mms-schliesst');
        kasten.open = false;
        schliesstGerade = false;
        if (gestartet) uhrStellen(BLEIBT_NACH_KLICK);
      };
      if (!sanft) return fertig();
      kasten.classList.add('mms-schliesst');
      setTimeout(fertig, ZU_DAUER);
    }

    /* Woanders hinklicken oder Esc: zu. */
    document.addEventListener('click', (e) => {
      if (kasten.open && !kasten.contains(e.target)) zuklappen();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && kasten.open) { zuklappen(); knopf?.focus(); }
    });

    /* ---- Sprache waehlen ----
       Der Wechsel laedt die Seite neu. Vorher: Flagge dreht sich um, der
       Name kippt Buchstabe fuer Buchstabe um, die Pille faehrt auf die neue
       Breite. Ohne JavaScript oder mit "Bewegung reduzieren" fuehrt
       derselbe Link ohne Umweg zum Ziel. */
    kasten.querySelectorAll('.mms-wahl[href]').forEach(a => {
      a.addEventListener('click', (e) => {
        const ziel = a.dataset.sprache;
        scrollMerken(scroller && getComputedStyle(scroller).overflowY === 'auto'
          ? scroller.scrollTop : window.scrollY);
        if (!sanft || ziel === sprache || e.metaKey || e.ctrlKey || e.shiftKey) return;
        e.preventDefault();
        gross();
        flaggeTauschen(ziel);
        namenWechseln(NAMEN[ziel]);
        setTimeout(() => { location.href = a.href; }, WECHSEL_DAUER);
      });
    });

    function flaggeTauschen(ziel) {
      if (!flagge) return;
      flagge.classList.remove('mms-tausch');
      void flagge.offsetWidth;
      flagge.classList.add('mms-tausch');
      /* Bild im tiefsten Punkt der Drehung tauschen (45 % von 380 ms).
         Das PNG ist schon da: es stand eben noch in der offenen Liste. */
      setTimeout(() => { flagge.src = '/assets/flaggen/' + ziel + '.png'; }, 150);
    }

    function buchstaben(text) {
      return [...text].map((z, i) =>
        '<span class="mms-buchstabe" style="--i:' + i + '">' +
        (z === ' ' ? '&nbsp;' : z.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')) +
        '</span>').join('');
    }

    /* Zwei Ebenen: die alten Buchstaben liegen absolut obenauf und kippen
       weg, die neuen stehen im Fluss und kippen herein. Gleichzeitig faehrt
       .mms-name von der alten auf die neue Breite -- dafuer wird die neue
       an einer unsichtbaren Kopie gemessen. Danach wieder schlichter Text. */
    function namenWechseln(neu) {
      if (!name || !knopf) return;
      const alt = name.textContent;
      const breiteAlt = name.getBoundingClientRect().width;

      const mess = document.createElement('span');
      mess.className = 'mms-name mms-mess';
      mess.textContent = neu;
      knopf.appendChild(mess);
      const breiteNeu = mess.getBoundingClientRect().width;
      mess.remove();

      name.style.width = breiteAlt + 'px';
      name.innerHTML =
        '<span class="mms-alt mms-raus" aria-hidden="true">' + buchstaben(alt) + '</span>' +
        '<span class="mms-rein">' + buchstaben(neu) + '</span>';
      void name.offsetWidth;                  // alte Breite festnageln, dann fahren
      name.style.width = breiteNeu + 'px';

      /* Aufraeumen -- erreicht der Neulade-Aufruf die Seite vorher, ist es
         egal; bleibt sie (z.B. Abbruch), steht wieder schlichter Text. */
      setTimeout(() => { name.textContent = neu; name.style.width = ''; }, 600);
    }

    /* ---- Niederlaendisch: noch nicht ----
       Ein kurzes Wackeln und ein Satz, der von selbst wieder geht. Der Text
       kommt aus texte.js (Schluessel 'sprache-bald'), solange es ihn dort
       noch nicht gibt aus dem festen Wert hier. */
    const baldText = (() => {
      try {
        const t = window.mmText('sprache-bald');
        if (t && t !== 'sprache-bald') return t;
      } catch (_) {}
      return 'nog niet mogelijk :(';
    })();
    let hinweisUhr = null;
    kasten.querySelector('.mms-bald')?.addEventListener('click', () => {
      kasten.classList.remove('mms-nein');
      void kasten.offsetWidth;              // Neustart der Bewegung erzwingen
      kasten.classList.add('mms-nein');
      /* Sicherheitsnetz: bei "Bewegung reduzieren" kommt kein animationend. */
      setTimeout(() => kasten.classList.remove('mms-nein'), 1000);
      if (!hinweis) return;
      hinweis.textContent = baldText;
      requestAnimationFrame(() => hinweis.classList.add('da'));
      clearTimeout(hinweisUhr);
      hinweisUhr = setTimeout(() => {
        hinweis.classList.remove('da');
        setTimeout(() => { hinweis.textContent = ''; }, 320);
      }, 1900);
    });

    /* Aufraeumen nach einmaligen Bewegungen. */
    kasten.addEventListener('animationend', (e) => {
      if (e.animationName === 'mms-wackeln') kasten.classList.remove('mms-nein');
      if (e.animationName === 'mms-schluck') flagge?.classList.remove('mms-schluckt');
      if (e.animationName === 'mms-flagge-tausch') flagge?.classList.remove('mms-tausch');
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', anwenden);
  else anwenden();
})();
