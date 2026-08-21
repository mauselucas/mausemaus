/* mausemaus — setzt den Brief aus dem zusammen, was schon in der Datenbank steht.
   Es wird NICHTS umformuliert: Titel, Texte, Bilder und Videos kommen wörtlich
   aus den Projekten. Verbindende Sätze schreibt Lucas später selbst dazu. */
(() => {
  /* Jedes Projekt bekommt eine eigene Farbe, der Reihe nach.
     NICHT aus `accent` ableiten: dort gibt es nur vier Werte, und
     "The Race" und "Rockstar Selfish" teilen sich beide `sky` — zwei
     gleichfarbige Balken in der Zeitleiste wären unbrauchbar.
     Die Reihenfolge kommt aus `sort_order`, ist also stabil. */
  const FARBEN = ['#3E5A78', '#8E4E9B', '#A8913F', '#6E6E7A', '#7F8F55',
                  '#B5654A', '#4E7F7A', '#8A5A8E'];
  const farbeVon = (p, i) => FARBEN[i % FARBEN.length];

  /* window.mm.videoEmbed() liefert nur den Bauplan ({kind, id, src}), keine
     fertige Einbettung — genauso, wie renderMarkdown() ihn intern selbst
     zu einem <iframe> zusammensetzt. Hier dasselbe für den Brief. */
  const einbettung = (url) => {
    const v = window.mm.videoEmbed(url);
    if (!v) return '';
    return '<iframe src="' + window.mm.esc(v.src) + '" loading="lazy" allowfullscreen ' +
      'allow="accelerometer; clipboard-write; encrypted-media; picture-in-picture" ' +
      'referrerpolicy="strict-origin-when-cross-origin" title="Video"></iframe>';
  };

  window.mmBrief = function (ziel, { settings, projekte }) {
    const e = settings || {};
    const abschnitte = [];
    ziel.innerHTML = '';

    const neuerAbschnitt = (titel, art, farbe) => {
      const s = document.createElement('section');
      s.className = 'br-abschnitt';
      ziel.appendChild(s);
      abschnitte.push({ id: 'a' + abschnitte.length, titel, art, farbe: farbe || null, element: s });
      return s;
    };

    /* ---- Einstieg: aus den vorhandenen Startseiten-Texten ---- */
    const eins = neuerAbschnitt('Hallo', 'persoenlich', null);
    eins.innerHTML =
      '<h1 class="br-gruss">' + window.mm.esc(e.hero_line1 || 'Hallo ich bin') +
        '<em>' + window.mm.esc(e.hero_line2 || 'Lucas :)') + '</em></h1>' +
      '<p class="br-kicker">' + window.mm.esc(e.hero_eyebrow || '') + '</p>' +
      '<div class="br-text">' + window.mm.renderMarkdown(e.hero_intro || '') + '</div>' +
      /* Die vier Eckdaten (Basis, Status, Schwerpunkt, Ausbildung) standen auf der
         alten Startseite und dürfen nicht verschwinden. */
      (Array.isArray(e.infos) && e.infos.length
        ? '<dl class="br-infos">' + e.infos.map(i =>
            '<div' + (i.punkt ? ' class="br-punkt"' : '') + '>' +
            '<dt>' + window.mm.esc(i.titel || '') + '</dt>' +
            '<dd>' + window.mm.esc(i.zeile1 || '') +
            (i.zeile2 ? '<span>' + window.mm.esc(i.zeile2) + '</span>' : '') + '</dd></div>').join('') +
          '</dl>'
        : '');

    /* ---- Wer schneidet da: der vorhandene Profiltext samt Werkzeugliste ---- */
    if (e.profil_text || e.profil_titel) {
      const pr = neuerAbschnitt(e.profil_kicker || 'Über mich', 'persoenlich', null);
      pr.innerHTML =
        (e.profil_kicker ? '<p class="br-rolle">' + window.mm.esc(e.profil_kicker) + '</p>' : '') +
        (e.profil_titel
          ? '<h2 class="br-titel">' + window.mm.esc(e.profil_titel).replace(/\n/g, '<br>') + '</h2>'
          : '') +
        (e.profil_text ? '<div class="br-text">' + window.mm.renderMarkdown(e.profil_text) + '</div>' : '') +
        (Array.isArray(e.werkzeuge) && e.werkzeuge.length
          ? '<dl class="br-werkzeuge">' + e.werkzeuge.map(w =>
              '<div><dt>' + window.mm.esc(w.name || '') + '</dt>' +
              '<dd>' + window.mm.esc(w.stufe || '') + '</dd></div>').join('') + '</dl>'
          : '') +
        (Array.isArray(e.kunden) && e.kunden.length
          ? '<p class="br-kunden">' + e.kunden.map(k =>
              '<span>' + window.mm.esc(k) + '</span>').join('') + '</p>'
          : '');
    }

    /* ---- Ein Abschnitt je Projekt, Inhalt unverändert ---- */
    projekte.forEach((p, i) => {
      const s = neuerAbschnitt(p.title, 'beruflich', farbeVon(p, i));
      let h = '';
      if (p.role) h += '<p class="br-rolle">' + window.mm.esc(p.role) + '</p>';
      h += '<h2 class="br-titel">' + window.mm.esc(p.title) +
           (p.is_live ? '<span class="br-laeuft">läuft aktuell</span>' : '') + '</h2>';
      if (p.summary) h += '<div class="br-text">' + window.mm.renderMarkdown(p.summary) + '</div>';

      /* Das Coverbild ist immer sichtbar und dient als Vorschaubild.
         Einbettbare Videos laden erst beim Klick — sonst holt die Startseite
         fünf fremde Abspieler auf einmal. Nicht einbettbare (z. B. "The Race"
         bei Joyn, `embed_ok = false`) führen nach außen. */
      if (p.cover_url) {
        const einbettbar = p.link_url && p.embed_ok !== false;
        h += '<figure class="br-bild' + (einbettbar ? ' br-spielbar' : '') + '"' +
             (einbettbar ? ' data-video="' + window.mm.esc(p.link_url) + '"' : '') + '>' +
             '<img src="' + window.mm.esc(p.cover_url) + '" alt="' + window.mm.esc(p.title) +
             '" loading="lazy" style="object-position:' +
             window.mm.esc(p.cover_pos || '50% 50%') + '">' +
             (einbettbar
               ? '<button class="br-play" type="button" aria-label="Video abspielen">▶</button>'
               : (p.link_url ? '<a class="br-raus" href="' + window.mm.esc(p.link_url) +
                   '" target="_blank" rel="noopener">' + window.mm.esc(p.link_label || 'Ansehen') +
                   ' →</a>' : '')) +
             '</figure>';
      } else if (p.link_url && p.embed_ok !== false) {
        h += '<div class="br-film">' + einbettung(p.link_url) + '</div>';
      }
      if (p.body) h += '<div class="br-text">' + window.mm.renderMarkdown(p.body) + '</div>';
      if (p.tags && p.tags.length)
        h += '<p class="br-marken">' + p.tags.map(t => '<span>' + window.mm.esc(t) + '</span>').join('') + '</p>';
      /* "The Race" verweist über more_url auf die Werkzeug-Seite. Ohne diese
         Zeile ginge der Verweis beim Umbau still verloren. */
      if (p.more_url)
        h += '<p class="br-mehr"><a class="mm-tuer" href="' + window.mm.esc(p.more_url) + '">' +
             window.mm.esc(p.more_label || 'Mehr dazu') + '</a></p>';
      s.innerHTML = h;
    });

    /* ---- Schluss: der vorhandene Kontaktteil ---- */
    const k = neuerAbschnitt(e.kontakt_titel || 'Schreib mir', 'kontakt', '#BFCC94');
    k.innerHTML =
      '<h2 class="br-titel">' + window.mm.esc(e.kontakt_titel || 'Schreib mir') + '</h2>' +
      (e.kontakt_zusatz ? '<div class="br-text">' + window.mm.renderMarkdown(e.kontakt_zusatz) + '</div>' : '') +
      '<p class="br-kontakt">' +
        (e.email ? '<a href="mailto:' + window.mm.esc(e.email) + '">' + window.mm.esc(e.email) + '</a>' : '') +
        (e.telefon ? '<a href="tel:' + window.mm.esc(e.telefon.replace(/\s/g, '')) + '">' +
          window.mm.esc(e.telefon) + '</a>' : '') +
      '</p>';

    /* Erst auf Klick den fremden Abspieler holen. */
    ziel.querySelectorAll('.br-spielbar').forEach(f => {
      f.addEventListener('click', () => {
        const url = f.dataset.video;
        if (!url) return;
        f.classList.remove('br-spielbar');
        f.innerHTML = einbettung(url);
        f.classList.add('br-film');
      }, { once: true });
    });

    return abschnitte;
  };
})();
