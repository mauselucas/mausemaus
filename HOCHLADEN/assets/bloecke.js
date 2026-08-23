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

  /* Ein einzelner Block -> HTML-Schnipsel.
     textKlasse (optional) umschließt Markdown-Inhalt mit einer Textklasse
     der aufrufenden Seite (Brief: "br-text", Welt: "welt-text") -- das
     Umschließen selbst ändert nichts an dem, was renderMarkdown() erzeugt,
     nur die CSS-Regeln dieser Klasse greifen dann zusätzlich. */
  function render(block, textKlasse) {
    const typ = block.typ, inh = block.inhalt || {};
    if (ROH_TYPEN.has(typ)) {
      const html = window.mm.renderMarkdown(inh.roh || '');
      return textKlasse ? '<div class="' + textKlasse + '">' + html + '</div>' : html;
    }
    switch (typ) {
      case 'randnotiz':
        return '<div' + (inh.punkt ? ' class="br-punkt"' : '') + '>' +
          '<dt>' + window.mm.esc(inh.titel || '') + '</dt>' +
          '<dd>' + window.mm.esc(inh.zeile1 || '') +
          (inh.zeile2 ? '<span>' + window.mm.esc(inh.zeile2) + '</span>' : '') + '</dd></div>';
      case 'tuer':
        return '<p class="br-mehr"><a class="mm-tuer" href="' + window.mm.esc(inh.ziel || '#') + '">' +
          window.mm.esc(inh.text || 'Mehr dazu') + '</a></p>';
      case 'abschnitt':
        return '';   // reiner Marker für gruppieren(), kein eigener Inhalt
      default:
        return '';
    }
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

  window.mmBloecke = { render, seite, gruppieren };
})();
