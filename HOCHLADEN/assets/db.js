/* mausemaus — Datenzugriff für die öffentliche Seite.
   Bewusst ohne fremde Bibliothek: das ist ein einziger GET-Aufruf.
   Der Admin-Bereich lädt zusätzlich die Supabase-Bibliothek, weil er
   Anmeldung, Uploads und Schreibzugriffe braucht. */

(() => {
  const CFG = window.MM_CONFIG || {};
  const CACHE = 'mm.projects.v1';
  const eingerichtet = CFG.url && !CFG.url.startsWith('HIER_');

  /* Hier stand mmLoadProjects() -- das Laden der alten `projects`-Tabelle.
     Seit dem Umbau auf seiten/bloecke ruft es niemand mehr auf (geprueft
     ueber alle HTML-, JS- und Pruefdateien). Die Tabelle selbst bleibt in
     der Datenbank: die Sicherungs-Ausgabe im Admin greift noch darauf zu.

     mmLoadSettings() und mmLoadPosts() weiter unten gehoeren ebenfalls zum
     alten Modell, bleiben aber stehen -- pruefe-brief.mjs und
     pruefe-welten.mjs benutzen sie. Sie zu entfernen hiesse, zwei laufende
     Pruefungen umzubauen, ohne dass ein Besucher etwas davon haette. */

  /* ---------- Einstellungen der Startseite ---------- */

  const CACHE_E = 'mm.settings.v1';

  window.mmLoadSettings = async function () {
    if (!eingerichtet) { await seedHolen(); return window.SEED_SETTINGS || null; }
    try {
      const r = await fetch(`${CFG.url}/rest/v1/settings?id=eq.1&select=*`,
        { headers: { apikey: CFG.key, Authorization: `Bearer ${CFG.key}` } });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const [e] = await r.json();
      if (e) { try { localStorage.setItem(CACHE_E, JSON.stringify(e)); } catch {} }
      return e || null;
    } catch (e) {
      console.warn('[mausemaus] Einstellungen nicht erreichbar:', e.message);
      try {
        const c = JSON.parse(localStorage.getItem(CACHE_E) || 'null');
        if (c) return c;
      } catch {}
      /* Dritte Stufe: die mitgelieferten Notfalldaten. Ohne sie verlöre der
         Brief bei einem Ausfall Anfang und Ende — die Projekte allein
         abzusichern reicht nicht. */
      console.info('[mausemaus] Einstellungen aus seed.js');
      await seedHolen();
      return window.SEED_SETTINGS || null;
    }
  };

  /* ---------- Blog-Beiträge ---------- */

  const CACHE_B = 'mm.posts.v2';

  window.mmLoadPosts = async function (slug) {
    if (!eingerichtet) return [];
    const frage = slug
      ? `slug=eq.${encodeURIComponent(slug)}&status=eq.published`
      : 'status=eq.published&order=published_at.desc';
    try {
      const r = await fetch(`${CFG.url}/rest/v1/posts?${frage}&select=*`,
        { headers: { apikey: CFG.key, Authorization: `Bearer ${CFG.key}` } });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const daten = await r.json();
      /* Nur die vollständige Liste zwischenspeichern, nicht Einzelabfragen. */
      if (!slug) { try { localStorage.setItem(CACHE_B, JSON.stringify({ zeit: Date.now(), daten })); } catch {} }
      return daten;
    } catch (e) {
      console.warn('[mausemaus] Beiträge nicht erreichbar:', e.message);
      try {
        const c = JSON.parse(localStorage.getItem(CACHE_B) || 'null');
        if (c && c.daten) return slug ? c.daten.filter(p => p.slug === slug) : c.daten;
      } catch {}
      return [];
    }
  };

  /* ---------- Blockeditor: seiten/bloecke ----------
     `notiz` wird bewusst nirgends mit abgefragt -- die Spalte ist für
     "anon" ohnehin per REVOKE gesperrt (siehe Migration), select=* auf den
     eingebetteten Blöcken würde also mit einem Rechte-Fehler scheitern.
     Die Spaltenliste hier ist deshalb Teil des Vertrags, nicht nur Zierde. */
  const BLOCK_SPALTEN = 'id,seite_id,typ,inhalt,breite,sort_order,created_at,updated_at';
  const eingebettet = `select=*,bloecke(${BLOCK_SPALTEN})`;

  const sortiereBloecke = (seite) => {
    if (seite && Array.isArray(seite.bloecke)) seite.bloecke.sort((a, b) => a.sort_order - b.sort_order);
    return seite;
  };

  /* Eine einzelne Seite mit ihren Blöcken -- für den Brief (typ=brief,
     slug=brief) und für eine Welt (typ=welt, slug=<der Türchen-Slug>). */
  const CACHE_S = 'mm.seite.v1.';

  window.mmLoadSeite = async function (typ, slug) {
    const cacheKey = CACHE_S + typ + '.' + slug;
    if (!eingerichtet) return ausSeedSeite(typ, slug);
    try {
      const r = await fetch(
        `${CFG.url}/rest/v1/seiten?typ=eq.${encodeURIComponent(typ)}&slug=eq.${encodeURIComponent(slug)}` +
        `&status=eq.published&${eingebettet}`,
        { headers: { apikey: CFG.key, Authorization: `Bearer ${CFG.key}` } });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const [seite] = await r.json();
      if (seite) { try { localStorage.setItem(cacheKey, JSON.stringify(seite)); } catch {} }
      return sortiereBloecke(seite || null);
    } catch (e) {
      console.warn('[mausemaus] Seite nicht erreichbar:', e.message);
      try {
        const c = JSON.parse(localStorage.getItem(cacheKey) || 'null');
        if (c) return sortiereBloecke(c);
      } catch {}
      return ausSeedSeite(typ, slug);
    }
  };

  /* Alle veröffentlichten Projekt-Seiten, samt Blöcken, in Reihenfolge --
     für den Brief (ein Zeitleisten-Abschnitt je Projekt). */
  const CACHE_P = 'mm.projekte.v1';

  window.mmLoadProjektSeiten = async function () {
    if (!eingerichtet) return ausSeedProjekte();
    try {
      const r = await fetch(
        `${CFG.url}/rest/v1/seiten?typ=eq.projekt&status=eq.published&order=sort_order.asc&${eingebettet}`,
        { headers: { apikey: CFG.key, Authorization: `Bearer ${CFG.key}` } });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const daten = (await r.json()).map(sortiereBloecke);
      try { localStorage.setItem(CACHE_P, JSON.stringify({ zeit: Date.now(), daten })); } catch {}
      return daten;
    } catch (e) {
      console.warn('[mausemaus] Projekt-Seiten nicht erreichbar:', e.message);
      try {
        const c = JSON.parse(localStorage.getItem(CACHE_P) || 'null');
        if (c && c.daten) return c.daten;
      } catch {}
      return ausSeedProjekte();
    }
  };

  /* ---------- Notfall-Daten erst holen, wenn sie gebraucht werden ----------

     seed.js ist 75 kB und lag frueher als festes <script> in jeder Seite --
     jeder Besucher holte und verarbeitete es, obwohl es die DRITTE und
     letzte Rueckfallstufe ist und im Normalbetrieb nie gebraucht wird.

     Warum das Nachladen hier trotzdem sicher ist: Wer diese Zeilen erreicht,
     hat gerade die Startseite von Netlify bekommen -- Netlify ist also
     erreichbar, und seed.js liegt bei Netlify. Ausgefallen ist die
     DATENBANK (Supabase), ein anderer Rechner. Genau dieser Fall ist der
     haeufige.

     Und wenn auch das Nachladen scheitert, wird NICHTS schlimmer als vorher:
     die Funktion liefert dann null, und die Seite zeigt ihre freundliche
     "Hier ist nichts"-Fassung -- dieselbe wie bei einem unbekannten Slug.
     Deshalb lehnt das Versprechen unten NIE ab, es wird nur erfuellt. */
  let seedGeladen = null;
  function seedHolen() {
    /* Schon da? Dann nichts tun. Das gilt auch, wenn seed.js weiterhin fest
       in einer Seite steht -- der alte Weg funktioniert unveraendert. */
    if (window.SEED_SEITEN) return Promise.resolve();
    if (seedGeladen) return seedGeladen;
    seedGeladen = new Promise((fertig) => {
      const el = document.createElement('script');
      el.src = '/assets/seed.js';
      el.onload = fertig;
      el.onerror = () => { console.warn('[mausemaus] seed.js nicht erreichbar'); fertig(); };
      document.head.appendChild(el);
    });
    return seedGeladen;
  }

  async function ausSeedSeite(typ, slug) {
    await seedHolen();
    console.info('[mausemaus] Notfall-Daten aus seed.js —', typ, slug);
    const s = window.SEED_SEITEN || {};
    if (typ === 'brief') return s.brief || null;
    return (s.welten || []).find(w => w.slug === slug) || null;
  }

  async function ausSeedProjekte() {
    await seedHolen();
    return (window.SEED_SEITEN && window.SEED_SEITEN.projekte) || [];
  }
})();
