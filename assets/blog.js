/* mausemaus — Blog: Übersicht und Einzelbeitrag.
   Nutzt denselben Markdown-Renderer wie die Startseite und der Admin. */

(() => {
  const { renderMarkdown, esc, excerpt } = window.mm;
  const $ = (s) => document.querySelector(s);

  const datum = (d) => d
    ? new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })
    : '';

  /* Grobe Lesedauer aus der Wortzahl — 200 Wörter je Minute. */
  const lesezeit = (text) => {
    const n = String(text || '').split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.round(n / 200)) + ' Min. Lesezeit';
  };

  /* ---------- Übersicht ---------- */
  async function uebersicht() {
    const posts = await window.mmLoadPosts();
    const ziel = $('#liste');
    if (!posts.length) {
      ziel.innerHTML = '<p class="leer">Hier steht bald der erste Beitrag.</p>';
      return;
    }
    ziel.innerHTML = posts.map(p => `
      <a class="eintrag" href="/blog/${esc(p.slug)}">
        ${p.cover_url ? `<div class="eintrag-bild"><img src="${esc(p.cover_url)}" alt=""
             style="object-position:${esc(p.cover_pos || '50% 50%')}" loading="lazy"></div>` : ''}
        <div class="eintrag-text">
          <div class="eintrag-meta">${esc(datum(p.published_at))} · ${esc(lesezeit(p.body))}</div>
          <h2 class="eintrag-titel tropi">${esc(p.title)}</h2>
          <p class="eintrag-anriss">${esc(p.subtitle || excerpt(p.body, 165))}</p>
          ${(p.tags || []).length
            ? `<div class="tags">${p.tags.map(t => `<span class="pill">${esc(t)}</span>`).join('')}</div>` : ''}
        </div>
      </a>`).join('');
  }

  /* ---------- Einzelbeitrag ---------- */
  async function beitrag() {
    /* Adresse kommt entweder als ?p=… oder als /blog/… (Netlify schreibt um) */
    const ausPfad = location.pathname.match(/\/blog\/([\w-]+)\/?$/);
    const slug = new URLSearchParams(location.search).get('p') || (ausPfad && ausPfad[1]);
    if (!slug) return zeigeFehler('Kein Beitrag angegeben.');

    const [p] = await window.mmLoadPosts(slug);
    if (!p) return zeigeFehler('Diesen Beitrag gibt es nicht (mehr).');

    document.title = p.title + ' — mausemaus';
    $('#kopf').innerHTML = `
      <div class="beitrag-datum">${esc(datum(p.published_at))} · ${esc(lesezeit(p.body))}</div>
      <h1 class="beitrag-titel tropi">${esc(p.title)}</h1>
      ${p.subtitle ? `<p class="beitrag-unter">${esc(p.subtitle)}</p>` : ''}
      ${(p.tags || []).length
        ? `<div class="tags" style="margin-top:16px">${p.tags.map(t => `<span class="pill">${esc(t)}</span>`).join('')}</div>` : ''}`;
    $('#text').innerHTML = renderMarkdown(p.body);

    nachbereiten();
  }

  function zeigeFehler(text) {
    $('#kopf').innerHTML = `<h1 class="beitrag-titel tropi">Nichts gefunden</h1>`;
    $('#text').innerHTML = `<p>${esc(text)} <a href="/blog">Zurück zur Übersicht</a></p>`;
  }

  /* ---------- Nachbereitung: Code einfärben, Demos einsetzen, Kopieren ---------- */
  function nachbereiten() {
    /* Interaktive Einlagen */
    document.querySelectorAll('.mm-demo').forEach(el => {
      const bauen = (window.MM_DEMOS || {})[el.dataset.demo];
      if (bauen) bauen(el);
      else el.innerHTML = '<p class="leer">Diese Einlage ist nicht hinterlegt.</p>';
    });

    /* Syntax einfärben — highlight.js wird nur auf Blogseiten geladen */
    if (window.hljs) {
      document.querySelectorAll('.code-block code').forEach(el => window.hljs.highlightElement(el));
    }

    /* Kopier-Knöpfe */
    document.querySelectorAll('.code-kopieren').forEach(knopf => {
      knopf.addEventListener('click', async () => {
        const code = knopf.closest('.code-block').querySelector('code').textContent;
        try {
          await navigator.clipboard.writeText(code);
          knopf.textContent = 'Kopiert!';
          knopf.classList.add('fertig');
        } catch {
          knopf.textContent = 'Ging nicht';
        }
        setTimeout(() => { knopf.textContent = 'Kopieren'; knopf.classList.remove('fertig'); }, 1800);
      });
    });
  }

  window.addEventListener('DOMContentLoaded', () => {
    if ($('#liste')) uebersicht();
    if ($('#text'))  beitrag();
  });
})();
