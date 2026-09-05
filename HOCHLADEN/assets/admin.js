/* mausemaus — Verwaltung.
   Arbeitet ausschließlich auf den Tabellen `seiten`/`bloecke` -- die alten
   Tabellen `projects`/`posts`/`settings` bleiben unangetastet stehen (siehe
   Sicherung weiter unten, die sie mit sichert), werden aber von hier aus
   NICHT mehr bearbeitet: der frühere "Startseite"-Reiter ist entfernt, weil
   er eine Tabelle beschrieb, die keine ausgelieferte Seite mehr liest --
   Begrüßung, Profil und Kontakt kommen inzwischen aus den `abschnitt`-
   Blöcken des Briefs (Knopf "Startseite (Brief)" oben rechts).
   Die Vorschau nutzt denselben Umsetzer wie die öffentliche Seite
   (bloecke.js + shared.js), deshalb ist sie garantiert identisch mit dem,
   was Besucher sehen. */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  erzeugeSpeicherWarteschlange, naechsteSortierung, vorlageBloecke,
  naechsterFreierSlug, ersterFehler, erzeugeEntprellung, leerSeitenEntwurf,
  darfDurchsCanvas, endungFuerMime, endungUndArtFuerBlob,
} from '/assets/block-modell.js';
import { mountBlockEditor } from '/assets/blockeditor.js';
import { mountUebersetzung } from '/assets/uebersetzen.js';
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

/* Die Hoehe der oberen Kopfzeile laufend messen und als CSS-Variable
   bereitstellen. Die Editor-Kopfzeile klebt daran fest -- ohne das kleben
   beide bei 0 und schieben sich beim Scrollen ineinander. Gemessen statt
   fest eingetragen, weil die obere Leiste auf schmalen Fenstern umbricht
   und dann fast doppelt so hoch ist. */
(() => {
  const oben = document.querySelector('.admin-top');
  if (!oben) return;
  const setzen = () => document.documentElement.style
    .setProperty('--kopf-hoehe', Math.round(oben.getBoundingClientRect().height) + 'px');
  setzen();
  new ResizeObserver(setzen).observe(oben);
})();

/* ---------- Anmeldung ---------- */

$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  /* Knopf sperren, solange die Anfrage läuft -- sonst schickt ein
     ungeduldiger Doppelklick zwei Anmeldeversuche gleichzeitig los. */
  const knopf = $('#login-form button[type="submit"]');
  knopf.disabled = true;
  laden(true); $('#login-fehler').hidden = true;
  try {
    const { error } = await sb.auth.signInWithPassword({
      email: $('#email').value.trim(), password: $('#pw').value });
    if (error) {
      $('#login-fehler').textContent = 'Anmeldung fehlgeschlagen: ' + error.message;
      $('#login-fehler').hidden = false;
      return;
    }
    starten();
  } finally {
    laden(false);
    knopf.disabled = false;
  }
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
  /* datei fehlt oder ist gar keine Datei (z.B. markierter Text übers
     Coverfeld gezogen) -- ohne diese Prüfung wirft `.type` ungefangen,
     denn sie steht VOR jedem try-Block. */
  if (!datei || !datei.type || !datei.type.startsWith('image/')) {
    toast('Das ist kein Bild.', true); return null;
  }
  laden(true);
  try {
    /* Bewegte Bilder NICHT durch das Canvas schicken — dabei bliebe nur das
       erste Einzelbild übrig und die Animation wäre weg. darfDurchsCanvas()
       ist eine POSITIVLISTE ("garantiert immer ein Einzelbild") statt einer
       Liste bekannter bewegter Formate -- eine animierte WebP zum Beispiel
       wäre einer Negativliste, die nur GIF/APNG kennt, unbemerkt
       durchgerutscht. */
    const bewegt = !darfDurchsCanvas(datei.type);
    let blob, endung, art, hinweis, breite = 0, hoehe = 0;

    if (bewegt) {
      blob = datei;
      endung = endungFuerMime(datei.type, 'bild');
      art = datei.type;
      /* Auch beim unveraenderten Bild die Maße lesen -- sie kommen unten in
         den Dateinamen. Bewusst in einem try: ein Format, das der Browser
         nicht als Bitmap oeffnen kann, darf den Upload NICHT scheitern
         lassen. Ohne Maße wird die Datei einfach ohne sie benannt. */
      try {
        const bm = await createImageBitmap(datei);
        breite = bm.width; hoehe = bm.height; bm.close?.();
      } catch {}
      const mb = datei.size / 1024 / 1024;
      hinweis = `Bild hochgeladen — ${Math.round(datei.size / 1024)} kB, unverändert `
        + `(Animation/Originalqualität bleibt erhalten)`;
      if (mb > 5) hinweis += ' · ziemlich groß, das lädt auf dem Handy langsam';
    } else {
      const k = await verkleinern(datei);
      /* Der wirklich gelieferte Blob-Typ entscheidet, NICHT der angeforderte:
         Safari kann laut Spezifikation kein WebP aus dem Canvas schreiben und
         liefert dann still ein PNG -- ohne diese Prüfung läge ein PNG mit der
         Endung .webp und der Typangabe image/webp im Speicher. */
      ({ endung, art } = endungUndArtFuerBlob(k.blob.type));
      blob = k.blob;
      breite = k.b; hoehe = k.h;
      hinweis = `Bild hochgeladen — ${k.b}×${k.h}, `
        + `${Math.round(datei.size / 1024)} kB → ${Math.round(k.blob.size / 1024)} kB`
        + (art !== 'image/webp' ? ` (als ${endung.toUpperCase()} — WebP hat der Browser hier nicht geschrieben)` : '');
    }

    /* Die Maße wandern in den DATEINAMEN (…-1600x900.webp).

       Warum dorthin und nicht in die Bild-Zeile: Ein Bild ohne width/height
       hat fuer den Browser bis zum Laden die Hoehe 0 -- der Text darunter
       springt beim Erscheinen nach unten, und die Zeitleiste muss sich neu
       vermessen. Die Maße gehoeren also ins HTML. Sie zusaetzlich in der
       Auszeichnungssprache unterzubringen hiesse, sie an zwei Stellen zu
       pflegen und eine dritte Klammer einzufuehren; im Dateinamen stehen
       sie ohne jede Syntaxaenderung dort, wo die Adresse ohnehin hinkommt,
       und shared.js liest sie beim Anzeigen einfach heraus.

       Bestehende Bilder tragen die Maße nicht -- fuer die bleibt alles wie
       bisher. Das ist Absicht: nichts an vorhandenen Inhalten anfassen. */
    const masse = breite && hoehe ? `-${breite}x${hoehe}` : '';
    const name = `${Date.now()}-${slugify(datei.name.replace(/\.[^.]+$/, '')) || 'bild'}${masse}.${endung}`;
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
      ${p.cover_url ? `<img class="zeile-bild" src="${esc(p.cover_url)}" alt="" loading="lazy"
           style="object-position:${esc(p.cover_pos || '50% 50%')}">`
        : '<div class="zeile-bild"></div>'}
      <div class="zeile-text">
        <div class="zeile-titel">${esc(p.titel) || '(ohne Titel)'}</div>
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
  await editorSchliessen({ zurZurListe: false });
  $('#view-list').hidden = false;
  await listeLaden();
});

function wurzelReiter() {
  document.querySelectorAll('#reiter button').forEach(x =>
    x.setAttribute('aria-pressed', x.dataset.art === ART));
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
let UEBERSETZUNG = null;   // Rückgabe von mountUebersetzung(), oder null

/* Der Entwurf fuer die Datenbank -- OHNE `id`, damit die Spalte ihren
   eigenen Vorgabewert erzeugen kann (siehe leerSeitenEntwurf). */
function leereSeite(typ) {
  return leerSeitenEntwurf(typ, SEITEN.filter(s => s.typ === typ).map(p => p.sort_order || 0));
}

/* Eine neue Seite entsteht SOFORT in der Datenbank (nicht erst beim
   "Speichern") -- Blöcke brauchen eine echte seite_id, um etwas anzulegen. */
$('#btn-neu').addEventListener('click', async () => {
  laden(true);
  const entwurf = leereSeite(ART);
  /* KEIN Rückfall auf ART: sonst bekäme die allererste Welt ohne Titel die
     Kennung "welt" -- also /welt/welt. freierSlug() fällt bei leerem Titel
     selbst auf "seite" zurück. */
  entwurf.slug = await freierSlug(slugify(entwurf.titel));
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
  /* Eine noch nicht geschriebene Änderung an den Seiten-Feldern (Titel,
     Video-Adresse, …) darf beim Schließen nicht verlorengehen: der
     Entprellungs-Zeitgeber wartet noch bis zu 500 ms nach dem letzten
     Tastendruck. seitenEntprellung.sofort() kappt ihn UND löst eine
     wartende Änderung sofort aus -- einen danach feuernden Zeitgeber (der
     möglicherweise auf eine inzwischen andere geöffnete Seite zeigen
     würde) gibt es dadurch gar nicht mehr. Erst wenn die Warteschlange den
     ausgelösten Schreibvorgang wirklich abgeschlossen hat, wird der Editor
     -- und mit ihm die Warteschlange -- zerstört. */
  seitenEntprellung.sofort();
  /* Dieselbe Falle gilt für die BLÖCKE: auch dort wartet nach dem letzten
     Tastendruck ein Entprellungs-Zeitgeber. zerstoeren() hätte ihn früher
     einfach gekappt -- der zuletzt getippte Satz war damit weg. flush()
     schreibt Ausstehendes stattdessen sofort raus. */
  EDITOR?.flush();
  while (SEITEN_WARTESCHLANGE?.beschaeftigt() || EDITOR?.beschaeftigt())
    await new Promise(r => setTimeout(r, 30));

  EDITOR?.zerstoeren();
  EDITOR = null;
  SEITEN_WARTESCHLANGE = null;
  await uebersetzungSchliessen();
  panelsSchliessen();
  $('#view-edit').hidden = true;
  if (zurZurListe) { $('#view-list').hidden = false; await listeLaden(); }
}

async function freierSlug(basis) {
  const { data } = await sb.from('seiten').select('slug');
  return naechsterFreierSlug(basis, (data || []).map(x => x.slug));
}

function feldSichtbarkeit(typ) {
  $('#nur-projekt-welt').hidden = typ === 'brief';
  /* Beim Brief wird der Seitentitel NIRGENDS auf der Seite gezeigt -- die
     grosse Begruessung kommt aus dem ersten abschnitt-Block. Ohne diesen
     Hinweis steht "Hallo ich bin" zweimal untereinander und man sucht den
     Unterschied. */
  $('#titel-hinweis').hidden = typ !== 'brief';
  $('#nur-projekt').hidden = typ !== 'projekt';
  /* Die Farbstimmung gilt fuer Welt UND Projekt: bei der Welt faerbt sie die
     Seite, beim Projekt den Abschnitt der Zeitleiste im Brief (brief.js liest
     seiten.farbe). Nur der Brief selbst hat keine eigene Farbe. */
  $('#nur-farbe').hidden = typ === 'brief';
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

  $('#view-list').hidden = true; $('#view-edit').hidden = false;
  $('#speicher-status').textContent = '';
  $('#f-titel').focus();

  /* Seiten-eigene Felder speichern über dieselbe sichere Warteschlange wie
     die Blöcke -- zwei schnelle Änderungen (z.B. Titel tippen und im
     selben Moment die Videoadresse einfügen) können sich so nicht
     gegenseitig überschreiben. Meldet sich an derselben "gespeichert"-
     Anzeige wie der Blockeditor, damit eine Änderung an den Seiten-Feldern
     genauso sichtbar gespeichert wird wie eine Änderung an einem Block.
     Die Anzeige selbst beschreibt NICHT diese Funktion, sondern der
     Blockeditor -- er ist der einzige Ort, der "speichert…", "gespeichert"
     und "nicht gespeichert" kennt. Sonst überschreibt die eine Quelle die
     Meldung der anderen und ein Fehlerhinweis verschwindet sofort wieder. */
  SEITEN_WARTESCHLANGE = erzeugeSpeicherWarteschlange(async (felder) => {
    EDITOR?.fremdSpeichertStart();
    const { error } = await sb.from('seiten').update(felder).eq('id', AKTUELL.id);
    if (error) {
      EDITOR?.fremdSpeichertEnde(error);
      /* Werfen, damit die Warteschlange den Stand FESTHÄLT statt ihn
         wegzuwerfen -- wiederholen() kann ihn dann erneut losschicken. */
      throw error;
    }
    EDITOR?.fremdSpeichertEnde(null);
  }, (fehler) => {
    toast('Nicht gespeichert: ' + (fehler?.message || fehler)
      + ' — oben auf „nicht gespeichert“ klicken, um es erneut zu versuchen.', true);
  });

  const { data: bloecke, error } = await sb.from('bloecke').select('*')
    .eq('seite_id', AKTUELL.id).order('sort_order');
  if (error) { toast('Blöcke konnten nicht geladen werden: ' + error.message, true); return; }

  EDITOR = mountBlockEditor(document.getElementById('block-editor'), {
    seiteId: AKTUELL.id,
    anfangsBloecke: bloecke,
    statusEl: document.getElementById('speicher-status'),
    /* Ein Klick auf "nicht gespeichert" soll BEIDE Warteschlangen erneut
       losschicken -- die der Blöcke UND die der Seiten-Felder. */
    fremdWiederholen: () => !!SEITEN_WARTESCHLANGE?.wiederholen(),
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

  /* Nur zur Information im ⚙-Panel: unter welcher Adresse liegt diese Welt? */
  const slugZeile = $('#dok-slug');
  slugZeile.hidden = AKTUELL.typ !== 'welt';
  slugZeile.textContent = 'Adresse dieser Welt: /welt/' + (AKTUELL.slug || '—');
}

/* ---------- Die englische Fassung ----------
   Sie ersetzt im selben Bereich das Dokument. Kein zweiter Modus im
   Blockeditor -- warum, steht in assets/uebersetzen.js. */

async function uebersetzungSchliessen() {
  if (!UEBERSETZUNG) return;
  /* Noch nicht geschriebene Aenderungen abwarten, wie beim Blockeditor
     auch -- sonst ginge der zuletzt getippte Satz beim Schliessen weg. */
  while (UEBERSETZUNG.beschaeftigt()) await new Promise(r => setTimeout(r, 30));
  UEBERSETZUNG = null;
  $('#speicher-status').onclick = null;
  $('#view-uebersetzen').hidden = true;
  $('#view-uebersetzen').innerHTML = '';
  $('#dokument').hidden = false;
  document.querySelector('.dok-bereich').classList.remove('breit');
  $('#btn-uebersetzen').classList.remove('an');
}

$('#btn-uebersetzen').addEventListener('click', async () => {
  if (UEBERSETZUNG) { await uebersetzungSchliessen(); return; }
  if (!AKTUELL) return;
  panelsSchliessen();

  /* Frisch aus der Datenbank lesen statt den Stand des Blockeditors zu
     benutzen: Der haelt `inhalt_en` gar nicht -- er kennt die Spalte nicht
     und soll sie auch nicht kennen. */
  const { data: bloecke, error } = await sb.from('bloecke')
    .select('id,typ,inhalt,inhalt_en,sort_order').eq('seite_id', AKTUELL.id).order('sort_order');
  if (error) { toast('Blöcke konnten nicht geladen werden: ' + error.message, true); return; }

  $('#dokument').hidden = true;
  $('#view-uebersetzen').hidden = false;
  /* Nebeneinander braucht Platz: die Dokumentspalte ist auf 768 px
     ausgelegt, deutsch UND englisch nebeneinander passen da nicht hinein. */
  document.querySelector('.dok-bereich').classList.add('breit');
  $('#btn-uebersetzen').classList.add('an');

  const status = $('#speicher-status');
  UEBERSETZUNG = mountUebersetzung($('#view-uebersetzen'), {
    sb, seite: AKTUELL, bloecke,
    statusMelden(art, fehler) {
      if (art === 'speichert') { status.classList.remove('status-fehler'); status.textContent = 'speichert…'; }
      else if (art === 'gespeichert') {
        status.classList.remove('status-fehler');
        status.textContent = 'gespeichert ' + new Date().toLocaleTimeString('de-DE');
      } else {
        status.classList.add('status-fehler');
        status.textContent = 'nicht gespeichert — klicken zum Wiederholen';
        toast('Nicht gespeichert: ' + (fehler?.message || fehler), true);
      }
    },
  });
  UEBERSETZUNG.beiFertig(() => uebersetzungSchliessen());

  /* Ein Klick auf "nicht gespeichert" schickt auch hier den letzten Stand
     erneut los -- genau wie im Blockeditor. onclick statt addEventListener:
     so haengt bei jedem Oeffnen genau EIN Handler dran, nicht ein weiterer. */
  status.onclick = () => {
    if (UEBERSETZUNG && status.classList.contains('status-fehler')) UEBERSETZUNG.alleWiederholen();
  };
});

/* ---------- Die beiden Panels (⚙ Einstellungen, ? Hilfe) ----------
   Sie liegen über dem Dokument und sind immer nur auf Zuruf da -- die
   Schreibfläche soll nichts umrahmen. */

function panelsSchliessen() {
  document.querySelectorAll('.seiten-panel').forEach(p => {
    p.classList.remove('offen'); p.setAttribute('aria-hidden', 'true');
  });
  $('#btn-einstellungen')?.setAttribute('aria-expanded', 'false');
  $('#btn-anleitung')?.setAttribute('aria-expanded', 'false');
  $('#seiten-menue')?.removeAttribute('open');
}

function panelUmschalten(panel, knopf) {
  const wirdOffen = !panel.classList.contains('offen');
  panelsSchliessen();
  if (!wirdOffen) return;
  panel.classList.add('offen');
  panel.setAttribute('aria-hidden', 'false');
  knopf.setAttribute('aria-expanded', 'true');
  /* Das <details> im Hilfe-Panel hat keine sichtbare Zusammenfassung mehr
     (das Panel IST die auf-/zuklappbare Ebene). Wäre es aus einer früheren
     Sitzung heraus zugeklappt gemerkt, ließe es sich nie wieder öffnen und
     die Hilfe bliebe für immer leer -- deshalb hier erzwingen. */
  if (panel.id === 'panel-anleitung') {
    const d = $('#anleitung-panel');
    if (d) d.open = true;
  }
}

$('#btn-einstellungen').addEventListener('click',
  () => panelUmschalten($('#panel-einstellungen'), $('#btn-einstellungen')));
$('#btn-anleitung').addEventListener('click',
  () => panelUmschalten($('#panel-anleitung'), $('#btn-anleitung')));
document.querySelectorAll('.seiten-panel .panel-zu')
  .forEach(btn => btn.addEventListener('click', panelsSchliessen));

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') panelsSchliessen();
});

/* Rückgängig: ⇧⌘Z bzw. Strg+Umschalt+Z. Das nackte ⌘Z bleibt bewusst das
   gewohnte Rückgängig INNERHALB eines Textfelds -- dem darf man nichts
   wegnehmen, sonst verliert man beim Tippen die vertraute Taste. */
document.addEventListener('keydown', (e) => {
  if (!(e.metaKey || e.ctrlKey) || !e.shiftKey) return;
  if (e.key.toLowerCase() !== 'z') return;
  if ($('#view-edit').hidden || !EDITOR) return;
  e.preventDefault();
  toast(EDITOR.rueckgaengig() ? 'Rückgängig gemacht.' : 'Nichts mehr rückgängig zu machen.');
});
$('#btn-rueckgaengig').addEventListener('click', () => {
  $('#seiten-menue')?.removeAttribute('open');
  if (!EDITOR) return;
  toast(EDITOR.rueckgaengig() ? 'Rückgängig gemacht.' : 'Nichts mehr rückgängig zu machen.');
});

/* Nicht mitten in einem Schreibvorgang wegklicken lassen. */
window.addEventListener('beforeunload', (e) => {
  if ($('#view-edit').hidden) return;
  if (seitenEntprellung.ausstehend() || EDITOR?.beschaeftigt() || EDITOR?.hatFehler()) {
    e.preventDefault(); e.returnValue = '';
  }
});

function seiteSpeichernAnstossen() {
  SEITEN_WARTESCHLANGE?.anstossen({
    titel: AKTUELL.titel, untertitel: AKTUELL.untertitel, kunde: AKTUELL.kunde || null,
    jahr: AKTUELL.jahr || null, cover_url: AKTUELL.cover_url, cover_pos: AKTUELL.cover_pos,
    video_url: AKTUELL.video_url || null, embed_ok: AKTUELL.embed_ok, farbe: AKTUELL.farbe || null,
    ist_aktuell: AKTUELL.ist_aktuell, status: AKTUELL.status, sort_order: AKTUELL.sort_order,
  });
}
/* erzeugeEntprellung() statt eines rohen setTimeout: die weiß, OB gerade
   eine Änderung aussteht -- das macht editorSchliessen() weiter unten
   möglich (sofort() beim Schließen), ohne das eine ausstehende Änderung
   dabei verlorengeht (siehe block-modell.js). */
const seitenEntprellung = erzeugeEntprellung(seiteSpeichernAnstossen, 500);
function seiteFeldGeaendert(patch, { sofort = false } = {}) {
  Object.assign(AKTUELL, patch);
  if (sofort) { seitenEntprellung.verwerfen(); seiteSpeichernAnstossen(); return; }
  /* Wie beim Blockeditor entprellt: die Warteschlange wäre auch ohne das
     korrekt, aber ohne Entprellung würde bei jedem Tastendruck ein Aufruf
     losgeschickt und die "gespeichert"-Anzeige würde flackern. */
  seitenEntprellung.anstossen();
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
  $('#view-list').hidden = true;
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


/* ---------- Sicherung: alle Tabellen ---------- */

$('#btn-backup').addEventListener('click', async () => {
  laden(true);
  const [pr, po, se, sei] = await Promise.all([
    sb.from('projects').select('*').order('sort_order'),
    sb.from('posts').select('*').order('published_at'),
    /* .maybeSingle() statt .single(): fehlt die settings-Zeile ganz (0
       statt 1 Treffer), liefert .single() einen Fehler -- und die Sicherung
       bräche komplett ab, obwohl projects/posts/seiten längst geladen sind.
       .maybeSingle() liefert in diesem Fall einfach `data: null`. */
    sb.from('settings').select('*').eq('id', 1).maybeSingle(),
    sb.from('seiten').select('*,bloecke(*)').order('typ').order('sort_order'),
  ]);
  laden(false);
  /* ersterFehler() statt einer von Hand aufgezählten Kette: die vergisst
     bei vier Abfragen leicht eine (hier fehlte bisher se.error) -- eine
     Sicherung, die dann still unvollständig bleibt, ist schlimmer als gar
     keine, weil man sich auf sie verlässt. */
  const fehler = ersterFehler(pr, po, se, sei);
  if (fehler) return toast('Fehler: ' + fehler.message, true);
  const alles = {
    projekte_alt: pr.data, seiten_alt: po.data, startseite: se.data,
    seiten: sei.data, stand: new Date().toISOString(),
    hinweis: 'Enthält nur Datenbank-Inhalte. Hochgeladene Bilder liegen separat '
      + 'im Supabase-Storage-Bucket "media" und sind NICHT Teil dieser Datei.',
  };
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(alles, null, 2)], { type: 'application/json' }));
  a.download = `mausemaus-sicherung-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  /* Nicht sofort widerrufen: manche Browser starten den Download erst
     asynchron nach click(), ein sofortiges revokeObjectURL() kann ihn dann
     abbrechen. Kurz warten, dann aufräumen. */
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast(`Sicherung: ${sei.data.length} Seiten mit Blöcken, ${pr.data.length} alte Projekte. `
    + `Enthält nur die Datenbank — hochgeladene Bilder sind NICHT mit dabei.`);
});

/* ---------- Start ---------- */
sb.auth.getSession().then(({ data }) => { if (data.session) starten(); });
