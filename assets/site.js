/* mausemaus — öffentliche Seite: Kachelraster, Filter, Detail-Fenster */

(() => {
const { renderMarkdown, esc, videoEmbed } = window.mm;

/* Holt die Projekte aus Supabase — mit Zwischenspeicher und Notfall-Daten,
   siehe assets/db.js */
const loadProjects = window.mmLoadProjects;

const $ = (sel) => document.querySelector(sel);
let PROJECTS = [];

/* ---------- Kachel ---------- */

const IG_GLYPH = `<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="5.5"/>`
  + `<circle cx="12" cy="12" r="4.2"/>`
  + `<circle cx="17.3" cy="6.7" r="0.9" style="fill:var(--ink);stroke:none"/></svg>`;

const LIVE = '<span class="live"><span class="pulse"></span> Läuft aktuell</span>';

function coverHTML(p, big) {
  /* Instagram-Projekte bekommen das Profilpanel statt eines Coverbilds */
  if (p.ig_handle) {
    return `
      <img class="thumb-blur" src="${esc(p.blur_url || p.cover_url || '')}" alt="">
      <div class="ig-card">
        <div class="ig-ring">
          <div class="ig-pic" style="background-image:url('${esc(p.cover_url)}')"></div>
          <div class="ig-badge">${IG_GLYPH}</div>
        </div>
        <div class="ig-handle">@${esc(p.ig_handle)}</div>
        ${p.ig_followers ? `<div class="ig-stats">${esc(p.ig_followers)}</div>` : ''}
      </div>`;
  }

  const hasVideo = videoEmbed(p.link_url || '');
  /* Im Fenster wird der Play-Knopf zum Link, wenn das Video nicht eingebettet werden darf */
  const play = hasVideo
    ? (big
        ? (p.embed_ok === false
            ? `<a class="play play-link" href="${esc(p.link_url)}" target="_blank" rel="noopener"
                 aria-label="Auf YouTube ansehen"></a>`
            : '')
        : '<div class="play"></div>')
    : '';
  /* cover_pos steuert, welcher Bildausschnitt im Rahmen sichtbar ist */
  const img = p.cover_url
    ? `<img src="${esc(p.cover_url)}" alt="" loading="lazy"
         style="--pos:${esc(p.cover_pos || '50% 50%')}">` : '';
  return `${img}${play}`;
}




/* ---------- Detail-Fenster ---------- */

function panelHTML(p) {
  /* embed_ok === false: der Rechteinhaber sperrt das Einbetten (z.B. Joyn).
     Dann zeigen wir das Cover mit Play-Knopf, der zu YouTube führt. */
  const embed = p.embed_ok === false ? null : videoEmbed(p.link_url || '');
  const top = embed
    ? `<div class="panel-cover"><iframe src="${esc(embed.src)}" allowfullscreen loading="lazy"
         allow="accelerometer; clipboard-write; encrypted-media; picture-in-picture"
         referrerpolicy="strict-origin-when-cross-origin" title="${esc(p.title)}"
         style="width:100%;height:100%;border:0"></iframe></div>`
    : `<div class="panel-cover ${esc(p.accent || 'sky')}${p.ig_handle ? ' is-ig' : ''}">${coverHTML(p, true)}</div>`;

  /* Der Haupt-Videolink wird oben im Fenster behandelt — nicht nochmal im Text.
     Andere Videos im Text (z.B. Making-of) bleiben erhalten. */
  const main = p.link_url ? String(p.link_url).trim() : null;
  const body = main
    ? String(p.body || '').split('\n').filter(l => l.trim() !== main).join('\n').trim()
    : (p.body || '');

  return `<button class="close" aria-label="Schließen">&times;</button>
    <div class="panel-scroll">
    ${top}
    <div class="panel-head">
      ${p.is_live ? LIVE + '<div style="height:12px"></div>' : ''}
      <div class="panel-role">${esc(p.role || '')}</div>
      <h2 class="panel-title tropi">${esc(p.title)}</h2>
      ${(p.tags || []).length
        ? `<div class="tags">${p.tags.map(t => `<span class="pill">${esc(t)}</span>`).join('')}</div>` : ''}
    </div>
    <div class="panel-body">
      <div class="prose">${renderMarkdown(body)}</div>
      <div class="panel-knoepfe">
        ${p.more_url ? `<a class="panel-link" href="${esc(p.more_url)}">
          ${esc(p.more_label || 'Mehr dazu')} <span aria-hidden="true">→</span></a>` : ''}
        ${p.link_url ? `<a class="panel-link${p.more_url ? ' zweitrangig' : ''}"
          href="${esc(p.link_url)}" target="_blank" rel="noopener">
          ${esc(p.link_label || 'Ansehen')} <span aria-hidden="true">↗</span></a>` : ''}
      </div>
    </div>
    </div>`;
}

let lastFocus = null;

/* Blendet den Verlauf am unteren Fensterrand ein, solange noch Inhalt folgt. */
function markScrollable() {
  const panel = $('#panel'), sc = panel.querySelector('.panel-scroll');
  if (!sc) return;
  const update = () => panel.classList.toggle(
    'has-more', sc.scrollHeight - sc.scrollTop - sc.clientHeight > 24);
  update();
  sc.addEventListener('scroll', update, { passive: true });
  new ResizeObserver(update).observe(sc);
}

function openProject(slug, tile) {
  const p = PROJECTS.find(x => x.slug === slug);
  if (!p) return;
  lastFocus = tile || document.activeElement;

  const apply = () => {
    $('#panel').innerHTML = panelHTML(p);
    $('#overlay').classList.add('is-open');
    document.body.style.overflow = 'hidden';
    if (location.hash !== '#projekt/' + slug) history.pushState({ slug }, '', '#projekt/' + slug);
    $('#panel').querySelector('.close').focus();
    markScrollable();
  };

  /* Kachel wächst zum Fenster — sonst einfaches Einblenden */
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (document.startViewTransition && tile && !reduce) {
    tile.style.viewTransitionName = 'tile';
    const t = document.startViewTransition(() => {
      tile.style.viewTransitionName = '';
      $('#panel').style.viewTransitionName = 'tile';
      apply();
    });
    t.finished.finally(() => { $('#panel').style.viewTransitionName = ''; });
  } else apply();
}

function closeProject(back = true) {
  const ov = $('#overlay');
  if (!ov.classList.contains('is-open')) return;
  const slug = location.hash.replace('#projekt/', '');
  const tile = $(`.pzeile[data-slug="${CSS.escape(slug)}"]`);

  const apply = () => {
    ov.classList.remove('is-open');
    $('#panel').innerHTML = '';           /* stoppt laufende Videos */
    document.body.style.overflow = '';
  };

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (document.startViewTransition && tile && !reduce) {
    $('#panel').style.viewTransitionName = 'tile';
    const t = document.startViewTransition(() => {
      $('#panel').style.viewTransitionName = '';
      tile.style.viewTransitionName = 'tile';
      apply();
    });
    t.finished.finally(() => { tile.style.viewTransitionName = ''; });
  } else apply();

  if (back && location.hash.startsWith('#projekt/')) history.pushState({}, '', location.pathname);
  (lastFocus || tile)?.focus?.();
}

function syncFromHash() {
  const m = location.hash.match(/^#projekt\/(.+)$/);
  if (m) { if (!$('#overlay').classList.contains('is-open')) openProject(decodeURIComponent(m[1]), $(`.pzeile[data-slug="${CSS.escape(m[1])}"]`)); }
  else closeProject(false);
}

/* ---------- Start ---------- */

async function init() {
  PROJECTS = await loadProjects();
  /* Aufbau der Startseite liegt in start.js — hier bleibt nur das Detail-Fenster. */
  await window.mmStartseite(PROJECTS);

  $('#zeilen').addEventListener('click', (e) => {
    const zeile = e.target.closest('.pzeile');
    if (zeile) openProject(zeile.dataset.slug, zeile);
  });

  $('#overlay').addEventListener('click', (e) => {
    if (e.target.closest('.close') || e.target.classList.contains('overlay-bg')) closeProject();
  });

  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeProject(); });
  window.addEventListener('popstate', syncFromHash);

  syncFromHash();
}

init();
})();
