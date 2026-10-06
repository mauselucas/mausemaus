/* mausemaus — Emotes im Admin.

   Zwei Teile:
     1. Die Bibliothek (Knopf "Emotes" oben): Dateien hineinziehen, der Name
        kommt aus dem Dateinamen ("PepeLaugh-2x.avif" -> PepeLaugh), umbenennen,
        löschen. Die Dateien gehen UNVERÄNDERT in den Speicher -- jede
        Umrechnung über eine Leinwand würde Bewegung und Durchsichtigkeit
        zerstören, und 64-px-Emotes sind ohnehin winzig.
     2. Vorschläge beim Schreiben: In jedem Textfeld des Editors öffnet
        ":" plus ein paar Buchstaben eine Liste passender Emotes. Pfeiltasten
        wählen, Enter/Tab oder Klick setzt ":Name:" ein.

   Auf der Seite macht shared.js (emotesEinsetzen) daraus ein Bild in der
   Zeile. window.mmEmotes ist dieselbe Karte, die auch db.js befüllt --
   darum stimmt die Vorschau im Editor mit der Seite überein. */

const GUELTIG = /^[A-Za-z0-9_]{2,40}$/;

export function nameAusDatei(dateiname) {
  return String(dateiname)
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[-_ ]?(?:[1-4]x)$/i, '')
    .replace(/[^A-Za-z0-9_]/g, '')
    .slice(0, 40);
}

async function masseVonDatei(datei) {
  try {
    const bm = await createImageBitmap(datei);
    const m = { breite: bm.width, hoehe: bm.height }; bm.close?.(); return m;
  } catch {
    /* Manche Formate kann createImageBitmap nicht -- dann über ein <img>. */
    return new Promise((fertig) => {
      const img = new Image();
      img.onload = () => { fertig({ breite: img.naturalWidth, hoehe: img.naturalHeight }); URL.revokeObjectURL(img.src); };
      img.onerror = () => fertig({ breite: null, hoehe: null });
      img.src = URL.createObjectURL(datei);
    });
  }
}

export function richteEmotesEin({ sb, toast, laden, esc }) {
  let liste = [];

  const karteSetzen = () => {
    const k = {};
    for (const e of liste) k[e.name] = { url: e.url, breite: e.breite, hoehe: e.hoehe };
    window.mmEmotes = k;
  };

  async function holen() {
    const { data, error } = await sb.from('emotes').select('id,name,url,breite,hoehe').order('name');
    if (error) { toast('Emotes nicht lesbar: ' + error.message, true); return; }
    liste = data || []; karteSetzen(); zeichnen();
  }

  /* ---------- 1. Die Bibliothek ---------- */
  const dlg = document.createElement('dialog');
  dlg.className = 'emote-dialog';
  dlg.setAttribute('aria-labelledby', 'emote-titel');
  dlg.innerHTML = `
    <div class="emote-kopf">
      <h2 id="emote-titel">Emotes</h2>
      <button type="button" class="btn ghost" data-zu aria-label="Schließen">✕</button>
    </div>
    <p class="hinweis">Im Text <b>:Name:</b> schreiben, z. B. <code>:PepeLaugh:</code> — oder einfach <b>:</b> tippen, dann kommen Vorschläge.
      Groß-/Kleinschreibung zählt. Bewegte und durchsichtige Emotes (AVIF, GIF, WebP, PNG) bleiben, wie sie sind.</p>
    <label class="emote-ablage">
      <input type="file" accept="image/*" multiple hidden>
      <span>Emote-Dateien hierher ziehen oder <u>auswählen</u></span>
    </label>
    <ul class="emote-liste"></ul>`;
  document.body.appendChild(dlg);
  const ul = dlg.querySelector('.emote-liste');
  const eingabe = dlg.querySelector('input[type=file]');
  const ablage = dlg.querySelector('.emote-ablage');

  function zeichnen() {
    ul.innerHTML = liste.map(e => `
      <li data-id="${esc(e.id)}">
        <img src="${esc(e.url)}" alt="" width="${+e.breite || 64}" height="${+e.hoehe || 64}">
        <input value="${esc(e.name)}" aria-label="Name des Emotes" spellcheck="false">
        <button type="button" class="btn ghost" data-weg title="Löschen">×</button>
      </li>`).join('') || '<li class="emote-leer">Noch keine Emotes.</li>';
  }

  async function hinzufuegen(dateien) {
    laden(true);
    let gut = 0;
    try {
      for (const datei of dateien) {
        if (!/^image\//.test(datei.type || '')) { toast(datei.name + ': kein Bild', true); continue; }
        const name = nameAusDatei(datei.name);
        if (!GUELTIG.test(name)) { toast(`${datei.name}: daraus wird kein gültiger Name`, true); continue; }
        if (liste.some(e => e.name === name)) { toast(`:${name}: gibt es schon`, true); continue; }
        const { breite, hoehe } = await masseVonDatei(datei);
        const endung = (datei.name.match(/\.([a-z0-9]+)$/i) || [, 'avif'])[1].toLowerCase();
        const pfad = `emotes/${Date.now()}-${name}${breite && hoehe ? `-${breite}x${hoehe}` : ''}.${endung}`;
        const hoch = await sb.storage.from('media').upload(pfad, datei, { contentType: datei.type, cacheControl: '31536000' });
        if (hoch.error) { toast('Upload fehlgeschlagen: ' + hoch.error.message, true); continue; }
        const url = sb.storage.from('media').getPublicUrl(pfad).data.publicUrl;
        const { error } = await sb.from('emotes').insert({ name, url, breite, hoehe });
        if (error) { toast(`:${name}: ` + error.message, true); continue; }
        gut++;
      }
    } finally { laden(false); }
    await holen();
    if (gut) toast(gut === 1 ? 'Emote hinzugefügt' : `${gut} Emotes hinzugefügt`);
  }

  eingabe.addEventListener('change', () => { const d = [...eingabe.files]; eingabe.value = ''; hinzufuegen(d); });
  ablage.addEventListener('dragover', (e) => { e.preventDefault(); ablage.classList.add('drueber'); });
  ablage.addEventListener('dragleave', () => ablage.classList.remove('drueber'));
  ablage.addEventListener('drop', (e) => {
    e.preventDefault(); ablage.classList.remove('drueber');
    hinzufuegen([...e.dataTransfer.files]);
  });

  ul.addEventListener('change', async (e) => {
    const li = e.target.closest('li[data-id]'); if (!li || e.target.tagName !== 'INPUT') return;
    const alt = liste.find(x => x.id === li.dataset.id);
    const neu = e.target.value.trim();
    if (!GUELTIG.test(neu)) { toast('Name: 2–40 Zeichen, nur Buchstaben, Ziffern und _', true); e.target.value = alt.name; return; }
    if (neu === alt.name) return;
    const { error } = await sb.from('emotes').update({ name: neu }).eq('id', alt.id);
    if (error) { toast(/duplicate|unique/i.test(error.message) ? `:${neu}: gibt es schon` : error.message, true); e.target.value = alt.name; return; }
    toast(`Umbenannt: :${alt.name}: → :${neu}: — im Text steht weiterhin der alte Name, bitte dort anpassen.`);
    await holen();
  });

  ul.addEventListener('click', async (e) => {
    const knopf = e.target.closest('[data-weg]'); if (!knopf) return;
    const e1 = liste.find(x => x.id === knopf.closest('li').dataset.id);
    if (!confirm(`:${e1.name}: löschen? Wo es im Text steht, bleibt dann nur das Wort stehen.`)) return;
    const { error } = await sb.from('emotes').delete().eq('id', e1.id);
    if (error) { toast(error.message, true); return; }
    /* Die Datei im Speicher mit aufräumen -- nur, wenn sie dort liegt
       (die ersten sechs liegen im Projektordner unter /emotes/). */
    const m = String(e1.url).match(/\/storage\/v1\/object\/public\/media\/(.+)$/);
    if (m) await sb.storage.from('media').remove([decodeURIComponent(m[1])]);
    await holen();
  });

  dlg.querySelector('[data-zu]').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });

  const knopf = document.createElement('button');
  knopf.className = 'btn ghost'; knopf.id = 'btn-emotes'; knopf.type = 'button';
  knopf.textContent = 'Emotes';
  knopf.title = 'Kleine Bilder wie im Twitch-Chat, im Text als :Name:';
  knopf.addEventListener('click', () => dlg.showModal());
  const ort = document.getElementById('btn-backup');
  if (ort) ort.before(knopf);

  /* ---------- 2. Vorschläge beim Schreiben ---------- */
  const box = document.createElement('ul');
  box.className = 'emote-vorschlaege';
  box.setAttribute('role', 'listbox');
  box.hidden = true;
  document.body.appendChild(box);
  let feld = null, treffer = [], wahl = 0, anfang = 0;

  const zu = () => { box.hidden = true; feld = null; treffer = []; };

  /* Pixelposition der Schreibmarke in einem <textarea>: ein unsichtbarer
     Zwilling mit gleicher Schrift und Breite, in dem der Text bis zur
     Marke steht. */
  function markenPunkt(ta, pos) {
    const cs = getComputedStyle(ta);
    const z = document.createElement('div');
    for (const p of ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'paddingTop',
      'paddingLeft', 'paddingRight', 'borderTopWidth', 'borderLeftWidth', 'boxSizing', 'tabSize', 'wordSpacing']) z.style[p] = cs[p];
    Object.assign(z.style, { position: 'absolute', visibility: 'hidden', whiteSpace: 'pre-wrap',
      overflowWrap: 'break-word', width: ta.offsetWidth + 'px', top: '0', left: '-9999px' });
    z.textContent = ta.value.slice(0, pos);
    const m = document.createElement('span'); m.textContent = '​'; z.appendChild(m);
    document.body.appendChild(z);
    const r = ta.getBoundingClientRect();
    const punkt = { x: r.left + m.offsetLeft - ta.scrollLeft, y: r.top + m.offsetTop - ta.scrollTop + m.offsetHeight };
    z.remove();
    return punkt;
  }

  function zeigen() {
    box.innerHTML = treffer.map((e, i) => `
      <li role="option" data-i="${i}" aria-selected="${i === wahl}">
        <img src="${esc(e.url)}" alt="" width="28" height="28"><span>:${esc(e.name)}:</span>
      </li>`).join('');
    const p = markenPunkt(feld, feld.selectionStart);
    box.style.left = Math.min(p.x, innerWidth - 240) + 'px';
    box.style.top = (p.y + 4) + 'px';
    box.hidden = false;
  }

  function einsetzen(e) {
    const ta = feld, ende = ta.selectionStart;
    const rest = ta.value.slice(ende);
    const luecke = /^\s/.test(rest) ? '' : ' ';
    ta.value = ta.value.slice(0, anfang) + ':' + e.name + ':' + luecke + rest;
    const pos = anfang + e.name.length + 2 + luecke.length;
    ta.setSelectionRange(pos, pos);
    zu();
    /* Ein echtes input-Ereignis: daran hängen Speichern und Vorschau. */
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    ta.focus();
  }

  document.addEventListener('input', (ev) => {
    const ta = ev.target;
    if (!(ta instanceof HTMLTextAreaElement) || !ta.closest('#app') || !liste.length) return;
    const vor = ta.value.slice(0, ta.selectionStart);
    const m = vor.match(/(^|[\s(>*_])(:([A-Za-z0-9_]{1,40}))$/);
    if (!m) { if (feld === ta) zu(); return; }
    const such = m[3].toLowerCase();
    treffer = liste.filter(e => e.name.toLowerCase().startsWith(such))
      .concat(liste.filter(e => !e.name.toLowerCase().startsWith(such) && e.name.toLowerCase().includes(such)))
      .slice(0, 8);
    if (!treffer.length) { zu(); return; }
    feld = ta; wahl = 0; anfang = ta.selectionStart - m[2].length;
    zeigen();
  });

  /* Abfangen in der Einfangphase und nur, solange die Liste offen ist --
     sonst würde Enter dem Editor nie mehr eine neue Zeile geben. */
  document.addEventListener('keydown', (ev) => {
    if (box.hidden || ev.target !== feld) return;
    if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
      wahl = (wahl + (ev.key === 'ArrowDown' ? 1 : -1) + treffer.length) % treffer.length; zeigen();
    } else if (ev.key === 'Enter' || ev.key === 'Tab') {
      einsetzen(treffer[wahl]);
    } else if (ev.key === 'Escape') {
      zu();
    } else return;
    ev.preventDefault(); ev.stopImmediatePropagation();
  }, true);

  box.addEventListener('mousedown', (ev) => {
    const li = ev.target.closest('li[data-i]'); if (!li) return;
    ev.preventDefault(); einsetzen(treffer[+li.dataset.i]);
  });
  document.addEventListener('focusout', (ev) => { if (ev.target === feld) setTimeout(() => { if (document.activeElement !== feld) zu(); }, 0); });
  document.addEventListener('scroll', () => { if (!box.hidden) zu(); }, true);

  return { holen, oeffnen: () => dlg.showModal() };
}
