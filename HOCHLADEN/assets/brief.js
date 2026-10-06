/* mausemaus — setzt den Brief aus Seiten und Blöcken zusammen (Tabellen
   `seiten`/`bloecke`). Es wird NICHTS umformuliert: Titel, Texte, Bilder und
   Videos kommen wörtlich aus den Blöcken -- siehe assets/bloecke.js für die
   Regel, wie ein Block zu HTML wird, und tests/umzug.mjs für die Regel, wie
   die alten Tabellen (projects/posts/settings) zu Blöcken wurden. */
(() => {
  /* window.mm.videoEmbed() liefert nur den Bauplan ({kind, id, src}), keine
     fertige Einbettung — genauso, wie renderMarkdown() ihn intern selbst
     zu einem <iframe> zusammensetzt. Hier dasselbe für den Brief. */
  /* Feste Beschriftungen. Ohne sprache.js bleibt es beim deutschen Wort. */
  const T = (schluessel, deutsch) => (window.mmText ? window.mmText(schluessel) : '') || deutsch;

  const einbettung = (url) => {
    const v = window.mm.videoEmbed(url);
    if (!v) return '';
    return '<iframe src="' + window.mm.esc(v.src) + '" loading="lazy" allowfullscreen ' +
      'allow="accelerometer; clipboard-write; encrypted-media; picture-in-picture" ' +
      'referrerpolicy="strict-origin-when-cross-origin" title="' + T('video', 'Video') + '"></iframe>';
  };
  /* Die Buehne (buehne.js) braucht denselben Abspieler fuer Cover mit ▶. */
  window.mmEinbettung = einbettung;

  /* briefBloecke: alle Blöcke der EINEN Seite vom Typ "brief" (Hallo, Profil,
     Kontakt -- markiert durch abschnitt-Blöcke).
     projekte: die veröffentlichten Seiten vom Typ "projekt", je mit ihren
     eigenen Blöcken, schon nach sort_order sortiert. */
  window.mmBrief = function (ziel, { briefBloecke, projekte }) {
    const gruppen = window.mmBloecke.gruppieren(briefBloecke);
    const abschnitte = [];
    /* Die Projekte als Daten fuer die Buehne (buehne.js): je Projekt die
       Bloecke, das Cover und der Abschnitt im Brief. */
    window.mmProjekte = [];
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
        /* Foto zum Gruss, wie ein eingeklebtes Polaroid (im Admin: Feld
           "Foto" am Gruss-Abschnitt). Masse aus dem Dateinamen, damit der
           Platz von Anfang an frei ist. Nicht "lazy": es steht ganz oben. */
        if (i.foto) {
          const masse = typeof masseVon === 'function' ? masseVon(i.foto) : '';
          vorspann = '<div class="br-hallo"><div class="br-hallo-text">' + vorspann + '</div>' +
            '<figure class="br-polaroid"><img src="' + window.mm.esc(i.foto) + '" alt="' +
            window.mm.esc(i.foto_text || '') + '"' + masse + ' decoding="async" fetchpriority="high"></figure></div>';
        }
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

      /* Ohne E-Mail und Telefon (seit dem Kontaktformular der Normalfall)
         gar kein leerer Absatz -- der stuende sonst als Luecke da. */
      const nachspann = i.rolle === 'kontakt' && (i.email || i.telefon)
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
      /* Titel und Untertitel koennen im Admin uebersetzt sein (Spalten
         titel_en / untertitel_en). Ohne Uebersetzung -- und ohne
         sprache.js -- kommt woertlich der deutsche Wert zurueck. */
      const F = (feld) => (window.mmFeldVon ? window.mmFeldVon(seite, feld) : (seite[feld] || ''));
      const titel = F('titel'), untertitel = F('untertitel');
      const s = neuerAbschnitt(titel, 'beruflich', seite.farbe);
      /* Leere Bild-/GIF-/Video-Bloecke (im Admin angelegt oder geleert, aber
         ohne Datei) fallen raus: Sonst stuende in der Karte ein leerer
         Kasten statt des naechsten echten Bildes, und in der Buehne ein
         Kapitel ohne Medium. */
      const leer = (b) => (b.typ === 'bild' || b.typ === 'gif' || b.typ === 'video') &&
        !String(((window.mmInhaltVon ? window.mmInhaltVon(b) : b.inhalt) || {}).roh || '').trim();
      let bloecke = p.bloecke.slice().sort((a, b) => a.sort_order - b.sort_order).filter(b => !leer(b));
      let h = '';

      /* Kopfbild: Ist der ERSTE Block ein Bild in voller Breite ohne Rahmen
         und hat das Projekt kein Cover (so beim Simplicissimus-Kanalbanner),
         steht dieses Bild als Kopf des Eintrags VOR Rolle und Titel und
         laeuft unten weich in den Seitengrund aus. Sonst saehe es aus wie
         ein eingeklebtes Bild mitten im Text. Im Admin aendert sich nichts. */
      const erster = bloecke[0];
      if (!seite.cover_url && erster && erster.typ === 'bild' && erster.breite === 'voll') {
        const inh = window.mmInhaltVon ? window.mmInhaltVon(erster) : erster.inhalt;
        const m = inh && inh.ohne_rahmen === true &&
          /^!\[([^\]]*)\]\(([^)\s]+)\)/.exec((inh.roh || '').trim());
        if (m) {
          /* Masse aus dem Dateinamen (masseVon, shared.js), damit der Platz
             von Anfang an freigehalten wird -- sonst springt beim Nachladen
             alles darunter, und die Zeitleiste rechnet mit falschen Hoehen. */
          const masse = typeof masseVon === 'function' ? masseVon(m[2]) : '';
          h += '<figure class="br-kopfbild"><img src="' + window.mm.esc(m[2]) + '" alt="' +
               window.mm.esc(m[1] || titel) + '" loading="lazy"' + masse + '></figure>';
          bloecke = bloecke.slice(1);
        }
      }
      /* Rolle und Titel stehen in der Karte RECHTS neben dem Medium (Rechner)
         bzw. darunter (Handy) -- darum erst hier gebaut, eingesetzt unten. */
      const kopf = (untertitel ? '<p class="br-rolle">' + window.mm.esc(untertitel) + '</p>' : '') +
        '<h2 class="br-titel">' + window.mm.esc(titel) +
        (seite.ist_aktuell ? '<span class="br-laeuft">' + T('laeuft-aktuell', 'läuft aktuell') + '</span>' : '') + '</h2>';

      /* Das Coverbild ist das Vorschau-Medium der Karte. Einbettbare Videos
         laden erst beim Klick auf ▶ -- sonst holt die Startseite fünf fremde
         Abspieler auf einmal. Nicht einbettbare (z. B. "The Race" bei Joyn,
         embed_ok = false) verweisen über einen tuer-Block nach außen. */
      let coverHtml = '';
      if (seite.cover_url) {
        const einbettbar = seite.video_url && seite.embed_ok !== false;
        coverHtml = '<figure class="br-bild' + (einbettbar ? ' br-spielbar' : '') + '"' +
             (einbettbar ? ' data-video="' + window.mm.esc(seite.video_url) + '"' : '') + '>' +
             '<img src="' + window.mm.esc(seite.cover_url) + '" alt="' + window.mm.esc(titel) +
             '" loading="lazy" style="object-position:' +
             window.mm.esc(seite.cover_pos || '50% 50%') + '">' +
             (einbettbar ? '<button class="br-play" type="button" aria-label="' + T('video-abspielen', 'Video abspielen') + '">▶</button>' : '') +
             '</figure>';
      } else if (seite.video_url && seite.embed_ok !== false) {
        coverHtml = '<div class="br-film">' + einbettung(seite.video_url) + '</div>';
      }

      /* ---- Die Karte (zugeklappt) ----
         Zu sehen: Cover -- oder ohne Cover das erste Bild/GIF/Video --, der
         Anfang des ersten Textes und "Mehr ansehen". Der ganze Rest steht
         NICHT im Dokument, sondern kommt erst beim Öffnen in die Bühne
         (buehne.js). So gibt es keine versteckten Tab-Fallen, und der Brief
         zeigt auf den ersten Blick nur das Wichtigste. */
      const vorschauBlock = coverHtml ? null : bloecke.find(b => b.typ === 'bild' || b.typ === 'gif' || b.typ === 'video');
      const anrissBlock = bloecke.find(b => b.typ === 'text');
      h += '<div class="br-karte-vorschau">' +
           (coverHtml || (vorschauBlock ? window.mmBloecke.render(vorschauBlock, 'br-text') : '')) + '</div>';
      /* Eckdaten wie im Profil oben: Kunde und Jahr, beide im Admin pflegbar
         (Felder "Kunde" und "Jahr"). Leere Angaben fallen weg; fehlen beide,
         gibt es gar keine Tabelle. */
      /* Kunde und Jahr haben keine englische Spalte. Das einzige deutsche
         Wort, das dort vorkommt, ist "seit" (Bitbull: "seit 2026") -- auf
         Englisch wird daraus "since". */
      const jahr = window.mmSprache === 'en' && seite.jahr
        ? String(seite.jahr).replace(/^\s*seit\b/i, 'since') : seite.jahr;
      const fakten = [[T('bu-kunde', 'Kunde'), seite.kunde], [T('bu-jahr', 'Jahr'), jahr]]
        .filter(([, w]) => w && String(w).trim());
      /* Karte nach Lucas' Wahl aus den Entwuerfen (05.10.): auf dem Rechner
         "2C Geteilt" -- Medium links, Text und Eckdaten rechts --, auf dem
         Handy "1B Medium zuerst" -- Medium oben, Titel mit Pfeil darunter.
         Dieselben Elemente, nur das CSS (buehne.css) ordnet sie anders an. */
      h += '<div class="br-karte-text">' + kopf +
           '<div class="br-projekt-rest">' +
           (anrissBlock ? '<div class="br-anriss">' + window.mmBloecke.render(anrissBlock, 'br-text') + '</div>' : '') +
           (fakten.length ? '<dl class="br-fakten">' + fakten.map(([k, w]) =>
             '<div><dt>' + window.mm.esc(k) + '</dt><dd>' + window.mm.esc(String(w)) + '</dd></div>').join('') + '</dl>' : '') +
           '<button type="button" class="br-mehr-ansehen" aria-haspopup="dialog">' +
             '<span class="br-mehr-text">' + T('bu-mehr', 'Mehr ansehen') + '</span> <span aria-hidden="true">→</span></button>' +
           '</div></div>';
      s.innerHTML = h;
      s.classList.add('br-karte');
      s.dataset.slug = seite.slug || '';
      /* Das Element, das sich beim Öffnen in die Bühne verwandelt
         (View Transition, buehne.js): das sichtbare Medium der Karte. */
      const medium = s.querySelector('.br-karte-vorschau .md-gallery, .br-karte-vorschau .md-video, .br-karte-vorschau .br-bild, .br-karte-vorschau .br-film');
      if (medium) medium.classList.add('br-karte-medium');

      const nr = window.mmProjekte.length;
      window.mmProjekte.push({ slug: seite.slug || '', titel, untertitel, farbe: seite.farbe,
        coverHtml, bloecke, element: s });
      /* Öffnen: Knopf, Titel, Text, Medium -- alles außer Links und dem ▶,
         das das Video weiterhin direkt in der Karte abspielt. */
      s.addEventListener('click', (e) => {
        if (e.target.closest('a, .br-play, .br-spielbar, iframe')) return;
        if (!window.mmBuehneOeffnen) return;
        window.mmBuehneOeffnen(nr, 0, { knopf: s.querySelector('.br-mehr-ansehen') });
      });
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

    /* Bei Projekt-Karten haengen die Blumen an der ganzen Karte und liegen
       HINTER deren Flaeche (buehne.css): Sie schauen seitlich hervor, statt
       auf Cover oder Text zu liegen. */
    if (window.mmBlumen) window.mmBlumen(abschnitte.map(a => a.element));

    return abschnitte;
  };
})();
