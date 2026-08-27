/* Rettet die Webschriften vor dem Scroll-Animations-Polyfill.
   Wird NUR geladen, wenn das Polyfill laeuft -- also in Firefox.

   Das Problem, gemessen: flackr/scroll-timeline liest beim Start jedes
   <link rel=stylesheet> und jedes <style> ein, schreibt den Inhalt um und
   haengt ihn als blob:-Adresse wieder ein. Die @font-face-Regeln ueberleben
   diesen Weg nicht. Ergebnis in Firefox: TropiWeb, Manrope und Space Mono
   zeichnen exakt wie die Standardschrift (9222 gefaerbte Pixel im gleichen
   Testbild), die Ueberschriften standen in der Ersatzschrift. Chrome und
   Safari sind nie betroffen, weil das Polyfill dort gar nicht erst laedt.

   Nachtraeglich ein zweites <link> auf fonts.css einzuhaengen half NICHT
   (ebenfalls gemessen) -- das Polyfill greift auch spaeter eingefuegte
   Stylesheets ab. Ueber die JS-Schnittstelle laden sie dagegen einwandfrei
   (17601 bzw. 10539 Pixel, also klar unterscheidbare Schriftbilder).

   Warum die Namen und Adressen hier NICHT noch einmal aufgeschrieben
   werden: dann gaebe es zwei Listen, die auseinanderlaufen koennen, sobald
   tests/schriften-loesen.mjs neue Fingerabdruecke vergibt. Stattdessen wird
   fonts.css als Text geholt und ausgelesen. Eine Quelle, keine Kopie.

   Faellt hier etwas aus, bleibt es beim heutigen Zustand: Ersatzschrift.
   Kein Text verschwindet, nichts wird unlesbar. */
(function () {
  if (!window.FontFace || !window.fetch) return;

  var REGEL = /@font-face\s*\{([^}]*)\}/g;
  var WERT  = function (block, name) {
    var t = block.match(new RegExp(name + '\\s*:\\s*([^;]+)'));
    return t ? t[1].trim() : '';
  };

  fetch('/assets/fonts.css').then(function (a) {
    if (!a.ok) throw new Error('fonts.css nicht erreichbar: ' + a.status);
    return a.text();
  }).then(function (css) {
    var block, gefunden = 0;
    while ((block = REGEL.exec(css))) {
      var roh    = block[1];
      var familie = WERT(roh, 'font-family').replace(/^['"]|['"]$/g, '');
      var quelle  = WERT(roh, 'src');
      if (!familie || !quelle) continue;
      var schrift = new FontFace(familie, quelle, {
        weight: WERT(roh, 'font-weight') || 'normal',
        style:  WERT(roh, 'font-style')  || 'normal',
        display: 'swap'
      });
      gefunden++;
      /* Jede Schrift fuer sich: faellt eine Datei aus, laden die anderen
         trotzdem. Ein gemeinsames Promise.all wuerde alle mitreissen. */
      schrift.load().then(function (s) { document.fonts.add(s); })
        .catch(function (e) { console.warn('[mausemaus] Schrift nicht ladbar:', e.message); });
    }
    if (!gefunden) console.warn('[mausemaus] keine @font-face-Regel in fonts.css gefunden');
  }).catch(function (e) { console.warn('[mausemaus]', e.message); });
})();
