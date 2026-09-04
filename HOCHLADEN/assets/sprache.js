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

  /* Der Umschalter steht als echtes <a>-Paar im HTML jeder Seite -- damit er
     schon während des Ladeschirms dasteht und auch ohne JavaScript
     funktioniert. Hier bekommt er nur die richtigen Adressen (aktueller
     Pfad, übrige Anhängsel bleiben erhalten) und die Markierung. */
  function umschalterEinrichten() {
    const kasten = document.querySelector('.mm-sprache');
    if (!kasten) return;
    kasten.setAttribute('aria-label', window.mmText('sprache-gruppe') || 'Sprache');
    kasten.querySelectorAll('a[hreflang]').forEach(a => {
      const ziel = a.getAttribute('hreflang');
      const adresse = new URL(location.href);
      adresse.searchParams.set('lang', ziel);
      a.href = adresse.pathname + adresse.search + adresse.hash;
      if (ziel === sprache) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
      a.addEventListener('click', () => {
        const scroller = document.getElementById('scroller');
        const amFenster = !scroller || getComputedStyle(scroller).overflowY !== 'auto';
        scrollMerken(amFenster ? window.scrollY : scroller.scrollTop);
      });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', anwenden);
  else anwenden();
})();
