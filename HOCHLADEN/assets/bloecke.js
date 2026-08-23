/* mausemaus — macht aus einer Liste von Blöcken (Tabelle `bloecke`) HTML.
   Für die Auszeichnung INNERHALB eines Blocks (fett, kursiv, Links, Türchen,
   Absätze, Listen, Zitate, Bildgalerien, Video, Code, ::demo, :::-Zweispalter,
   --- Trenner) bleibt renderMarkdown() aus shared.js zuständig: jeder Block
   trägt in inhalt.roh sein ursprüngliches Rohformat (siehe splitBlocks() in
   shared.js) und wird beim Anzeigen wortwörtlich damit gerendert -- so kann
   die Darstellung nie vom alten Markdown-Umsetzer abweichen.
   Wird von index.html (Brief) UND welt.html (Welten) geladen. */
(() => {
  /* Blockarten, deren Inhalt ein roher Markdown-Ausschnitt ist. */
  const ROH_TYPEN = new Set([
    'text', 'ueberschrift', 'bild', 'gif', 'video',
    'text_mit_bild', 'code', 'werkzeug', 'trenner',
  ]);

  /* Breite/Bewegung als Hülle um einen Block legen -- aber NUR, wenn sie vom
     Standard abweichen ('normal'/'keine'). Im Standardfall bleibt html exakt
     unverändert: sämtlicher schon vorhandener Inhalt hat diese Werte, die
     vier bestehenden Prüfungen (pruefe-bestand/leiste/brief/welten) dürfen
     sich also nicht ändern -- und tun es dadurch auch nicht.
     randnotiz/abschnitt bewusst ausgenommen: randnotiz hängt als direktes
     Kind in einer <dl class="br-infos"> (siehe brief.js), eine zusätzliche
     Hülle würde deren Gitter durcheinanderbringen; abschnitt liefert ohnehin
     nie eigenes HTML. */
  function einhuellen(html, block) {
    if (!html || block.typ === 'randnotiz' || block.typ === 'abschnitt') return html;
    const breite = block.breite && block.breite !== 'normal' ? block.breite : null;
    const bewegung = block.bewegung && block.bewegung !== 'keine' ? block.bewegung : null;
    if (!breite && !bewegung) return html;
    const klassen = ['mm-baustein'];
    if (breite) klassen.push('mm-breite-' + breite);
    if (bewegung) klassen.push('mm-bewegung-' + bewegung);
    return '<div class="' + klassen.join(' ') + '">' + html + '</div>';
  }

  /* Ein einzelner Block -> HTML-Schnipsel.
     textKlasse (optional) umschließt Markdown-Inhalt mit einer Textklasse
     der aufrufenden Seite (Brief: "br-text", Welt: "welt-text") -- das
     Umschließen selbst ändert nichts an dem, was renderMarkdown() erzeugt,
     nur die CSS-Regeln dieser Klasse greifen dann zusätzlich. */
  function render(block, textKlasse) {
    const typ = block.typ, inh = block.inhalt || {};
    if (ROH_TYPEN.has(typ)) {
      const html = window.mm.renderMarkdown(inh.roh || '');
      const inhalt = textKlasse ? '<div class="' + textKlasse + '">' + html + '</div>' : html;
      return einhuellen(inhalt, block);
    }
    switch (typ) {
      case 'randnotiz':
        return '<div' + (inh.punkt ? ' class="br-punkt"' : '') + '>' +
          '<dt>' + window.mm.esc(inh.titel || '') + '</dt>' +
          '<dd>' + window.mm.esc(inh.zeile1 || '') +
          (inh.zeile2 ? '<span>' + window.mm.esc(inh.zeile2) + '</span>' : '') + '</dd></div>';
      case 'tuer':
        return einhuellen('<p class="br-mehr"><a class="mm-tuer" href="' + window.mm.esc(inh.ziel || '#') + '">' +
          window.mm.esc(inh.text || 'Mehr dazu') + '</a></p>', block);
      case 'abschnitt':
        return '';   // reiner Marker für gruppieren(), kein eigener Inhalt
      default:
        return '';
    }
  }

  /* Baustein-Elemente mit einer mm-bewegung-*-Klasse starten in ihrem ganz
     normalen, sichtbaren Zustand -- läuft dieses Skript aus irgendeinem
     Grund nicht (Fehler, alter Browser, `prefers-reduced-motion`), geht
     dadurch NIE Inhalt verloren, nur das Einblenden entfällt. Erst wenn der
     Beobachter wirklich bereitsteht, werden sie kurz unsichtbar gemacht und
     beim Erscheinen im Bild wieder eingeblendet. */
  function bewegungEinrichten(wurzel) {
    if (!wurzel) return;
    const bausteine = [...wurzel.querySelectorAll('[class*="mm-bewegung-"]')];
    if (!bausteine.length) return;
    if (!('IntersectionObserver' in window) ||
        window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    bausteine.forEach(el => {
      el.classList.add('mm-bereit');
      if (el.classList.contains('mm-bewegung-zeilenweise')) {
        [...el.children].forEach((kind, i) => kind.style.setProperty('--mm-verzoegerung', (i * 60) + 'ms'));
      }
    });
    const beobachter = new IntersectionObserver((eintraege) => {
      eintraege.forEach(e => {
        if (!e.isIntersecting) return;
        e.target.classList.add('mm-sichtbar');
        beobachter.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    bausteine.forEach(el => beobachter.observe(el));
  }

  /* Reiht die Blöcke einer Seite aneinander, sortiert nach sort_order --
     für eine Welt-Seite reicht das allein (siehe welt.html). */
  function seite(blocks, textKlasse) {
    return (blocks || []).slice().sort((a, b) => a.sort_order - b.sort_order)
      .map(b => render(b, textKlasse)).join('\n');
  }

  /* Zerlegt eine Blockliste an ihren abschnitt-Blöcken in Gruppen für die
     Zeitleiste (Brief). Blöcke VOR dem ersten abschnitt-Block gehören zu
     keiner Gruppe -- eine korrekt angelegte Brief-Seite fängt immer mit
     einem Abschnitt an. */
  function gruppieren(blocks) {
    const sortiert = (blocks || []).slice().sort((a, b) => a.sort_order - b.sort_order);
    const gruppen = [];
    sortiert.forEach(b => {
      if (b.typ === 'abschnitt') {
        const i = b.inhalt || {};
        gruppen.push({
          titel: i.titel || '', art: i.art || 'beruflich', farbe: i.farbe || null,
          inhalt: i, blocks: [],
        });
        return;
      }
      if (gruppen.length) gruppen[gruppen.length - 1].blocks.push(b);
    });
    return gruppen;
  }

  window.mmBloecke = { render, seite, gruppieren, bewegungEinrichten };
})();
