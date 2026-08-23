/* mausemaus — Verwaltung.
   Arbeitet ausschließlich auf den Tabellen `seiten`/`bloecke` -- die alten
   Tabellen `projects`/`posts`/`settings` bleiben unangetastet (settings
   ausgenommen: die Startseiten-Einstellungen sind von diesem Umbau nicht
   betroffen und laufen unverändert weiter).
   Die Vorschau nutzt denselben Umsetzer wie die öffentliche Seite
   (bloecke.js + shared.js), deshalb ist sie garantiert identisch mit dem,
   was Besucher sehen. */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { erzeugeSpeicherWarteschlange, naechsteSortierung, vorlageBloecke } from '/assets/block-modell.js';
import { mountBlockEditor } from '/assets/blockeditor.js';
import { richteAnleitungEin } from '/assets/anleitung.js';

const CFG = window.MM_CONFIG || {};
const { coverFromVideoUrl, slugify, esc } = window.mm;

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

/* Anleitung: auf-/zuklappbar, merkt sich den Zustand über die Anmeldung
   hinweg. Unabhängig vom Login verdrahtet -- das Element existiert im DOM,
   auch wenn #app noch versteckt ist. */
richteAnleitungEin($('#anleitung-panel'));

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

/* ---------- Bilder: verkleinern, hochladen (unverändert erhalten) ---------- */

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
    return { url: data.publicUrl };
  } catch (e) {
    toast('Upload fehlgeschlagen: ' + e.message, true);
    return null;
  } finally { laden(false); }
}

/* ---------- Daten: Seiten (Projekte / Welten) ---------- */

let SEITEN = [];
/* 'projekt' = Abschnitte im Brief, 'welt' = eigene Türchen-Seiten */
let ART = 'projekt';
const istWelt = () => ART === 'welt';

async function listeLaden() {
  laden(true);
  const { data, error } = await sb.from('seiten').select('*')
    .eq('typ', ART).order('sort_order', { ascending: true });
  laden(false);
  if (error) return toast('Laden fehlgeschlagen: ' + error.message, true);
  SEITEN = data;
  listeZeichnen();
}

function listeZeichnen() {
  const zeigeArchiv = $('#zeige-archiv').checked;
  const liste = SEITEN.filter(p => zeigeArchiv || p.status !== 'archived');
  $('#liste').innerHTML = liste.map(p => `
    <li class="zeile ${p.status === 'archived' ? 'archiviert' : ''}" draggable="true" data-id="${p.id}">
      <span class="griff" title="Zum Umsortieren ziehen">⠿</span>
      ${p.cover_url ? `<img class="zeile-bild" src="${p.cover_url}" alt=""
           style="object-position:${p.cover_pos || '50% 50%'}">`
        : '<div class="zeile-bild"></div>'}
      <div class="zeile-text">
        <div class="zeile-titel">${p.titel || '(ohne Titel)'}</div>
        <div class="zeile-meta">
          <span class="marke ${p.status === 'published' ? 'veroeffentlicht'
            : p.status === 'archived' ? 'archiv' : 'entwurf'}">
            ${p.status === 'published' ? 'öffentlich' : p.status === 'archived' ? 'archiviert' : 'Entwurf'}
          </span>
          ${p.ist_aktuell ? '<span class="marke">läuft aktuell</span>' : ''}
        </div>
        ${istWelt() ? `<div class="zeile-meta" style="text-transform:none;letter-spacing:0">
          /welt/${p.slug}</div>` : ''}
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
  editorSchliessen({ zurZurListe: false });
  if (ART === 'settings') { $('#view-list').hidden = true; await einstellungenLaden(); }
  else { $('#view-settings').hidden = true; $('#view-list').hidden = false; await listeLaden(); }
});

function wurzelReiter() {
  document.querySelectorAll('#reiter button').forEach(x =>
    x.setAttribute('aria-pressed', x.dataset.art === ART));
  if (ART === 'settings') return;
  $('#listen-titel').textContent = istWelt() ? 'Welten' : 'Projekte';
}

$('#liste').addEventListener('click', async (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.bearbeiten) return oeffneEditor(SEITEN.find(p => p.id === b.dataset.bearbeiten));
  if (b.dataset.archiv) {
    const p = SEITEN.find(x => x.id === b.dataset.archiv);
    const neu = p.status === 'archived' ? 'draft' : 'archived';
    await seitenfeldSofortSpeichern(p.id, { status: neu });
    toast(neu === 'archived' ? 'Archiviert — bleibt erhalten.' : 'Zurückgeholt (als Entwurf).');
    await listeLaden();
  }
});

/* ---------- Umsortieren per Ziehen (Mittelwert der Nachbarn) ---------- */

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

  const jetzt = [...$('#liste').children].map(z => z.dataset.id);
  const idx = jetzt.indexOf(gezogen.dataset.id);
  const wert = (id) => SEITEN.find(p => p.id === id)?.sort_order ?? 0;
  const davor = idx > 0 ? wert(jetzt[idx - 1]) : null;
  const danach = idx < jetzt.length - 1 ? wert(jetzt[idx + 1]) : null;
  const neu = naechsteSortierung(davor, danach);
  await seitenfeldSofortSpeichern(gezogen.dataset.id, { sort_order: neu });
  toast('Reihenfolge gespeichert.');
  await listeLaden();
});

async function seitenfeldSofortSpeichern(id, felder) {
  const { error } = await sb.from('seiten').update(felder).eq('id', id);
  if (error) toast('Fehler: ' + error.message, true);
}

/* ---------- Editor: Seiten-Eigenschaften ---------- */

let AKTUELL = null;       // die gerade geöffnete Zeile aus `seiten`
let EDITOR = null;        // Rückgabe von mountBlockEditor()
let SEITEN_WARTESCHLANGE = null;

function leereSeite(typ) {
  const max = Math.max(0, ...SEITEN.filter(s => s.typ === typ).map(p => p.sort_order || 0));
  return {
    id: null, slug: '', typ, titel: '', untertitel: '', kunde: '', jahr: '',
    cover_url: null, cover_pos: '50% 50%', video_url: '', embed_ok: true, farbe: '',
    ist_aktuell: false, status: 'draft', sort_order: max + 10,
  };
}

/* Eine neue Seite entsteht SOFORT in der Datenbank (nicht erst beim
   "Speichern") -- Blöcke brauchen eine echte seite_id, um etwas anzulegen. */
$('#btn-neu').addEventListener('click', async () => {
  laden(true);
  const entwurf = leereSeite(ART);
  entwurf.slug = await freierSlug(slugify(entwurf.titel) || ART);
  const { data, error } = await sb.from('seiten').insert(entwurf).select().single();
  if (error) { laden(false); return toast('Anlegen fehlgeschlagen: ' + error.message, true); }
  SEITEN.push(data);

  /* Vorlage: passende Startblöcke gleich mit anlegen (siehe block-modell.js,
     vorlageBloecke) -- eine leere Seite wirkt sonst schnell einschüchternd.
     Schlägt das fehl, bleibt die Seite trotzdem nutzbar (nur ohne Vorlage) --
     kein Grund, das Anlegen selbst scheitern zu lassen. */
  const vorlage = vorlageBloecke(ART);
  if (vorlage.length) {
    const zeilen = vorlage.map((v, i) => ({
      seite_id: data.id, typ: v.typ, inhalt: v.inhalt,
      breite: 'normal', bewegung: 'keine', sort_order: (i + 1) * 10,
    }));
    const { error: vFehler } = await sb.from('bloecke').insert(zeilen);
    if (vFehler) toast('Vorlage konnte nicht angelegt werden: ' + vFehler.message, true);
  }
  laden(false);
  oeffneEditor(data);
});

$('#btn-zurueck').addEventListener('click', () => editorSchliessen({ zurZurListe: true }));

async function editorSchliessen({ zurZurListe }) {
  EDITOR?.zerstoeren();
  EDITOR = null;
  SEITEN_WARTESCHLANGE = null;
  $('#view-edit').hidden = true;
  if (zurZurListe) {
    if (ART === 'settings') { /* nichts zu tun, Einstellungen sind eigenständig */ }
    else { $('#view-list').hidden = false; await listeLaden(); }
  }
}

async function freierSlug(basis) {
  let s = basis || 'seite', n = 1;
  const { data } = await sb.from('seiten').select('slug');
  const belegt = new Set((data || []).map(x => x.slug));
  while (belegt.has(s)) s = `${basis}-${++n}`;
  return s;
}

function feldSichtbarkeit(typ) {
  $('#nur-projekt-welt').hidden = typ === 'brief';
  $('#nur-projekt').hidden = typ !== 'projekt';
  $('#nur-welt').hidden = typ !== 'welt';
  $('#mit-bild').hidden = typ === 'brief';
  $('#bild-titel').textContent = typ === 'welt' ? 'Titelbild' : 'Kachelbild im Brief';
}

async function oeffneEditor(seite) {
  await editorSchliessen({ zurZurListe: false });
  AKTUELL = { ...seite };
  feldSichtbarkeit(AKTUELL.typ);

  $('#f-titel').value = AKTUELL.titel || '';
  $('#f-untertitel').value = AKTUELL.untertitel || '';
  $('#f-video').value = AKTUELL.video_url || '';
  $('#f-embed').checked = AKTUELL.embed_ok !== false;
  $('#f-aktuell').checked = !!AKTUELL.ist_aktuell;
  $('#f-farbe').value = AKTUELL.farbe || '';
  $('#f-kunde').value = AKTUELL.kunde || '';
  $('#f-jahr').value = AKTUELL.jahr || '';
  coverZeigen();
  $('#btn-archiv').textContent = AKTUELL.status === 'archived' ? 'Zurückholen' : 'Archivieren';
  $('#btn-veroeffentlichen').textContent = AKTUELL.status === 'published' ? 'Ist veröffentlicht' : 'Veröffentlichen';

  $('#view-list').hidden = true; $('#view-settings').hidden = true; $('#view-edit').hidden = false;
  $('#speicher-status').textContent = '';
  $('#f-titel').focus();

  /* Seiten-eigene Felder speichern über dieselbe sichere Warteschlange wie
     die Blöcke -- zwei schnelle Änderungen (z.B. Titel tippen und im
     selben Moment die Videoadresse einfügen) können sich so nicht
     gegenseitig überschreiben. Meldet sich an derselben "gespeichert"-
     Anzeige wie der Blockeditor, damit eine Änderung an den Seiten-Feldern
     genauso sichtbar gespeichert wird wie eine Änderung an einem Block. */
  SEITEN_WARTESCHLANGE = erzeugeSpeicherWarteschlange(async (felder) => {
    $('#speicher-status').textContent = 'speichert…';
    const { error } = await sb.from('seiten').update(felder).eq('id', AKTUELL.id);
    if (error) return toast('Speichern fehlgeschlagen: ' + error.message, true);
    $('#speicher-status').textContent = 'gespeichert ' + new Date().toLocaleTimeString('de-DE');
  });

  const { data: bloecke, error } = await sb.from('bloecke').select('*')
    .eq('seite_id', AKTUELL.id).order('sort_order');
  if (error) { toast('Blöcke konnten nicht geladen werden: ' + error.message, true); return; }

  EDITOR = mountBlockEditor(document.getElementById('block-editor'), {
    seiteId: AKTUELL.id,
    anfangsBloecke: bloecke,
    vorschauEl: document.getElementById('vorschau'),
    statusEl: document.getElementById('speicher-status'),
    api: {
      async neu(entwurf) {
        const { data, error } = await sb.from('bloecke').insert(entwurf).select().single();
        if (error) throw error;
        return data;
      },
      async aktualisieren(id, felder) {
        const { error } = await sb.from('bloecke').update(felder).eq('id', id);
        if (error) throw error;
      },
      async loeschen(id) {
        const { error } = await sb.from('bloecke').delete().eq('id', id);
        if (error) throw error;
      },
      bildHochladen: hochladen,
    },
  });
}

function seiteSpeichernAnstossen() {
  SEITEN_WARTESCHLANGE?.anstossen({
    titel: AKTUELL.titel, untertitel: AKTUELL.untertitel, kunde: AKTUELL.kunde || null,
    jahr: AKTUELL.jahr || null, cover_url: AKTUELL.cover_url, cover_pos: AKTUELL.cover_pos,
    video_url: AKTUELL.video_url || null, embed_ok: AKTUELL.embed_ok, farbe: AKTUELL.farbe || null,
    ist_aktuell: AKTUELL.ist_aktuell, status: AKTUELL.status, sort_order: AKTUELL.sort_order,
  });
}
let seitenEntprellung;
function seiteFeldGeaendert(patch, { sofort = false } = {}) {
  Object.assign(AKTUELL, patch);
  if (sofort) { clearTimeout(seitenEntprellung); seiteSpeichernAnstossen(); return; }
  /* Wie beim Blockeditor entprellt: die Warteschlange wäre auch ohne das
     korrekt, aber ohne Entprellung würde bei jedem Tastendruck ein Aufruf
     losgeschickt und die "gespeichert"-Anzeige würde flackern. */
  clearTimeout(seitenEntprellung);
  seitenEntprellung = setTimeout(seiteSpeichernAnstossen, 500);
}

$('#f-titel').addEventListener('input', (e) => seiteFeldGeaendert({ titel: e.target.value }));
$('#f-untertitel').addEventListener('input', (e) => seiteFeldGeaendert({ untertitel: e.target.value }));
$('#f-video').addEventListener('input', (e) => seiteFeldGeaendert({ video_url: e.target.value }));
$('#f-embed').addEventListener('change', (e) => seiteFeldGeaendert({ embed_ok: e.target.checked }, { sofort: true }));
$('#f-aktuell').addEventListener('change', (e) => seiteFeldGeaendert({ ist_aktuell: e.target.checked }, { sofort: true }));
$('#f-farbe').addEventListener('input', (e) => seiteFeldGeaendert({ farbe: e.target.value }));
$('#f-kunde').addEventListener('input', (e) => seiteFeldGeaendert({ kunde: e.target.value }));
$('#f-jahr').addEventListener('input', (e) => seiteFeldGeaendert({ jahr: e.target.value }));

$('#btn-veroeffentlichen').addEventListener('click', () => {
  if (AKTUELL.status === 'published') return;
  seiteFeldGeaendert({ status: 'published' }, { sofort: true });
  $('#btn-veroeffentlichen').textContent = 'Ist veröffentlicht';
  toast('Veröffentlicht — ist jetzt online.');
});
$('#btn-archiv').addEventListener('click', async () => {
  const neu = AKTUELL.status === 'archived' ? 'draft' : 'archived';
  seiteFeldGeaendert({ status: neu }, { sofort: true });
  $('#btn-archiv').textContent = neu === 'archived' ? 'Zurückholen' : 'Archivieren';
  toast(neu === 'archived' ? 'Archiviert — bleibt erhalten.' : 'Zurückgeholt (als Entwurf).');
});

document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 's') {
    e.preventDefault();
    if (!$('#view-edit').hidden) toast('Wird laufend automatisch gespeichert.');
  }
});

/* ---------- Der Brief: eine einzelne, feste Seite ---------- */

$('#btn-brief').addEventListener('click', async () => {
  laden(true);
  const { data, error } = await sb.from('seiten').select('*').eq('typ', 'brief').eq('slug', 'brief').single();
  laden(false);
  if (error) return toast('Der Brief konnte nicht geladen werden: ' + error.message, true);
  $('#view-list').hidden = true; $('#view-settings').hidden = true;
  oeffneEditor(data);
});

/* ---------- Kachel-/Titelbild + Ausschnitt ---------- */

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
  const r = await hochladen(e.target.files[0]);
  if (r) { seiteFeldGeaendert({ cover_url: r.url, cover_pos: '50% 50%' }, { sofort: true }); coverZeigen(); }
  e.target.value = '';
});
$('#btn-cover-weg').addEventListener('click', () => { seiteFeldGeaendert({ cover_url: null }, { sofort: true }); coverZeigen(); });
$('#btn-cover-youtube').addEventListener('click', () => {
  const url = coverFromVideoUrl($('#f-video').value);
  if (!url) return toast('Im Adressfeld steht kein YouTube-Link.', true);
  seiteFeldGeaendert({ cover_url: url, cover_pos: '50% 50%' }, { sofort: true }); coverZeigen();
  toast('Titelbild aus dem YouTube-Link geholt.');
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
    const x = Math.min(100, Math.max(0, startPos[0] - (e.clientX - startX) / r.width * 100));
    const y = Math.min(100, Math.max(0, startPos[1] - (e.clientY - startY) / r.height * 100));
    seiteFeldGeaendert({ cover_pos: `${Math.round(x)}% ${Math.round(y)}%` });
    rahmen.style.setProperty('--pos', AKTUELL.cover_pos);
  });
  const stop = () => { zieht = false; rahmen.classList.remove('zieht'); };
  rahmen.addEventListener('pointerup', stop);
  rahmen.addEventListener('pointercancel', stop);

  rahmen.addEventListener('dragover', (e) => { e.preventDefault(); rahmen.classList.add('ziel-aktiv'); });
  rahmen.addEventListener('dragleave', () => rahmen.classList.remove('ziel-aktiv'));
  rahmen.addEventListener('drop', async (e) => {
    e.preventDefault(); rahmen.classList.remove('ziel-aktiv');
    const r = await hochladen(e.dataTransfer.files[0]);
    if (r) { seiteFeldGeaendert({ cover_url: r.url, cover_pos: '50% 50%' }, { sofort: true }); coverZeigen(); }
  });
})();

/* ---------- Startseite: Einstellungen (unverändert -- betrifft `settings`) ---------- */

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

$('#btn-p-datei').addEventListener('click', () => $('#p-datei').click());
$('#p-datei').addEventListener('change', async (e) => {
  const r = await hochladen(e.target.files[0]);
  if (r) { EINST.portrait_url = r.url; EINST.portrait_pos = '50% 50%'; portraetZeichnen(); }
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
    const r = await hochladen(ev.dataTransfer.files[0]);
    if (r) { EINST.portrait_url = r.url; EINST.portrait_pos = '50% 50%'; portraetZeichnen(); }
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

/* ---------- Sicherung: alle Tabellen ---------- */

$('#btn-backup').addEventListener('click', async () => {
  laden(true);
  const [pr, po, se, sei] = await Promise.all([
    sb.from('projects').select('*').order('sort_order'),
    sb.from('posts').select('*').order('published_at'),
    sb.from('settings').select('*').eq('id', 1).single(),
    sb.from('seiten').select('*,bloecke(*)').order('typ').order('sort_order'),
  ]);
  laden(false);
  const fehler = pr.error || po.error || sei.error;
  if (fehler) return toast('Fehler: ' + fehler.message, true);
  const alles = {
    projekte_alt: pr.data, seiten_alt: po.data, startseite: se.data,
    seiten: sei.data, stand: new Date().toISOString(),
  };
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(alles, null, 2)], { type: 'application/json' }));
  a.download = `mausemaus-sicherung-${new Date().toISOString().slice(0, 10)}.json`;
  a.click(); URL.revokeObjectURL(a.href);
  toast(`Sicherung: ${sei.data.length} Seiten mit Blöcken, ${pr.data.length} alte Projekte.`);
});

/* ---------- Start ---------- */
sb.auth.getSession().then(({ data }) => { if (data.session) starten(); });
