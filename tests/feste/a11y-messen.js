/* Wird von tests/pruefe-barrierefreiheit.mjs in die Seite hineingereicht.
   Steht als eigene Datei da und nicht als Zeichenkette im Prüfskript, weil
   verschachtelte Anführungszeichen sonst schneller kaputtgehen als sie
   nützen. */
(() => {
  const fokussierbar = () => [...document.querySelectorAll(
      'a[href], button, input:not([type=hidden]), textarea, select, [tabindex]:not([tabindex="-1"])')]
    .filter(el => !el.disabled);
  const sichtbar = (el) => {
    const r = el.getBoundingClientRect(), st = getComputedStyle(el);
    return st.visibility !== 'hidden' && st.display !== 'none' && (r.width > 0 || r.height > 0);
  };
  /* Kontrast nach WCAG 2.1 -- aus den WIRKLICH gezeichneten Farben, nicht
     aus dem, was im Stylesheet steht. Nur so faellt auch auf, wenn eine
     andere Regel die Farbe spaeter ueberschreibt. */
  const zahl = (s) => (s.match(/[\d.]+/g) || []).map(Number);
  const helligkeit = (rgb) => {
    const [r, g, b] = rgb.slice(0, 3).map(v => v / 255)
      .map(c => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const grundVon = (el) => {
    for (let n = el; n; n = n.parentElement) {
      const f = getComputedStyle(n).backgroundColor;
      const v = zahl(f);
      if (v.length >= 3 && (v[3] === undefined || v[3] > 0)) return v;
    }
    return [255, 255, 255];
  };
  const kontrast = (el) => {
    const a = helligkeit(zahl(getComputedStyle(el).color));
    const b = helligkeit(grundVon(el));
    return +(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toFixed(2));
  };

  const leise = ['.br-kicker', '.br-rolle', '.br-infos dt', '.br-werkzeuge dd', '.br-infos dd span']
    .map(w => { const el = document.querySelector(w);
                return el ? { wahl: w, wert: kontrast(el), groesse: getComputedStyle(el).fontSize } : null; })
    .filter(Boolean);

  const formfelder = [...document.querySelectorAll('#anfragen input:not([type=hidden]), #anfragen textarea')];

  return JSON.stringify({
    main: document.querySelectorAll('main').length,
    nav: document.querySelectorAll('nav#leiste').length,
    navBeschriftet: !!document.querySelector('nav#leiste[aria-label]'),
    h1: document.querySelectorAll('h1').length,
    sprungErster: (fokussierbar()[0] || {}).className === 'br-sprung',
    sprungVersteckt: (() => { const a = document.querySelector('.br-sprung');
      return !!a && a.getBoundingClientRect().right < 0; })(),
    felderOhneLabel: formfelder.filter(el => {
      const l = el.closest('label'); return !l || !l.textContent.trim(); }).length,
    felderGesamt: formfelder.length,
    knoepfe: document.querySelectorAll('nav#leiste button.mml-et').length,
    etikettenGesamt: document.querySelectorAll('.mml-et').length,
    segmenteVersteckt: document.querySelectorAll('.mml-seg[aria-hidden="true"]').length,
    segmenteGesamt: document.querySelectorAll('.mml-seg').length,
    ariaCurrent: document.querySelectorAll('.mml-et[aria-current]').length,
    fallen: fokussierbar().filter(el => !sichtbar(el) && !el.classList.contains('br-sprung')).length,
    fokussierbar: fokussierbar().length,
    leise,
  });
})()
