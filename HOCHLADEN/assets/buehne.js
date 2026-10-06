/* mausemaus — die Bühne: ein Projekt-Eintrag, aufgeklappt in Kapiteln.

   Im Brief steht jedes Projekt zugeklappt als Karte (brief.js): Titel,
   Vorschau-Medium, der Anfang des Textes, "Mehr ansehen". Ein Klick öffnet
   hier die Bühne -- ein natives <dialog> mit showModal(). Das bringt ohne
   eigenen Code mit: Fokus bleibt im Fenster, Esc schließt, der Rest der
   Seite ist für Tastatur und Screenreader stumm.

   Der Inhalt läuft in KAPITELN (mmKapitel): Jedes Bild, GIF oder Video
   beginnt ein neues, Text hängt sich an das Medium davor. Lucas steuert die
   Kapitel also allein über die Reihenfolge seiner Blöcke im Admin.

   Die Bewegung: Beim Öffnen verwandelt sich das Vorschau-Medium der Karte
   in das Medium der Bühne (View Transitions, wo vorhanden), der Brief
   dahinter wird dunkler und unscharf. Zwischen Kapiteln gleitet das alte
   nach links hinaus und das neue von rechts herein -- Medium und Text um
   60 ms versetzt. Mit "Bewegung reduzieren" wird nur überblendet. */
(function () {
  var T = function (k, de) { return (window.mmText ? window.mmText(k) : '') || de; };
  var ruhig = function () { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; };
  var MEDIEN = { bild: 1, gif: 1, video: 1 };

  /* ---------- Kapitel aus Blöcken ----------
     hatCover: das Projekt hat ein Titelbild/Video -- dann ist das Medium des
     ersten Kapitels und der Text davor gehört dazu. Ohne Cover wandert der
     Text vor dem ersten Medium in dessen Kapitel (sonst stünde vorn ein
     Kapitel ganz ohne Bild). Ein trenner mitten drin erzwingt einen Bruch,
     ein trenner am Ende fällt weg. */
  window.mmKapitel = function (bloecke, hatCover) {
    var kap = [], cur = { medium: hatCover ? 'cover' : null, texte: [] }, vorlauf = [];
    function abschliessen() {
      if (cur.medium || cur.texte.length) kap.push(cur);
      cur = { medium: null, texte: [] };
    }
    (bloecke || []).forEach(function (b) {
      if (b.typ === 'trenner') { abschliessen(); return; }
      if (MEDIEN[b.typ]) {
        if (!cur.medium && !kap.length && !hatCover) {
          /* allererstes Medium ohne Cover: der Text davor gehört dazu */
          cur.medium = b;
          return;
        }
        abschliessen();
        cur.medium = b;
        return;
      }
      cur.texte.push(b);
    });
    abschliessen();
    return kap;
  };

  var dialog = null, zustand = null;

  /* Verwandlung starten. Der Browser darf sie abbrechen (z. B. wenn der Tab
     gerade nicht sichtbar ist) -- dann laeuft die Aenderung trotzdem, nur
     ohne Animation. Die abgelehnten Versprechen ready/finished muessen
     aufgefangen werden, sonst steht "Transition was aborted" als Fehler in
     der Konsole (live auf mausemaus.com gesehen). */
  function verwandeln(aenderung, danach) {
    var vt = document.startViewTransition(aenderung);
    vt.ready.catch(function () {});
    vt.finished.then(danach, danach);
  }

  function bauen() {
    dialog = document.createElement('dialog');
    dialog.className = 'bu';
    dialog.setAttribute('aria-labelledby', 'bu-titel');
    dialog.innerHTML =
      '<div class="bu-kopf">' +
        '<div class="bu-kopf-text"><p class="bu-rolle"></p><h2 class="bu-titel" id="bu-titel" tabindex="-1"></h2></div>' +
        '<button type="button" class="bu-zu" aria-label="' + T('bu-zu', 'Schließen') + '">✕</button>' +
      '</div>' +
      '<div class="bu-fortschritt"><div class="bu-gleis" aria-hidden="true"></div><p class="bu-zaehler" aria-live="polite"></p></div>' +
      '<div class="bu-flaeche"></div>' +
      '<div class="bu-fuss">' +
        '<button type="button" class="bu-zurueck">‹ ' + T('bu-zurueck', 'Zurück') + '</button>' +
        '<button type="button" class="bu-weiter">' + T('bu-weiter', 'Weiter') + ' ›</button>' +
      '</div>';
    document.body.appendChild(dialog);

    dialog.querySelector('.bu-zu').addEventListener('click', function () { schliessen(); });
    dialog.querySelector('.bu-zurueck').addEventListener('click', function () { gehe(-1); });
    dialog.querySelector('.bu-weiter').addEventListener('click', function () { weiterOderNaechstes(); });
    /* Esc: selbst schließen (mit Animation und Adresse), nicht abrupt. */
    dialog.addEventListener('cancel', function (e) { e.preventDefault(); schliessen(); });
    /* Klick auf den abgedunkelten Rand (das ist das <dialog> selbst). */
    dialog.addEventListener('click', function (e) { if (e.target === dialog) schliessen(); });
    dialog.addEventListener('keydown', function (e) {
      if (e.target.closest('input, textarea')) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); weiterOderNaechstes(); }
      if (e.key === 'ArrowLeft')  { e.preventDefault(); gehe(-1); }
    });
    /* Wischen auf Touch: Weite ODER Tempo reicht -- ein schneller kurzer
       Wisch soll genauso weiterschalten wie ein langer. */
    var start = null;
    dialog.querySelector('.bu-flaeche').addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse') return;
      start = { x: e.clientX, y: e.clientY, t: performance.now() };
    });
    dialog.querySelector('.bu-flaeche').addEventListener('pointerup', function (e) {
      if (!start) return;
      var dx = e.clientX - start.x, dy = e.clientY - start.y, dt = performance.now() - start.t;
      start = null;
      if (Math.abs(dx) < Math.abs(dy) * 1.4) return;          // war Scrollen
      if (Math.abs(dx) > 60 || Math.abs(dx) / dt > 0.11) {
        if (dx < 0) weiterOderNaechstes(); else gehe(-1);
      }
    });
    /* Cover mit ▶ in der Bühne: erst beim Klick den Abspieler holen. */
    dialog.addEventListener('click', function (e) {
      var f = e.target.closest('.br-spielbar');
      if (!f || !f.dataset.video || !window.mmEinbettung) return;
      f.classList.remove('br-spielbar');
      f.innerHTML = window.mmEinbettung(f.dataset.video);
      f.classList.add('br-film');
    });
  }

  /* Text eines Kapitels in einzelne Stuecke zerlegen -- Absatz fuer Absatz.
     Ein Textblock mit mehreren Absaetzen wird dabei aufgeteilt (jeder Absatz
     in eigener .br-text-Huelle, die Abstaende bleiben gleich); Zitate,
     Kaesten und Tuerchen bleiben ganz. */
  function stuecke(texte) {
    var teile = [];
    texte.forEach(function (b) {
      var tmp = document.createElement('div');
      tmp.innerHTML = window.mmBloecke.render(b, 'br-text');
      Array.prototype.forEach.call(tmp.children, function (el) {
        if (el.className === 'br-text' && el.children.length > 1) {
          Array.prototype.forEach.call(el.children, function (c) {
            teile.push('<div class="br-text">' + c.outerHTML + '</div>');
          });
        } else {
          teile.push(el.outerHTML);
        }
      });
    });
    return teile;
  }

  /* Seiten statt Rollbalken. Lucas: "dieses Scrollen stoert sehr" -- langer
     Text stand in einem Kasten mit eigenem Rollbalken und war oben und unten
     abgeschnitten. Jetzt wird auf DIESEM Bildschirm gemessen, wie viel Text
     neben das Medium passt; was nicht passt, wandert als Fortsetzung auf
     eine eigene Seite (ohne Medium, mit breiterer Textspalte). Man blaettert
     nur noch mit "Weiter". Auf dem Handy bleibt es beim Blatt, das man von
     oben nach unten liest -- dort ist Scrollen das Normale. */
  function umbrechen(seiten) {
    if (window.innerWidth <= 760) return seiten;
    var flaeche = dialog.querySelector('.bu-flaeche');
    var mess = document.createElement('div');
    mess.className = 'bu-messen';
    mess.setAttribute('aria-hidden', 'true');
    flaeche.appendChild(mess);
    var passt = function (s) {
      mess.innerHTML = '';
      var el = kapitelHtml(zustand.p, s, true);
      mess.appendChild(el);
      var t = el.querySelector('.bu-text');
      return !t || t.scrollHeight <= t.clientHeight + 2;
    };
    var raus = [];
    seiten.forEach(function (s) {
      var cur = { medium: s.medium, teile: [] };
      s.teile.forEach(function (t) {
        cur.teile.push(t);
        if (cur.teile.length > 1 && !passt(cur)) {
          cur.teile.pop();
          raus.push(cur);
          cur = { medium: null, teile: [t] };
        }
      });
      raus.push(cur);
    });
    mess.remove();
    return raus;
  }

  /* nurMessen: das Medium bleibt ein leerer Platzhalter. Die Hoehe der
     Textspalte haengt nicht davon ab, und so laedt das Messen keine Bilder
     und keine fremden Video-Abspieler. */
  function kapitelHtml(p, k, nurMessen) {
    var medium = '';
    if (nurMessen && k.medium) medium = ' ';
    else if (k.medium === 'cover') medium = p.coverHtml;
    else if (k.medium) medium = window.mmBloecke.render(k.medium, 'br-text');
    var text = k.teile.join('\n');
    var el = document.createElement('div');
    el.className = 'bu-kapitel' + (medium ? '' : ' bu-ohne-medium') + (text ? '' : ' bu-ohne-text');
    el.innerHTML = (medium ? '<div class="bu-medium">' + medium + '</div>' : '') +
                   (text ? '<div class="bu-text">' + text + '</div>' : '');
    return el;
  }

  function gleis() {
    var g = dialog.querySelector('.bu-gleis'), n = zustand.kapitel.length, i = zustand.i;
    var h = '';
    for (var k = 0; k < n; k++) h += '<i' + (k <= i ? ' class="fertig"' : '') + '></i>';
    g.innerHTML = h;
    g.style.setProperty('--stand', ((i + 1) / n * 100) + '%');
    dialog.querySelector('.bu-zaehler').textContent =
      T('bu-kapitel', 'Kapitel {a} von {b}').replace('{a}', i + 1).replace('{b}', n);
    var letzt = i === n - 1, naechstes = window.mmProjekte[zustand.nr + 1];
    dialog.querySelector('.bu-zurueck').disabled = i === 0;
    var w = dialog.querySelector('.bu-weiter');
    w.textContent = letzt
      ? (naechstes ? T('bu-naechstes', 'Nächstes Projekt') + ': ' + naechstes.titel + ' ›' : T('bu-zu', 'Schließen'))
      : T('bu-weiter', 'Weiter') + ' ›';
    w.classList.toggle('bu-naechstes', letzt && !!naechstes);
  }

  /* Ein Kapitel zeigen. richtung: 1 vor, -1 zurück, 0 ohne Bewegung. */
  function zeigeKapitel(richtung) {
    var flaeche = dialog.querySelector('.bu-flaeche');
    var neu = kapitelHtml(zustand.p, zustand.kapitel[zustand.i]);
    var alt = flaeche.querySelectorAll('.bu-kapitel:not(.bu-geht)');
    if (richtung && !ruhig()) {
      neu.classList.add(richtung > 0 ? 'bu-von-rechts' : 'bu-von-links');
      flaeche.appendChild(neu);
      void neu.offsetWidth;                      // Startzustand festnageln
      neu.classList.remove('bu-von-rechts', 'bu-von-links');
      alt.forEach(function (a) {
        a.classList.add('bu-geht', richtung > 0 ? 'bu-nach-links' : 'bu-nach-rechts');
        setTimeout(function () { a.remove(); }, 450);
      });
    } else if (richtung) {
      neu.classList.add('bu-blende');
      flaeche.appendChild(neu);
      void neu.offsetWidth;
      neu.classList.remove('bu-blende');
      alt.forEach(function (a) { a.classList.add('bu-geht', 'bu-blende'); setTimeout(function () { a.remove(); }, 260); });
    } else {
      flaeche.innerHTML = '';
      flaeche.appendChild(neu);
    }
    if (window.mmTueren) window.mmTueren(neu);
    gleis();
  }

  function gehe(d) {
    if (!zustand) return;
    var i = zustand.i + d;
    if (i < 0 || i >= zustand.kapitel.length) return;
    zustand.i = i;
    zeigeKapitel(d);
    adresse(true);
  }

  function weiterOderNaechstes() {
    if (!zustand) return;
    if (zustand.i < zustand.kapitel.length - 1) return gehe(1);
    var nr = zustand.nr + 1;
    if (!window.mmProjekte[nr]) return schliessen();
    /* Nächstes Projekt: die Kamera fährt weiter -- neuer Inhalt gleitet
       herein wie ein weiteres Kapitel. */
    fuellen(nr, 0);
    zeigeKapitel(1);
    adresse(true);
  }

  function fuellen(nr, i) {
    var p = window.mmProjekte[nr];
    zustand = { nr: nr, p: p, i: i, kapitel: window.mmKapitel(p.bloecke, !!p.coverHtml)
      .map(function (k) { return { medium: k.medium, teile: stuecke(k.texte) }; }) };
    /* Umbrechen braucht ein sichtbares Fenster zum Messen -- beim ersten
       Oeffnen holt mmBuehneOeffnen das nach dem showModal() nach. */
    if (dialog.open) zustand.kapitel = umbrechen(zustand.kapitel);
    dialog.querySelector('.bu-rolle').textContent = p.untertitel || '';
    dialog.querySelector('.bu-titel').textContent = p.titel;
    dialog.style.setProperty('--bu-farbe', p.farbe || '#BFCC94');
  }

  /* #slug in der Adresse: direkt verlinkbar, und "Zurück" im Browser
     schließt die Bühne statt die Seite zu verlassen. */
  var eigenerEintrag = false;
  function adresse(ersetzen) {
    var ziel = '#' + zustand.p.slug + (zustand.i ? '/' + (zustand.i + 1) : '');
    if (location.hash === ziel) return;
    if (ersetzen && eigenerEintrag) history.replaceState({ mmBuehne: 1 }, '', ziel);
    else { history.pushState({ mmBuehne: 1 }, '', ziel); eigenerEintrag = true; }
  }

  var karteZuletzt = null;
  function vorschauVon(nr) {
    var s = window.mmProjekte[nr] && window.mmProjekte[nr].element;
    return s && s.querySelector('.br-karte-medium');
  }

  window.mmBuehneOeffnen = function (nr, kapitel, optionen) {
    if (!window.mmProjekte || !window.mmProjekte[nr]) return;
    if (!dialog) bauen();
    optionen = optionen || {};
    karteZuletzt = optionen.knopf || null;
    var gewuenscht = Math.max(0, kapitel || 0);
    fuellen(nr, 0);
    var quelle = vorschauVon(nr);
    var aufziehen = function () {
      /* Erst sichtbar machen, dann messen und in Seiten umbrechen. */
      var kasten = document.getElementById('mm-vorschau-kasten');
      if (kasten) dialog.appendChild(kasten);
      dialog.showModal();
      document.documentElement.classList.add('bu-offen');
      zustand.kapitel = umbrechen(zustand.kapitel);
      zustand.i = Math.min(gewuenscht, zustand.kapitel.length - 1);
      zeigeKapitel(0);
      if (quelle) quelle.style.viewTransitionName = '';
      var ziel = dialog.querySelector('.bu-medium');
      if (ziel && quelle) ziel.style.viewTransitionName = 'bu-medium';
      /* (Der Vorschaukasten der Türchen hängt oben in der Bühne -- sonst
         läge er UNTER dem modalen Fenster und bliebe unsichtbar.) */
      dialog.querySelector('.bu-titel').focus({ preventScroll: true });
    };
    if (document.startViewTransition && !ruhig() && quelle) {
      quelle.style.viewTransitionName = 'bu-medium';
      verwandeln(aufziehen, function () {
        var z = dialog.querySelector('.bu-medium'); if (z) z.style.viewTransitionName = '';
      });
    } else {
      aufziehen();
    }
    if (!optionen.ohneAdresse) adresse(false);
  };

  function schliessen(ausVerlauf) {
    if (!dialog || !dialog.open) return;
    var nr = zustand ? zustand.nr : -1;
    var ziel = vorschauVon(nr);
    /* Fokus zurück dorthin, wo man herkam -- oder zum Knopf der Karte,
       falls man über "Nächstes Projekt" woanders gelandet ist. ERST NACH
       dialog.close(): Solange das Fenster offen ist, ist der Brief inert
       und nimmt keinen Fokus an. Mit Verwandlung laeuft das Schliessen
       verzoegert -- vorher landete der Fokus dann im Nichts (<body>). */
    var knopf = (nr >= 0 && window.mmProjekte[nr].element.querySelector('.br-mehr-ansehen')) || karteZuletzt;
    var zumachen = function () {
      var kasten = document.getElementById('mm-vorschau-kasten');
      if (kasten) { kasten.hidden = true; document.body.appendChild(kasten); }
      dialog.close();
      document.documentElement.classList.remove('bu-offen');
      dialog.querySelector('.bu-flaeche').innerHTML = '';   // Videos anhalten
      var z = dialog.querySelector('.bu-medium'); if (z) z.style.viewTransitionName = '';
      if (ziel) ziel.style.viewTransitionName = 'bu-medium';
      if (knopf) knopf.focus({ preventScroll: true });
    };
    var quelle = dialog.querySelector('.bu-kapitel:not(.bu-geht) .bu-medium');
    if (document.startViewTransition && !ruhig() && ziel && quelle && zustand.i === 0) {
      quelle.style.viewTransitionName = 'bu-medium';
      verwandeln(zumachen, function () { ziel.style.viewTransitionName = ''; });
    } else {
      zumachen();
      if (ziel) ziel.style.viewTransitionName = '';
    }
    zustand = null;
    if (!ausVerlauf && eigenerEintrag) { eigenerEintrag = false; history.back(); }
    else if (!ausVerlauf && location.hash) history.replaceState(null, '', location.pathname + location.search);
  }
  window.mmBuehneSchliessen = schliessen;

  /* Fenster wird groesser/kleiner, waehrend die Buehne offen ist: neu
     umbrechen. Man bleibt ungefaehr an derselben Stelle im Projekt. */
  var ruhe = null;
  window.addEventListener('resize', function () {
    clearTimeout(ruhe);
    ruhe = setTimeout(function () {
      if (!dialog || !dialog.open || !zustand) return;
      var anteil = zustand.i / Math.max(1, zustand.kapitel.length - 1);
      fuellen(zustand.nr, 0);
      zustand.i = Math.round(anteil * (zustand.kapitel.length - 1));
      zeigeKapitel(0);
    }, 200);
  });

  window.addEventListener('popstate', function () {
    if (dialog && dialog.open && !/^#[a-z0-9-]+/.test(location.hash)) {
      eigenerEintrag = false;
      schliessen(true);
    }
  });

  /* Beim Laden mit #slug (oder #slug/3): gleich die Bühne öffnen. Aufgerufen
     von index.html, wenn der Brief steht. */
  window.mmBuehneAusAdresse = function () {
    var m = /^#([a-z0-9-]+)(?:\/(\d+))?$/.exec(location.hash);
    if (!m || !window.mmProjekte) return;
    var nr = window.mmProjekte.findIndex(function (p) { return p.slug === m[1]; });
    if (nr < 0) return;
    eigenerEintrag = false;
    window.mmBuehneOeffnen(nr, m[2] ? Number(m[2]) - 1 : 0, { ohneAdresse: true });
  };
})();
