/* mausemaus — Verwaltung.
   Die Vorschau nutzt denselben Renderer wie die öffentliche Seite (shared.js),
   deshalb ist sie garantiert identisch mit dem, was Besucher sehen. */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CFG = window.MM_CONFIG || {};
const { renderMarkdown, coverFromVideoUrl, slugify, esc } = window.mm;

if (!CFG.url || CFG.url.startsWith('HIER_')) {
  document.body.innerHTML = '<div class="login-wrap"><div class="login-box">'
    + '<h2 class="tropi" style="font-size:30px">Fast fertig</h2>'
    + '<p>In <code>assets/config.js</code> fehlt noch die Project URL aus dem '
    + 'Supabase-Dashboard (Settings → Data API).</p></div></div>';
  throw new Error('Konfiguration unvollständig');
}

const sb = createClient(CFG.url, CFG.key);
const $ = (s) => document.querySelector(s);

/* ---------- kleine Helfer ---------- */

let toastTimer;
function toast(text, schlecht = false) {
  const t = $('#toast');
  t.textContent = text; t.hidden = false;
  t.classList.toggle('schlecht', schlecht);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, schlecht ? 6000 : 2600);
}
const laden = (an) => { $('#ladebalken').hidden = !an; };

/* ---------- Anmeldung ---------- */

$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  laden(true); $('#login-fehler').hidden = true;
  const { error } = await sb.auth.signInWithPassword({
    email: $('#email').value.trim(), password: $('#pw').value });
  laden(false);
  if (error) {
    $('#login-fehler').textContent = 'Anmeldung fehlgeschlagen: ' + error.message;
    $('#login-fehler').hidden = false;
    return;
  }
  starten();
});

$('#btn-logout').addEventListener('click', async () => {
  await sb.auth.signOut();
  location.reload();
});

async function starten() {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return;
  $('#login').hidden = true;
  $('#app').hidden = false;
  $('#wer').textContent = user.email;
  wurzelReiter();
  await listeLaden();
}

/* ---------- Daten ---------- */

let PROJEKTE = [];
/* 'projects' = Kacheln der Startseite, 'posts' = eigenständige Seiten */
let ART = 'projects';
const istSeite = () => ART === 'posts';

async function listeLaden() {
  laden(true);
  const { data, error } = await sb.from(ART).select('*')
    .order(istSeite() ? 'published_at' : 'sort_order', { ascending: !istSeite() });
  laden(false);
  if (error) return toast('Laden fehlgeschlagen: ' + error.message, true);
  PROJEKTE = data;
  listeZeichnen();
}

function listeZeichnen() {
  const zeigeArchiv = $('#zeige-archiv').checked;
  const liste = PROJEKTE.filter(p => zeigeArchiv || p.status !== 'archived');
  $('#liste').innerHTML = liste.map(p => `
    <li class="zeile ${p.status === 'archived' ? 'archiviert' : ''}"
        draggable="${!istSeite()}" data-id="${p.id}">
      ${istSeite() ? '' : '<span class="griff" title="Zum Umsortieren ziehen">⠿</span>'}
      ${p.cover_url ? `<img class="zeile-bild" src="${p.cover_url}" alt=""
           style="object-position:${p.cover_pos || '50% 50%'}">`
        : '<div class="zeile-bild"></div>'}
      <div class="zeile-text">
        <div class="zeile-titel">${p.title || '(ohne Titel)'}</div>
        <div class="zeile-meta">
          <span class="marke ${p.status === 'published' ? 'veroeffentlicht'
            : p.status === 'archived' ? 'archiv' : 'entwurf'}">
            ${p.status === 'published' ? 'öffentlich' : p.status === 'archived' ? 'archiviert' : 'Entwurf'}
          </span>
          ${p.is_live ? '<span class="marke">läuft aktuell</span>' : ''}
          ${istSeite() && p.published_at ? p.published_at + ' · ' : ''}
          ${(p.tags || []).join(' · ')}
        </div>
        ${istSeite() ? `<div class="zeile-meta" style="text-transform:none;letter-spacing:0">
          /blog/${p.slug}</div>` : ''}
      </div>
      <button class="btn ghost" data-bearbeiten="${p.id}">Bearbeiten</button>
      <button class="btn ghost" data-archiv="${p.id}">
        ${p.status === 'archived' ? 'Zurückholen' : 'Archivieren'}</button>
    </li>`).join('') || '<p class="hinweis">Noch nichts angelegt.</p>';
}

$('#zeige-archiv').addEventListener('change', listeZeichnen);

$('#reiter').addEventListener('click', async (e) => {
  const b = e.target.closest('button'); if (!b || b.dataset.art === ART) return;
  ART = b.dataset.art;
  wurzelReiter();
  $('#view-edit').hidden = true;
  if (ART === 'settings') { $('#view-list').hidden = true; await einstellungenLaden(); }
  else { $('#view-settings').hidden = true; $('#view-list').hidden = false; await listeLaden(); }
});

function wurzelReiter() {
  document.querySelectorAll('#reiter button').forEach(x =>
    x.setAttribute('aria-pressed', x.dataset.art === ART));
  if (ART === 'settings') return;
  $('#listen-titel').textContent = istSeite() ? 'Seiten' : 'Projekte';
  $('#hinweis-sortieren').hidden = istSeite();
  $('#nur-projekt').hidden = istSeite();
  $('#nur-seite').hidden   = !istSeite();
  $('#bild-titel').textContent = istSeite() ? 'Titelbild' : 'Kachelbild';
}

$('#liste').addEventListener('click', async (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.bearbeiten) return oeffneEditor(PROJEKTE.find(p => p.id === b.dataset.bearbeiten));
  if (b.dataset.archiv) {
    const p = PROJEKTE.find(x => x.id === b.dataset.archiv);
    const neu = p.status === 'archived' ? 'draft' : 'archived';
    await speichereFelder(p.id, { status: neu });
    toast(neu === 'archived' ? 'Archiviert — bleibt erhalten.' : 'Zurückgeholt (als Entwurf).');
    await listeLaden();
  }
});

/* ---------- Umsortieren per Ziehen ---------- */

let gezogen = null;
$('#liste').addEventListener('dragstart', (e) => {
  gezogen = e.target.closest('.zeile');
  gezogen?.classList.add('wird-gezogen');
});
$('#liste').addEventListener('dragend', () => {
  gezogen?.classList.remove('wird-gezogen');
  document.querySelectorAll('.zeile.ziel').forEach(z => z.classList.remove('ziel'));
  gezogen = null;
});
$('#liste').addEventListener('dragover', (e) => {
  e.preventDefault();
  const ziel = e.target.closest('.zeile');
  if (!ziel || ziel === gezogen) return;
  document.querySelectorAll('.zeile.ziel').forEach(z => z.classList.remove('ziel'));
  ziel.classList.add('ziel');
});
$('#liste').addEventListener('drop', async (e) => {
  e.preventDefault();
  const ziel = e.target.closest('.zeile');
  if (!ziel || !gezogen || ziel === gezogen) return;
  const zeilen = [...$('#liste').children];
  const vonIdx = zeilen.indexOf(gezogen), nachIdx = zeilen.indexOf(ziel);
  ziel.parentNode.insertBefore(gezogen, vonIdx < nachIdx ? ziel.nextSibling : ziel);

  /* Neue Position = Mittelwert der Nachbarn. Dadurch muss nie alles neu nummeriert werden. */
  const jetzt = [...$('#liste').children].map(z => z.dataset.id);
  const idx = jetzt.indexOf(gezogen.dataset.id);
  const wert = (id) => PROJEKTE.find(p => p.id === id)?.sort_order ?? 0;
  const davor = idx > 0 ? wert(jetzt[idx - 1]) : null;
  const danach = idx < jetzt.length - 1 ? wert(jetzt[idx + 1]) : null;
  const neu = davor === null ? (danach ?? 1000) - 1
            : danach === null ? davor + 1
            : (davor + danach) / 2;
  await speichereFelder(gezogen.dataset.id, { sort_order: neu });
  toast('Reihenfolge gespeichert.');
  await listeLaden();
});

/* ---------- Editor ---------- */

let AKTUELL = null;

function leeresProjekt() {
  const max = Math.max(0, ...PROJEKTE.map(p => p.sort_order || 0));
  const gemeinsam = { id: null, slug: '', title: '', body: '',
    cover_url: null, cover_pos: '50% 50%', tags: [], status: 'draft', sort_order: max + 10 };
  return istSeite()
    ? { ...gemeinsam, subtitle: '', published_at: new Date().toISOString().slice(0, 10) }
    : { ...gemeinsam, role: '', summary: '', link_url: '', link_label: 'Ansehen',
        embed_ok: true, ig_handle: '', ig_followers: '', is_live: false, accent: 'sky' };
}

$('#btn-neu').addEventListener('click', () => oeffneEditor(leeresProjekt()));
$('#btn-zurueck').addEventListener('click', async () => {
  $('#view-edit').hidden = true; $('#view-list').hidden = false;
  await listeLaden();
});

function oeffneEditor(p) {
  AKTUELL = { ...p };
  $('#f-title').value = p.title || '';
  $('#f-role').value = p.role || '';
  $('#f-summary').value = p.summary || '';
  $('#f-tags').value = (p.tags || []).join(', ');
  $('#f-link').value = p.link_url || '';
  $('#f-linklabel').value = p.link_label || '';
  $('#f-more').value = p.more_url || '';
  $('#f-morelabel').value = p.more_label || '';
  $('#f-live').checked = !!p.is_live;
  $('#f-embed').checked = p.embed_ok !== false;
  $('#f-accent').value = p.accent || 'sky';
  $('#f-ig').value = p.ig_handle || '';
  $('#f-igf').value = p.ig_followers || '';
  $('#f-subtitle').value = p.subtitle || '';
  $('#f-datum').value = p.published_at || new Date().toISOString().slice(0, 10);
  $('#f-body').value = p.body || '';
  coverZeigen();
  vorschauZeichnen();
  $('#btn-archiv').textContent = p.status === 'archived' ? 'Zurückholen' : 'Archivieren';
  $('#speicher-status').textContent = p.id ? '' : 'neues Projekt';
  $('#view-list').hidden = true; $('#view-edit').hidden = false;
  $('#f-title').focus();
}

function ausFeldern() {
  /* Nur Spalten schicken, die es in der jeweiligen Tabelle auch gibt —
     sonst weist Postgres den ganzen Datensatz zurück. */
  const gemeinsam = {
    title: $('#f-title').value.trim(),
    body: $('#f-body').value,
    tags: $('#f-tags').value.split(',').map(s => s.trim()).filter(Boolean),
    cover_url: AKTUELL.cover_url,
    cover_pos: AKTUELL.cover_pos || '50% 50%',
    sort_order: AKTUELL.sort_order,
  };
  if (istSeite()) return {
    ...gemeinsam,
    subtitle: $('#f-subtitle').value.trim(),
    published_at: $('#f-datum').value || new Date().toISOString().slice(0, 10),
  };
  return {
    ...gemeinsam,
    role: $('#f-role').value.trim(),
    summary: $('#f-summary').value.trim(),
    link_url: $('#f-link').value.trim() || null,
    link_label: $('#f-linklabel').value.trim() || 'Ansehen',
    more_url: $('#f-more').value.trim() || null,
    more_label: $('#f-morelabel').value.trim() || 'Mehr dazu',
    is_live: $('#f-live').checked,
    embed_ok: $('#f-embed').checked,
    accent: $('#f-accent').value,
    ig_handle: $('#f-ig').value.trim() || null,
    ig_followers: $('#f-igf').value.trim() || null,
  };
}

function vorschauZeichnen() {
  $('#vorschau').innerHTML = renderMarkdown($('#f-body').value);
  $('#vorschau').querySelectorAll('figure').forEach(f => {
    f.title = 'Klicken: Größe umschalten (groß → mittel → klein)';
  });
}
$('#f-body').addEventListener('input', vorschauZeichnen);

/* Klick auf ein Bild in der Vorschau schaltet dessen Größe durch und
   schreibt die Änderung in den Text zurück — nichts zu merken. */
const REIHE = ['gross', 'mittel', 'klein'];
const BILD_ZEILE = /^!\[([^\]]*)\]\(([^)\s]+)\)(?:\{(klein|mittel|gross)\})?$/;

$('#vorschau').addEventListener('click', (e) => {
  const fig = e.target.closest('figure');
  if (!fig || fig.dataset.bild === undefined) return;
  const gesucht = Number(fig.dataset.bild);

  const zeilen = $('#f-body').value.split('\n');
  let nr = -1;
  for (let i = 0; i < zeilen.length; i++) {
    const t = zeilen[i].trim();
    const m = t.match(BILD_ZEILE);
    if (!m) continue;
    if (++nr !== gesucht) continue;

    const jetzt = m[3] || 'gross';
    const neuG = REIHE[(REIHE.indexOf(jetzt) + 1) % REIHE.length];
    zeilen[i] = `![${m[1]}](${m[2]})` + (neuG === 'gross' ? '' : `{${neuG}}`);
    $('#f-body').value = zeilen.join('\n');
    vorschauZeichnen();
    toast('Bildgröße: ' + { gross: 'groß', mittel: 'mittel', klein: 'klein' }[neuG]);
    return;
  }
});

/* Speichern */
async function speichern(status) {
  const felder = ausFeldern();
  if (!felder.title) return toast('Ein Titel fehlt noch.', true);
  if (status) felder.status = status;
  else if (!AKTUELL.id) felder.status = 'draft';

  laden(true);
  let fehler;
  if (AKTUELL.id) {
    ({ error: fehler } = await sb.from(ART).update(felder).eq('id', AKTUELL.id));
  } else {
    felder.slug = await freierSlug(slugify(felder.title));
    const { data, error } = await sb.from(ART).insert(felder).select().single();
    fehler = error;
    if (data) AKTUELL = data;
  }
  laden(false);
  if (fehler) return toast('Speichern fehlgeschlagen: ' + fehler.message, true);
  AKTUELL = { ...AKTUELL, ...felder };
  $('#speicher-status').textContent = 'gespeichert ' + new Date().toLocaleTimeString('de-DE');
  toast(status === 'published'
    ? (istSeite() ? `Veröffentlicht — /blog/${AKTUELL.slug}` : 'Veröffentlicht — ist jetzt online.')
    : 'Gespeichert.');
  return true;
}

async function freierSlug(basis) {
  let s = basis || 'projekt', n = 1;
  const { data } = await sb.from(ART).select('slug');
  const belegt = new Set((data || []).map(x => x.slug));
  while (belegt.has(s)) s = `${basis}-${++n}`;
  return s;
}

async function speichereFelder(id, felder) {
  const { error } = await sb.from(ART).update(felder).eq('id', id);
  if (error) toast('Fehler: ' + error.message, true);
}

$('#btn-speichern').addEventListener('click', () => speichern(null));
$('#btn-veroeffentlichen').addEventListener('click', () => speichern('published'));
$('#btn-archiv').addEventListener('click', async () => {
  if (!AKTUELL.id) return toast('Erst speichern.', true);
  const neu = AKTUELL.status === 'archived' ? 'draft' : 'archived';
  if (await speichern(neu)) { $('#view-edit').hidden = true; $('#view-list').hidden = false; listeLaden(); }
});
document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); if (!$('#view-edit').hidden) speichern(null); }
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); if (!$('#view-edit').hidden) linkFensterOeffnen(); }
  if (e.key === 'Escape' && !$('#link-fenster').hidden) linkFensterSchliessen();
});

/* ---------- Bilder: verkleinern, hochladen ---------- */

/* Verkleinert im Browser auf max. 1600px und wandelt in WebP.
   Dadurch darfst du den 4000px-Export reinziehen, ohne die Seite langsam zu machen. */
async function verkleinern(datei, maxKante = 1600, guete = 0.85) {
  const bild = await createImageBitmap(datei);
  const f = Math.min(1, maxKante / Math.max(bild.width, bild.height));
  const b = Math.round(bild.width * f), h = Math.round(bild.height * f);
  const cv = document.createElement('canvas');
  cv.width = b; cv.height = h;
  cv.getContext('2d').drawImage(bild, 0, 0, b, h);
  const blob = await new Promise(r => cv.toBlob(r, 'image/webp', guete));
  bild.close?.();
  return { blob, b, h };
}

async function hochladen(datei) {
  if (!datei.type.startsWith('image/')) { toast('Das ist kein Bild.', true); return null; }
  laden(true);
  try {
    /* Bewegte Bilder NICHT durch das Canvas schicken — dabei bliebe nur das
       erste Einzelbild übrig und die Animation wäre weg. */
    const bewegt = datei.type === 'image/gif' || datei.type === 'image/apng';
    let blob, endung, art, hinweis;

    if (bewegt) {
      blob = datei;
      endung = datei.type === 'image/gif' ? 'gif' : 'png';
      art = datei.type;
      const mb = datei.size / 1024 / 1024;
      hinweis = `GIF hochgeladen — ${Math.round(datei.size / 1024)} kB, Animation bleibt erhalten`;
      if (mb > 5) hinweis += ' · ziemlich groß, das lädt auf dem Handy langsam';
    } else {
      const k = await verkleinern(datei);
      blob = k.blob; endung = 'webp'; art = 'image/webp';
      hinweis = `Bild hochgeladen — ${k.b}×${k.h}, `
        + `${Math.round(datei.size / 1024)} kB → ${Math.round(k.blob.size / 1024)} kB`;
    }

    const name = `${Date.now()}-${slugify(datei.name.replace(/\.[^.]+$/, '')) || 'bild'}.${endung}`;
    const { error } = await sb.storage.from('media').upload(name, blob, {
      contentType: art, cacheControl: '31536000' });
    if (error) throw error;
    const { data } = sb.storage.from('media').getPublicUrl(name);
    toast(hinweis);
    return data.publicUrl;
  } catch (e) {
    toast('Upload fehlgeschlagen: ' + e.message, true);
    return null;
  } finally { laden(false); }
}

/* ---------- Kachelbild + Ausschnitt ---------- */

function coverZeigen() {
  const img = $('#cover-bild'), rahmen = $('#cover-rahmen');
  if (AKTUELL.cover_url) {
    img.src = AKTUELL.cover_url; img.style.display = '';
    $('#cover-leer').hidden = true;
  } else {
    img.removeAttribute('src'); img.style.display = 'none';
    $('#cover-leer').hidden = false;
  }
  rahmen.style.setProperty('--pos', AKTUELL.cover_pos || '50% 50%');
}

$('#btn-cover-datei').addEventListener('click', () => $('#cover-datei').click());
$('#cover-datei').addEventListener('change', async (e) => {
  const url = await hochladen(e.target.files[0]);
  if (url) { AKTUELL.cover_url = url; AKTUELL.cover_pos = '50% 50%'; coverZeigen(); }
  e.target.value = '';
});
$('#btn-cover-weg').addEventListener('click', () => { AKTUELL.cover_url = null; coverZeigen(); });
$('#btn-cover-youtube').addEventListener('click', () => {
  const url = coverFromVideoUrl($('#f-link').value);
  if (!url) return toast('Im Link-Feld steht kein YouTube-Link.', true);
  AKTUELL.cover_url = url; AKTUELL.cover_pos = '50% 50%'; coverZeigen();
  toast('Cover aus dem YouTube-Link geholt.');
});

/* Ziehen im Rahmen legt den sichtbaren Ausschnitt fest. */
(() => {
  const rahmen = $('#cover-rahmen');
  let zieht = false, startX, startY, startPos;
  const lese = () => (AKTUELL.cover_pos || '50% 50%').split(' ').map(v => parseFloat(v));

  rahmen.addEventListener('pointerdown', (e) => {
    if (!AKTUELL?.cover_url) return;
    zieht = true; startX = e.clientX; startY = e.clientY; startPos = lese();
    rahmen.classList.add('zieht'); rahmen.setPointerCapture(e.pointerId);
  });
  rahmen.addEventListener('pointermove', (e) => {
    if (!zieht) return;
    const r = rahmen.getBoundingClientRect();
    /* Ziehen nach rechts zeigt weiter links liegende Bildteile -> Vorzeichen umgekehrt */
    const x = Math.min(100, Math.max(0, startPos[0] - (e.clientX - startX) / r.width * 100));
    const y = Math.min(100, Math.max(0, startPos[1] - (e.clientY - startY) / r.height * 100));
    AKTUELL.cover_pos = `${Math.round(x)}% ${Math.round(y)}%`;
    rahmen.style.setProperty('--pos', AKTUELL.cover_pos);
  });
  const stop = () => { zieht = false; rahmen.classList.remove('zieht'); };
  rahmen.addEventListener('pointerup', stop);
  rahmen.addEventListener('pointercancel', stop);

  /* Bild direkt in den Rahmen ziehen */
  rahmen.addEventListener('dragover', (e) => { e.preventDefault(); rahmen.classList.add('ziel-aktiv'); });
  rahmen.addEventListener('dragleave', () => rahmen.classList.remove('ziel-aktiv'));
  rahmen.addEventListener('drop', async (e) => {
    e.preventDefault(); rahmen.classList.remove('ziel-aktiv');
    const url = await hochladen(e.dataTransfer.files[0]);
    if (url) { AKTUELL.cover_url = url; AKTUELL.cover_pos = '50% 50%'; coverZeigen(); }
  });
})();

/* ---------- Textfeld: Werkzeuge und Bilder ---------- */

function einfuegen(text) {
  const t = $('#f-body'), a = t.selectionStart, e = t.selectionEnd;
  t.value = t.value.slice(0, a) + text + t.value.slice(e);
  t.selectionStart = t.selectionEnd = a + text.length;
  t.focus(); vorschauZeichnen();
}

document.querySelectorAll('.werkzeugleiste button[data-md]').forEach(b => {
  b.addEventListener('click', () => {
    const md = b.dataset.md, t = $('#f-body');
    const markiert = t.value.slice(t.selectionStart, t.selectionEnd);
    if (md === '**' || md === '*') einfuegen(md + (markiert || 'Text') + md);
    else if (md === '---') einfuegen('\n\n---\n\n');
    else einfuegen((t.selectionStart && t.value[t.selectionStart - 1] !== '\n' ? '\n' : '') + md + markiert);
  });
});

/* ---------- Link einfügen ---------- */

const sieht_nach_adresse_aus = (t) => !!window.mm.linkZiel(String(t).trim());

function linkFensterOeffnen() {
  const t = $('#f-body');
  const markiert = t.value.slice(t.selectionStart, t.selectionEnd).trim();
  /* Ist eine Adresse markiert, gehört sie ins Adressfeld — sonst in den Text. */
  const istAdresse = markiert && !markiert.includes(' ') && sieht_nach_adresse_aus(markiert);
  $('#link-text').value = istAdresse ? '' : markiert;
  $('#link-url').value  = istAdresse ? markiert : '';
  $('#link-fenster').hidden = false;
  (istAdresse ? $('#link-text') : ($('#link-text').value ? $('#link-url') : $('#link-text'))).focus();
}

function linkFensterSchliessen() {
  $('#link-fenster').hidden = true;
  $('#f-body').focus();
}

$('#btn-link').addEventListener('click', linkFensterOeffnen);
$('#link-abbrechen').addEventListener('click', linkFensterSchliessen);
$('#link-fenster').addEventListener('click', (e) => {
  if (e.target.id === 'link-fenster') linkFensterSchliessen();
});

$('#link-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const text = $('#link-text').value.trim();
  const roh  = $('#link-url').value.trim();
  const ziel = window.mm.linkZiel(roh);
  if (!ziel) return toast('Das sieht nicht nach einer Adresse aus.', true);

  const t = $('#f-body');
  /* War Text markiert, wird er ersetzt — sonst an der Cursorstelle eingesetzt. */
  const a = t.selectionStart, e2 = t.selectionEnd;
  const einsatz = `[${text}](${ziel})`;
  t.value = t.value.slice(0, a) + einsatz + t.value.slice(e2);
  t.selectionStart = t.selectionEnd = a + einsatz.length;
  vorschauZeichnen();
  linkFensterSchliessen();
  toast('Link eingefügt.');
});

$('#btn-bild').addEventListener('click', () => $('#body-datei').click());
$('#body-datei').addEventListener('change', async (e) => {
  for (const d of e.target.files) {
    const url = await hochladen(d);
    if (url) einfuegen(`\n![](${url})\n`);
  }
  e.target.value = '';
});

const feld = $('#f-body');
feld.addEventListener('dragover', (e) => { e.preventDefault(); feld.classList.add('ziel-aktiv'); });
feld.addEventListener('dragleave', () => feld.classList.remove('ziel-aktiv'));
feld.addEventListener('drop', async (e) => {
  if (!e.dataTransfer.files.length) return;
  e.preventDefault(); feld.classList.remove('ziel-aktiv');
  for (const d of e.dataTransfer.files) {
    const url = await hochladen(d);
    if (url) einfuegen(`\n![](${url})\n`);
  }
});

/* ---------- Startseite: Einstellungen ---------- */

let EINST = null;

async function einstellungenLaden() {
  laden(true);
  const { data, error } = await sb.from('settings').select('*').eq('id', 1).single();
  laden(false);
  if (error) return toast('Laden fehlgeschlagen: ' + error.message, true);
  EINST = data;
  einstellungenZeichnen();
  $('#view-settings').hidden = false;
}

function einstellungenZeichnen() {
  const e = EINST;
  const setz = (id, wert) => { $(id).value = wert ?? ''; };
  setz('#s-eyebrow', e.hero_eyebrow); setz('#s-line1', e.hero_line1);
  setz('#s-line2', e.hero_line2);     setz('#s-intro', e.hero_intro);
  setz('#s-showreel', e.showreel_url);
  setz('#s-pkicker', e.profil_kicker); setz('#s-ptitel', e.profil_titel);
  setz('#s-ptext', e.profil_text);
  setz('#s-ktitel', e.kontakt_titel);  setz('#s-kzusatz', e.kontakt_zusatz);
  setz('#s-email', e.email);           setz('#s-telefon', e.telefon);
  setz('#s-kunden', (e.kunden || []).join(', '));
  infosZeichnen(); werkzeugeZeichnen(); portraetZeichnen();
}

/* Infozeile — vier Kästchen mit je zwei Zeilen */
function infosZeichnen() {
  $('#s-infos').innerHTML = (EINST.infos || []).map((i, n) => `
    <div class="set-zeile dreispaltig">
      <input data-inf="titel"  data-n="${n}" value="${esc(i.titel || '')}"  placeholder="Titel">
      <input data-inf="zeile1" data-n="${n}" value="${esc(i.zeile1 || '')}" placeholder="Zeile 1">
      <input data-inf="zeile2" data-n="${n}" value="${esc(i.zeile2 || '')}" placeholder="Zeile 2">
      <button class="set-weg" data-inf-weg="${n}" title="Entfernen">×</button>
    </div>
    <label class="set-punkt" style="margin:-3px 0 9px 4px">
      <input type="checkbox" data-inf="punkt" data-n="${n}" ${i.punkt ? 'checked' : ''}
        style="width:auto"> grüner Punkt davor</label>`).join('');
}

/* Werkzeugliste — Name und Stufe */
function werkzeugeZeichnen() {
  $('#s-werkzeuge').innerHTML = (EINST.werkzeuge || []).map((w, n) => `
    <div class="set-zeile">
      <input data-wz="name"  data-n="${n}" value="${esc(w.name || '')}"  placeholder="Name">
      <input data-wz="stufe" data-n="${n}" value="${esc(w.stufe || '')}" placeholder="Stufe">
      <button class="set-weg" data-wz-weg="${n}" title="Entfernen">×</button>
    </div>`).join('');
}

function portraetZeichnen() {
  const img = $('#p-bild');
  if (EINST.portrait_url) {
    img.src = EINST.portrait_url; img.style.display = ''; $('#p-leer').hidden = true;
  } else { img.removeAttribute('src'); img.style.display = 'none'; $('#p-leer').hidden = false; }
  $('#p-rahmen').style.setProperty('--pos', EINST.portrait_pos || '50% 50%');
}

/* Eingaben in den Listen übernehmen */
$('#view-settings').addEventListener('input', (e) => {
  const t = e.target;
  if (t.dataset.inf) {
    const i = EINST.infos[+t.dataset.n];
    i[t.dataset.inf] = t.type === 'checkbox' ? t.checked : t.value;
  }
  if (t.dataset.wz) EINST.werkzeuge[+t.dataset.n][t.dataset.wz] = t.value;
});

$('#view-settings').addEventListener('click', (e) => {
  const iw = e.target.closest('[data-inf-weg]');
  if (iw) { EINST.infos.splice(+iw.dataset.infWeg, 1); return infosZeichnen(); }
  const ww = e.target.closest('[data-wz-weg]');
  if (ww) { EINST.werkzeuge.splice(+ww.dataset.wzWeg, 1); return werkzeugeZeichnen(); }
});

$('#btn-info-neu').addEventListener('click', () => {
  (EINST.infos ||= []).push({ titel: '', zeile1: '', zeile2: '', punkt: false });
  infosZeichnen();
});
$('#btn-wz-neu').addEventListener('click', () => {
  (EINST.werkzeuge ||= []).push({ name: '', stufe: '' });
  werkzeugeZeichnen();
});

/* Porträt hochladen und Ausschnitt ziehen */
$('#btn-p-datei').addEventListener('click', () => $('#p-datei').click());
$('#p-datei').addEventListener('change', async (e) => {
  const url = await hochladen(e.target.files[0]);
  if (url) { EINST.portrait_url = url; EINST.portrait_pos = '50% 50%'; portraetZeichnen(); }
  e.target.value = '';
});
$('#btn-p-weg').addEventListener('click', () => { EINST.portrait_url = null; portraetZeichnen(); });

(() => {
  const rahmen = $('#p-rahmen');
  let zieht = false, startX, startY, startPos;
  rahmen.addEventListener('pointerdown', (e) => {
    if (!EINST?.portrait_url) return;
    zieht = true; startX = e.clientX; startY = e.clientY;
    startPos = (EINST.portrait_pos || '50% 50%').split(' ').map(v => parseFloat(v));
    rahmen.classList.add('zieht'); rahmen.setPointerCapture(e.pointerId);
  });
  rahmen.addEventListener('pointermove', (e) => {
    if (!zieht) return;
    const r = rahmen.getBoundingClientRect();
    const x = Math.min(100, Math.max(0, startPos[0] - (e.clientX - startX) / r.width * 100));
    const y = Math.min(100, Math.max(0, startPos[1] - (e.clientY - startY) / r.height * 100));
    EINST.portrait_pos = `${Math.round(x)}% ${Math.round(y)}%`;
    rahmen.style.setProperty('--pos', EINST.portrait_pos);
  });
  const stop = () => { zieht = false; rahmen.classList.remove('zieht'); };
  rahmen.addEventListener('pointerup', stop);
  rahmen.addEventListener('pointercancel', stop);
  rahmen.addEventListener('dragover', (ev) => { ev.preventDefault(); rahmen.classList.add('ziel-aktiv'); });
  rahmen.addEventListener('dragleave', () => rahmen.classList.remove('ziel-aktiv'));
  rahmen.addEventListener('drop', async (ev) => {
    ev.preventDefault(); rahmen.classList.remove('ziel-aktiv');
    const url = await hochladen(ev.dataTransfer.files[0]);
    if (url) { EINST.portrait_url = url; EINST.portrait_pos = '50% 50%'; portraetZeichnen(); }
  });
})();

$('#btn-set-speichern').addEventListener('click', async () => {
  const felder = {
    hero_eyebrow: $('#s-eyebrow').value.trim(),
    hero_line1:   $('#s-line1').value.trim(),
    hero_line2:   $('#s-line2').value.trim(),
    hero_intro:   $('#s-intro').value.trim(),
    showreel_url: $('#s-showreel').value.trim() || null,
    portrait_url: EINST.portrait_url,
    portrait_pos: EINST.portrait_pos || '50% 50%',
    profil_kicker: $('#s-pkicker').value.trim(),
    profil_titel:  $('#s-ptitel').value,
    profil_text:   $('#s-ptext').value.trim(),
    kontakt_titel: $('#s-ktitel').value,
    kontakt_zusatz: $('#s-kzusatz').value.trim(),
    email:   $('#s-email').value.trim(),
    telefon: $('#s-telefon').value.trim(),
    infos:   EINST.infos || [],
    kunden:  $('#s-kunden').value.split(',').map(s => s.trim()).filter(Boolean),
    werkzeuge: EINST.werkzeuge || [],
  };
  laden(true);
  const { error } = await sb.from('settings').update(felder).eq('id', 1);
  laden(false);
  if (error) return toast('Speichern fehlgeschlagen: ' + error.message, true);
  EINST = { ...EINST, ...felder };
  $('#set-status').textContent = 'gespeichert ' + new Date().toLocaleTimeString('de-DE');
  toast('Startseite gespeichert.');
});

/* ---------- Sicherung ---------- */

$('#btn-backup').addEventListener('click', async () => {
  const [pr, po, se] = await Promise.all([
    sb.from('projects').select('*').order('sort_order'),
    sb.from('posts').select('*').order('published_at'),
    sb.from('settings').select('*').eq('id', 1).single(),
  ]);
  if (pr.error || po.error) return toast('Fehler: ' + (pr.error || po.error).message, true);
  const alles = { projekte: pr.data, seiten: po.data, startseite: se.data,
                  stand: new Date().toISOString() };
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(alles, null, 2)], { type: 'application/json' }));
  a.download = `mausemaus-sicherung-${new Date().toISOString().slice(0, 10)}.json`;
  a.click(); URL.revokeObjectURL(a.href);
  toast(`Sicherung: ${pr.data.length} Projekte, ${po.data.length} Seiten.`);
});

/* ---------- Start ---------- */
sb.auth.getSession().then(({ data }) => { if (data.session) starten(); });
