/* mausemaus — Datenzugriff für die öffentliche Seite.
   Bewusst ohne fremde Bibliothek: das ist ein einziger GET-Aufruf.
   Der Admin-Bereich lädt zusätzlich die Supabase-Bibliothek, weil er
   Anmeldung, Uploads und Schreibzugriffe braucht. */

(() => {
  const CFG = window.MM_CONFIG || {};
  const CACHE = 'mm.projects.v1';
  const eingerichtet = CFG.url && !CFG.url.startsWith('HIER_');

  window.mmLoadProjects = async function () {
    if (!eingerichtet) return ausSeed('Supabase noch nicht eingetragen');

    try {
      const r = await fetch(
        `${CFG.url}/rest/v1/projects?status=eq.published&order=sort_order.asc&select=*`,
        { headers: { apikey: CFG.key, Authorization: `Bearer ${CFG.key}` } });
      if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + (await r.text()).slice(0, 120));
      const daten = await r.json();
      try { localStorage.setItem(CACHE, JSON.stringify({ zeit: Date.now(), daten })); } catch {}
      return daten;
    } catch (e) {
      /* Netz weg oder Projekt pausiert -> zuletzt geladene Fassung zeigen,
         damit die Seite nie leer ist. */
      console.warn('[mausemaus] Datenbank nicht erreichbar:', e.message);
      try {
        const c = JSON.parse(localStorage.getItem(CACHE) || 'null');
        if (c && c.daten && c.daten.length) {
          console.info('[mausemaus] zeige zwischengespeicherte Fassung von',
            new Date(c.zeit).toLocaleString('de-DE'));
          return c.daten;
        }
      } catch {}
      return ausSeed('weder Datenbank noch Zwischenspeicher verfügbar');
    }
  };

  /* ---------- Einstellungen der Startseite ---------- */

  const CACHE_E = 'mm.settings.v1';

  window.mmLoadSettings = async function () {
    if (!eingerichtet) return null;
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

  function ausSeed(grund) {
    console.info('[mausemaus] Notfall-Daten aus seed.js —', grund);
    return (window.SEED_PROJECTS || [])
      .filter(p => p.status === 'published')
      .sort((a, b) => a.sort_order - b.sort_order);
  }
})();
