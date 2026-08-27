/* mausemaus — setzt den Brief aus Seiten und Blöcken zusammen (Tabellen
   `seiten`/`bloecke`). Es wird NICHTS umformuliert: Titel, Texte, Bilder und
   Videos kommen wörtlich aus den Blöcken -- siehe assets/bloecke.js für die
   Regel, wie ein Block zu HTML wird, und tests/umzug.mjs für die Regel, wie
   die alten Tabellen (projects/posts/settings) zu Blöcken wurden. */
(() => {
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

  /* briefBloecke: alle Blöcke der EINEN Seite vom Typ "brief" (Hallo, Profil,
     Kontakt -- markiert durch abschnitt-Blöcke).
     projekte: die veröffentlichten Seiten vom Typ "projekt", je mit ihren
     eigenen Blöcken, schon nach sort_order sortiert. */
  window.mmBrief = function (ziel, { briefBloecke, projekte }) {
    const gruppen = window.mmBloecke.gruppieren(briefBloecke);
    const abschnitte = [];
    ziel.innerHTML = '';

    const neuerAbschnitt = (titel, art, farbe) => {
      const s = document.createElement('section');
      s.className = 'br-abschnitt';
      ziel.appendChild(s);
      abschnitte.push({ id: 'a' + abschnitte.length, titel, art, farbe: farbe || null, element: s });
      return s;
    };

    /* Eine Brief-eigene Gruppe (Hallo/Profil/Kontakt oder eine spätere,
       von Lucas selbst angelegte) rendern. `rolle` ist ein optionales Feld
       im abschnitt-Block und steuert nur die VORSPANN-Gestaltung (großer
       Gruß, Kontaktzeilen) -- ohne bekannte Rolle gibt es einen normalen
       Titel, die Seite bricht dadurch nie. */
    const renderGruppe = (g) => {
      const s = neuerAbschnitt(g.titel, g.art, g.farbe);
      const i = g.inhalt || {};
      let vorspann = '';
      if (i.rolle === 'hallo') {
        vorspann = '<h1 class="br-gruss">' + window.mm.esc(i.titel || '') +
          '<em>' + window.mm.esc(i.zusatz || '') + '</em></h1>' +
          (i.kicker ? '<p class="br-kicker">' + window.mm.esc(i.kicker) + '</p>' : '');
      } else if (i.rolle === 'profil') {
        vorspann = (i.kicker ? '<p class="br-rolle">' + window.mm.esc(i.kicker) + '</p>' : '') +
          (i.titel ? '<h2 class="br-titel">' + window.mm.esc(i.titel).replace(/\n/g, '<br>') + '</h2>' : '');
      } else {
        vorspann = i.titel ? '<h2 class="br-titel">' + window.mm.esc(i.titel) + '</h2>' : '';
      }

      /* Eckdaten (randnotiz-Blöcke) gehören als Gruppe in eine <dl>, damit
         das vorhandene Raster-CSS (.br-infos) greift. */
      const eckdaten = g.blocks.filter(b => b.typ === 'randnotiz');
      const rest = g.blocks.filter(b => b.typ !== 'randnotiz');

      const nachspann = i.rolle === 'kontakt'
        ? '<p class="br-kontakt">' +
            (i.email ? '<a href="mailto:' + window.mm.esc(i.email) + '">' + window.mm.esc(i.email) + '</a>' : '') +
            (i.telefon ? '<a href="tel:' + window.mm.esc(i.telefon.replace(/\s/g, '')) + '">' +
              window.mm.esc(i.telefon) + '</a>' : '') +
          '</p>'
        : '';

      s.innerHTML = vorspann +
        rest.map(b => window.mmBloecke.render(b, 'br-text')).join('\n') +
        (eckdaten.length ? '<dl class="br-infos">' + eckdaten.map(b => window.mmBloecke.render(b)).join('') + '</dl>' : '') +
        nachspann;
    };

    /* Reihenfolge: Brief-eigene Abschnitte bis (ausschließlich) zum ersten
       Kontakt-Abschnitt, dann die Projekte, dann der Rest (üblicherweise:
       Kontakt). So bleibt Einstieg -> Profil -> Projekte -> Kontakt
       erhalten, ohne dass Zahl oder Art der Brief-eigenen Abschnitte fest
       verdrahtet sind -- Lucas kann im Editor weitere persönliche
       Abschnitte einfügen, sie landen automatisch vor den Projekten. */
    const kontaktAb = gruppen.findIndex(g => g.art === 'kontakt');
    const vorProjekten = kontaktAb === -1 ? gruppen : gruppen.slice(0, kontaktAb);
    const nachProjekten = kontaktAb === -1 ? [] : gruppen.slice(kontaktAb);

    vorProjekten.forEach(renderGruppe);

    /* ---- Ein Abschnitt je veröffentlichtem Projekt ---- */
    projekte.forEach((p) => {
      const seite = p.seite;
      const s = neuerAbschnitt(seite.titel, 'beruflich', seite.farbe);
      let h = '';
      if (seite.untertitel) h += '<p class="br-rolle">' + window.mm.esc(seite.untertitel) + '</p>';
      h += '<h2 class="br-titel">' + window.mm.esc(seite.titel) +
           (seite.ist_aktuell ? '<span class="br-laeuft">läuft aktuell</span>' : '') + '</h2>';

      /* Das Coverbild ist immer sichtbar und dient als Vorschaubild.
         Einbettbare Videos laden erst beim Klick — sonst holt die Startseite
         fünf fremde Abspieler auf einmal. Nicht einbettbare (z. B. "The Race"
         bei Joyn, embed_ok = false) verweisen stattdessen über einen eigenen
         tuer-Block in den Blöcken selbst nach außen. */
      if (seite.cover_url) {
        const einbettbar = seite.video_url && seite.embed_ok !== false;
        h += '<figure class="br-bild' + (einbettbar ? ' br-spielbar' : '') + '"' +
             (einbettbar ? ' data-video="' + window.mm.esc(seite.video_url) + '"' : '') + '>' +
             '<img src="' + window.mm.esc(seite.cover_url) + '" alt="' + window.mm.esc(seite.titel) +
             '" loading="lazy" style="object-position:' +
             window.mm.esc(seite.cover_pos || '50% 50%') + '">' +
             (einbettbar ? '<button class="br-play" type="button" aria-label="Video abspielen">▶</button>' : '') +
             '</figure>';
      } else if (seite.video_url && seite.embed_ok !== false) {
        h += '<div class="br-film">' + einbettung(seite.video_url) + '</div>';
      }

      h += p.bloecke.slice().sort((a, b) => a.sort_order - b.sort_order)
        .map(b => window.mmBloecke.render(b, 'br-text')).join('\n');
      s.innerHTML = h;
    });

    nachProjekten.forEach(renderGruppe);

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

    /* Deko-Blumen zum Schluss: Sie hängen an den fertigen Abschnitten und
       wandern damit von selbst mit, wenn Inhalt dazukommt oder das Fenster
       die Größe wechselt (siehe assets/blumen.js). */
    /* Genau EINE h1 muss die Seite haben -- sie ist fuer Screenreader und
       Suchmaschinen die Ueberschrift des Ganzen. Sie entsteht oben nur im
       Abschnitt mit der Rolle "hallo". Loescht Lucas den im Admin oder gibt
       ihm eine andere Rolle, haette der Brief GAR KEINE h1 mehr, und alle
       Abschnitte begaennen bei h2 -- ohne dass es jemandem auffiele.
       Deshalb hier zum Schluss nachsehen und notfalls die erste
       Abschnitts-Ueberschrift zur h1 machen. Bewusst nachtraeglich am
       fertigen Baum statt als Sonderfall in renderGruppe(): so greift es
       ganz gleich, welcher Weg oben genommen wurde. */
    if (!ziel.querySelector('h1')) {
      const erste = ziel.querySelector('h2.br-titel');
      if (erste) {
        const h1 = document.createElement('h1');
        h1.className = erste.className;
        h1.innerHTML = erste.innerHTML;
        erste.replaceWith(h1);
      }
    }

    if (window.mmBlumen) window.mmBlumen(abschnitte.map(a => a.element));

    return abschnitte;
  };
})();
