/* mausemaus — der Blockeditor selbst (DOM + Speichern).
   Reine Logik steckt in block-modell.js und ist dort für sich getestet;
   diese Datei bringt sie aufs Bildschirm. Erwartet, dass shared.js und
   bloecke.js bereits als <script> geladen sind (window.mm, window.mmBloecke)
   -- die Vorschau nutzt bewusst genau diesen Weg, nicht einen eigenen.

   Absichtlich UNABHÄNGIG von Supabase: alles, was das Netzwerk betrifft,
   kommt über das injizierte `api`-Objekt herein. Dadurch lässt sich der
   Editor in einer Testseite (tests/feste/blockeditor-probe.html) mit einem
   Fake-Speicher prüfen, ganz ohne Anmeldung -- siehe tests/pruefe-editor.mjs. */
import {
  BLOCKARTEN, BLOCKARTEN_NACH_TYP, BREITEN, BEWEGUNGEN, leererInhalt, slashTreffer,
  naechsteSortierung, umschliesseAuswahl, linkEinfuegen, tuerEinfuegen,
  bildZeilenLesen, bildZeilenBauen, textMitBildLesen, textMitBildBauen,
  ueberschriftLesen, ueberschriftBauen, codeLesen, codeBauen, werkzeugLesen, werkzeugBauen,
  erzeugeUndoStapel, erzeugeSpeicherWarteschlange,
} from '/assets/block-modell.js';

const esc = (s) => (window.mm ? window.mm.esc(s) : String(s ?? ''));
const neuerSchluessel = () => (crypto.randomUUID ? crypto.randomUUID()
  : 'k-' + Date.now() + '-' + Math.random().toString(36).slice(2));

export function mountBlockEditor(wurzel, { seiteId, anfangsBloecke, api, vorschauEl, statusEl }) {
  /* ---------- Zustand ---------- */
  const zustand = {
    bloecke: (anfangsBloecke || []).slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(b => ({ clientKey: neuerSchluessel(), ...b })),
    slash: null,        // { clientKey } wenn das Blockauswahl-Menü offen ist
    auswahlLeiste: null, // { clientKey } wenn die Format-Leiste offen ist
  };
  const warteschlangen = new Map();  // clientKey -> Speicher-Warteschlange
  const undo = erzeugeUndoStapel(30);
  let aktiveSchreibvorgaenge = 0;

  /* ---------- "gespeichert"-Anzeige ---------- */
  function statusAktualisieren() {
    if (!statusEl) return;
    statusEl.textContent = aktiveSchreibvorgaenge > 0
      ? 'speichert…'
      : 'gespeichert ' + new Date().toLocaleTimeString('de-DE');
  }
  function mitStatus(fn) {
    return async (...args) => {
      aktiveSchreibvorgaenge++; statusAktualisieren();
      try { return await fn(...args); }
      finally { aktiveSchreibvorgaenge--; statusAktualisieren(); }
    };
  }

  /* ---------- Speichern eines einzelnen Blocks ---------- */
  function basisEntwurf(b) {
    return { seite_id: seiteId, typ: b.typ, inhalt: b.inhalt, breite: b.breite,
      bewegung: b.bewegung, notiz: b.notiz || null, sort_order: b.sort_order };
  }

  function warteschlangeFuer(b) {
    if (warteschlangen.has(b.clientKey)) return warteschlangen.get(b.clientKey);
    const schreiben = mitStatus(async (daten) => {
      if (daten && daten.__geloescht) {
        if (b.id) await api.loeschen(b.id);
        return;
      }
      if (b.id) {
        await api.aktualisieren(b.id, daten);
      } else {
        const erstellt = await api.neu({ ...basisEntwurf(b), ...daten });
        b.id = erstellt.id;
      }
    });
    const q = erzeugeSpeicherWarteschlange(schreiben);
    warteschlangen.set(b.clientKey, q);
    return q;
  }

  /* Schickt den KOMPLETTEN aktuellen Stand eines Blocks los -- immer den
     ganzen Datensatz, nie nur ein einzelnes Feld. Dadurch kann ein
     Umsortieren, das kurz nach einer Textänderung passiert, diese niemals
     mit einem älteren Stand überschreiben: beide landen im selben, streng
     nacheinander abgearbeiteten Zustand. */
  function blockSpeichern(b) {
    warteschlangeFuer(b).anstossen({
      inhalt: b.inhalt, breite: b.breite, bewegung: b.bewegung,
      notiz: b.notiz || null, sort_order: b.sort_order,
    });
  }
  function blockLoeschenSpeichern(b) {
    /* Eine noch wartende (entprellte) Textänderung darf das Löschen NICHT
       nachträglich rückgängig machen, indem sie später doch noch feuert
       und den Block damit wiederbelebt -- deshalb hier zuerst kappen. */
    clearTimeout(entprellungen.get(b.clientKey));
    warteschlangeFuer(b).anstossen({ __geloescht: true });
  }

  /* Tippen soll nicht bei jedem Tastendruck einen Netzwerk-Aufruf auslösen
     -- die Warteschlange wäre zwar auch dann korrekt (kein Datenverlust),
     aber unnötig geschwätzig. Deshalb kurz entprellen; das Ergebnis ist am
     Ende exakt dasselbe, nur mit weniger Aufrufen. */
  const entprellungen = new Map();
  function blockSpeichernEntprellt(b, verzoegerungMs = 500) {
    clearTimeout(entprellungen.get(b.clientKey));
    entprellungen.set(b.clientKey, setTimeout(() => blockSpeichern(b), verzoegerungMs));
  }

  /* ---------- Momentaufnahme für Rückgängig ---------- */
  function momentaufnahme() {
    return zustand.bloecke.map(b => ({ ...b, inhalt: JSON.parse(JSON.stringify(b.inhalt)) }));
  }
  function vorMutationMerken() { undo.merken(momentaufnahme()); }

  /* ---------- Vorschau (dieselbe Darstellung wie öffentlich, per bloecke.js) ---------- */
  function vorschauNeuZeichnen() {
    if (!vorschauEl || !window.mmBloecke) return;
    /* Absichtlich zusätzlich zur Spaltenliste in db.js (die "notiz" nie
       abfragt): auch hier nie mit übergeben -- doppelt genäht hält besser,
       gerade weil die Notiz nie öffentlich sichtbar werden darf. */
    const oeffentlich = zustand.bloecke.map(({ notiz, clientKey, ...rest }) => rest);
    vorschauEl.innerHTML = window.mmBloecke.seite(oeffentlich);
  }

  /* ---------- Rendern der Blockliste ---------- */
  function liste() { return wurzel.querySelector('.be-liste'); }

  function neuZeichnen() {
    const alt = liste();
    const neu = document.createElement('ul');
    neu.className = 'be-liste';
    zustand.bloecke.forEach((b, idx) => neu.appendChild(zeileBauen(b, idx)));
    alt.replaceWith(neu);
    verdrahteListe();
    vorschauNeuZeichnen();
  }

  function typLabel(typ) { return (BLOCKARTEN_NACH_TYP[typ] || {}).label || typ; }
  function typIcon(typ) { return (BLOCKARTEN_NACH_TYP[typ] || {}).icon || '•'; }

  function feldZeileBauen(inhaltEl) {
    const div = document.createElement('div');
    div.className = 'be-inhalt';
    div.appendChild(inhaltEl);
    return div;
  }

  function autoWachsen(ta) {
    const h = () => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; };
    ta.addEventListener('input', h); requestAnimationFrame(h);
  }

  /* Textfeld mit Format-Leiste bei Auswahl, Slash-Menü, Enter/Rücktaste-
     Navigation -- der Kern der "Notion-artigen" Bedienung. */
  function textFeldBauen(b, wert, aufAenderung, { mehrzeilig = true, platzhalter = '' } = {}) {
    const ta = document.createElement('textarea');
    ta.className = 'be-text'; ta.value = wert; ta.rows = 1; ta.placeholder = platzhalter;
    ta.dataset.key = b.clientKey;
    autoWachsen(ta);

    ta.addEventListener('input', () => {
      /* "/" als allererstes Zeichen öffnet die Blockauswahl. */
      if (ta.value === '/') { slashOeffnen(b, ta); return; }
      if (zustand.slash && zustand.slash.clientKey === b.clientKey) {
        if (ta.value.startsWith('/')) slashFilternAuf(ta.value.slice(1));
        else slashSchliessen();
      }
      aufAenderung(ta.value);
    });

    ta.addEventListener('keydown', (e) => {
      if (zustand.slash && zustand.slash.clientKey === b.clientKey) {
        if (e.key === 'Escape') { e.preventDefault(); ta.value = ''; aufAenderung(''); slashSchliessen(); return; }
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter') {
          e.preventDefault(); slashTaste(e.key); return;
        }
      }
      if (e.key === 'Enter' && (!mehrzeilig || !e.shiftKey)) {
        e.preventDefault();
        vorMutationMerken();
        const neuerBlock = blockEinfuegenNach(b, 'text');
        neuZeichnen();
        fokussiere(neuerBlock.clientKey);
        return;
      }
      if (e.key === 'Backspace' && ta.value === '' && ta.selectionStart === 0) {
        if (zustand.bloecke.length <= 1) return;   // die letzte Zeile bleibt immer stehen
        e.preventDefault();
        vorMutationMerken();
        const vorheriger = blockLoeschen(b);
        neuZeichnen();
        if (vorheriger) fokussiere(vorheriger.clientKey, { ansEnde: true });
      }
    });

    /* Auswahl markiert -> kleine Leiste mit fett/kursiv/Link/Türchen. */
    const zeigen = () => {
      if (ta.selectionStart === ta.selectionEnd) { formatLeisteVerbergen(); return; }
      formatLeisteZeigen(ta, b);
    };
    ta.addEventListener('select', zeigen);
    ta.addEventListener('mouseup', zeigen);
    ta.addEventListener('keyup', (e) => { if (e.shiftKey || e.key.startsWith('Arrow')) zeigen(); });
    ta.addEventListener('blur', () => setTimeout(formatLeisteVerbergen, 150));

    return ta;
  }

  /* ---------- Blockauswahl ("/") ---------- */
  function slashOeffnen(b, ankerEl) {
    zustand.slash = { clientKey: b.clientKey, auswahl: 0, treffer: slashTreffer('') };
    slashZeichnen(ankerEl);
  }
  function slashFilternAuf(suchtext) {
    if (!zustand.slash) return;
    zustand.slash.treffer = slashTreffer(suchtext);
    zustand.slash.auswahl = 0;
    slashZeichnen();
  }
  function slashSchliessen() {
    zustand.slash = null;
    const alt = wurzel.querySelector('.be-slash'); if (alt) alt.remove();
  }
  function slashTaste(taste) {
    if (!zustand.slash) return;
    const n = zustand.slash.treffer.length;
    if (taste === 'ArrowDown') zustand.slash.auswahl = (zustand.slash.auswahl + 1) % Math.max(n, 1);
    if (taste === 'ArrowUp') zustand.slash.auswahl = (zustand.slash.auswahl - 1 + n) % Math.max(n, 1);
    if (taste === 'Enter' && n) slashAuswaehlen(zustand.slash.treffer[zustand.slash.auswahl].typ);
    else slashZeichnen();
  }
  function slashAuswaehlen(typ) {
    const s = zustand.slash; if (!s) return;
    const b = zustand.bloecke.find(x => x.clientKey === s.clientKey);
    slashSchliessen();
    if (!b) return;
    vorMutationMerken();
    b.typ = typ; b.inhalt = leererInhalt(typ);
    blockSpeichern(b);
    neuZeichnen();
    fokussiere(b.clientKey);
  }
  function slashZeichnen(ankerEl) {
    let el = wurzel.querySelector('.be-slash');
    if (!el) {
      el = document.createElement('div'); el.className = 'be-slash';
      (ankerEl || wurzel).after ? ankerEl.after(el) : wurzel.appendChild(el);
    }
    const s = zustand.slash;
    el.innerHTML = s.treffer.length
      ? s.treffer.map((b, i) => `<button type="button" class="be-slash-eintrag${i === s.auswahl ? ' be-slash-aktiv' : ''}" data-typ="${b.typ}">`
        + `<span class="be-slash-icon">${esc(b.icon)}</span>${esc(b.label)}</button>`).join('')
      : '<p class="be-slash-leer">Keine Blockart gefunden.</p>';
    el.querySelectorAll('[data-typ]').forEach(btn =>
      btn.addEventListener('mousedown', (e) => { e.preventDefault(); slashAuswaehlen(btn.dataset.typ); }));
  }

  /* ---------- Format-Leiste bei markiertem Text ---------- */
  function formatLeisteVerbergen() {
    const el = wurzel.querySelector('.be-format'); if (el) el.remove();
  }

  /* Kleines, eigenes Fenster statt der hässlichen (und unter Chrome-
     Fernsteuerung nicht prüfbaren!) window.prompt()-Dialoge. Nutzt dieselben
     Klassen wie das alte Link-Fenster im Admin-CSS. Löst mit den Feldwerten
     auf, oder mit null bei "Abbrechen"/Escape/Klick daneben. */
  function kleinerDialog({ titel, hinweis = '', felder }) {
    return new Promise((loese) => {
      const hg = document.createElement('div'); hg.className = 'mini-hg';
      hg.innerHTML = `<form class="mini-box">
        <h3 class="tropi">${esc(titel)}</h3>
        ${felder.map(f => `<label>${esc(f.label)}
          <input name="${esc(f.name)}" placeholder="${esc(f.platzhalter || '')}"
            value="${esc(f.wert || '')}"${f.pflicht ? ' required' : ''}></label>`).join('')}
        ${hinweis ? `<p class="klein grau">${hinweis}</p>` : ''}
        <div class="mini-knoepfe">
          <button type="button" class="btn ghost" data-tun="abbrechen">Abbrechen</button>
          <button type="submit" class="btn primary">Einfügen</button>
        </div>
      </form>`;
      document.body.appendChild(hg);
      const form = hg.querySelector('form');
      form.querySelector('input')?.focus();
      const tastatur = (e) => { if (e.key === 'Escape') schliessen(null); };
      document.addEventListener('keydown', tastatur);
      function schliessen(ergebnis) {
        document.removeEventListener('keydown', tastatur);
        hg.remove(); loese(ergebnis);
      }
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const daten = {};
        felder.forEach(f => { daten[f.name] = form.querySelector(`[name="${f.name}"]`).value.trim(); });
        schliessen(daten);
      });
      form.querySelector('[data-tun="abbrechen"]').addEventListener('click', () => schliessen(null));
      hg.addEventListener('mousedown', (e) => { if (e.target === hg) schliessen(null); });
    });
  }

  function formatLeisteZeigen(ta, b) {
    formatLeisteVerbergen();
    const el = document.createElement('div'); el.className = 'be-format';
    el.innerHTML = `
      <button type="button" data-tun="fett" title="Fett"><b>F</b></button>
      <button type="button" data-tun="kursiv" title="Kursiv"><i>K</i></button>
      <button type="button" data-tun="link" title="Link">🔗</button>
      <button type="button" data-tun="tuer" title="Türchen">🚪</button>`;
    ta.insertAdjacentElement('beforebegin', el);
    el.querySelectorAll('[data-tun]').forEach(btn => btn.addEventListener('mousedown', async (e) => {
      e.preventDefault();
      const start = ta.selectionStart, end = ta.selectionEnd;
      const markiert = ta.value.slice(start, end);
      if (btn.dataset.tun === 'fett' || btn.dataset.tun === 'kursiv') {
        const marker = btn.dataset.tun === 'fett' ? '**' : '*';
        const r = umschliesseAuswahl(ta.value, start, end, marker);
        ta.value = r.text; ta.selectionStart = r.start; ta.selectionEnd = r.end;
      } else if (btn.dataset.tun === 'link') {
        formatLeisteVerbergen();
        const antwort = await kleinerDialog({
          titel: 'Link einfügen',
          felder: [
            { name: 'text', label: 'Angezeigter Text', wert: markiert, pflicht: true },
            { name: 'ziel', label: 'Adresse', platzhalter: 'https://…', pflicht: true },
          ],
          hinweis: 'Fehlt das https://, wird es ergänzt.',
        });
        if (!antwort) { ta.focus(); return; }
        const ziel = window.mm ? window.mm.linkZiel(antwort.ziel) : antwort.ziel;
        if (!ziel) { ta.focus(); return; }
        const r = linkEinfuegen(ta.value, start, end, antwort.text, ziel);
        ta.value = r.text; ta.selectionStart = ta.selectionEnd = r.end;
      } else if (btn.dataset.tun === 'tuer') {
        formatLeisteVerbergen();
        const antwort = await kleinerDialog({
          titel: 'Türchen einfügen',
          felder: [
            { name: 'wort', label: 'Angezeigter Text', wert: markiert, pflicht: true },
            { name: 'slug', label: 'Ziel-Welt', platzhalter: 'der Teil hinter /welt/…', pflicht: true },
          ],
        });
        if (!antwort) { ta.focus(); return; }
        const r = tuerEinfuegen(ta.value, start, end, antwort.wort, antwort.slug, '', '', false);
        ta.value = r.text; ta.selectionStart = ta.selectionEnd = r.end;
      }
      ta.dispatchEvent(new Event('input'));
      ta.focus();
      formatLeisteVerbergen();
    }));
  }

  /* ---------- Block einfügen / löschen / duplizieren ---------- */
  function blockEinfuegenNach(nachB, typ) {
    const idx = zustand.bloecke.findIndex(x => x.clientKey === nachB.clientKey);
    const danach = zustand.bloecke[idx + 1];
    const neu = {
      clientKey: neuerSchluessel(), id: null, seite_id: seiteId, typ,
      inhalt: leererInhalt(typ), breite: 'normal', bewegung: 'keine', notiz: '',
      sort_order: naechsteSortierung(nachB.sort_order, danach ? danach.sort_order : null),
    };
    zustand.bloecke.splice(idx + 1, 0, neu);
    blockSpeichern(neu);
    return neu;
  }
  function blockAmEndeEinfuegen(typ) {
    const letzter = zustand.bloecke[zustand.bloecke.length - 1];
    const neu = {
      clientKey: neuerSchluessel(), id: null, seite_id: seiteId, typ,
      inhalt: leererInhalt(typ), breite: 'normal', bewegung: 'keine', notiz: '',
      sort_order: naechsteSortierung(letzter ? letzter.sort_order : null, null),
    };
    zustand.bloecke.push(neu);
    blockSpeichern(neu);
    return neu;
  }
  function blockLoeschen(b) {
    const idx = zustand.bloecke.findIndex(x => x.clientKey === b.clientKey);
    if (idx === -1) return null;
    zustand.bloecke.splice(idx, 1);
    blockLoeschenSpeichern(b);
    return zustand.bloecke[idx - 1] || null;
  }
  function blockDuplizieren(b) {
    const idx = zustand.bloecke.findIndex(x => x.clientKey === b.clientKey);
    const danach = zustand.bloecke[idx + 1];
    const kopie = {
      clientKey: neuerSchluessel(), id: null, seite_id: seiteId, typ: b.typ,
      inhalt: JSON.parse(JSON.stringify(b.inhalt)), breite: b.breite, bewegung: b.bewegung,
      notiz: b.notiz || '', sort_order: naechsteSortierung(b.sort_order, danach ? danach.sort_order : null),
    };
    zustand.bloecke.splice(idx + 1, 0, kopie);
    blockSpeichern(kopie);
    return kopie;
  }

  function fokussiere(clientKey, { ansEnde = false } = {}) {
    const el = wurzel.querySelector(`[data-fokus="${clientKey}"]`)
      || wurzel.querySelector(`[data-key="${clientKey}"]`);
    if (!el) return;
    el.focus();
    if (ansEnde && el.setSelectionRange) el.setSelectionRange(el.value.length, el.value.length);
  }

  /* ---------- Bild-Liste (für 'bild'-Block und die Bildseite von
     'text_mit_bild') ---------- */
  function bildlisteBauen(bilder, aufAenderung) {
    const wrap = document.createElement('div'); wrap.className = 'be-bilder';
    const zeichnen = () => {
      wrap.innerHTML = '';
      bilder.forEach((bild, i) => {
        const row = document.createElement('div'); row.className = 'be-bild-zeile';
        row.innerHTML = `
          ${bild.url ? `<img class="be-bild-vorschau" src="${esc(bild.url)}" alt="">` : '<div class="be-bild-vorschau be-bild-leer">kein Bild</div>'}
          <input class="be-bild-alt" placeholder="Alt-Text (für Sehbehinderte / Bildunterschrift)" value="${esc(bild.alt || '')}">
          <select class="be-bild-groesse">
            <option value="gross"${bild.groesse === 'gross' ? ' selected' : ''}>groß</option>
            <option value="mittel"${bild.groesse === 'mittel' ? ' selected' : ''}>mittel</option>
            <option value="klein"${bild.groesse === 'klein' ? ' selected' : ''}>klein</option>
          </select>
          <button type="button" class="btn ghost be-bild-ersetzen">Bild wählen</button>
          <button type="button" class="btn ghost be-bild-weg" title="Entfernen">×</button>
          <input type="file" class="be-bild-datei" accept="image/*,image/gif" hidden>`;
        row.querySelector('.be-bild-alt').addEventListener('input', (e) => { bild.alt = e.target.value; aufAenderung(); });
        row.querySelector('.be-bild-groesse').addEventListener('change', (e) => { bild.groesse = e.target.value; aufAenderung(); });
        row.querySelector('.be-bild-weg').addEventListener('click', () => { bilder.splice(i, 1); zeichnen(); aufAenderung(); });
        row.querySelector('.be-bild-ersetzen').addEventListener('click', () => row.querySelector('.be-bild-datei').click());
        row.querySelector('.be-bild-datei').addEventListener('change', async (e) => {
          const datei = e.target.files[0]; e.target.value = ''; if (!datei) return;
          const r = await api.bildHochladen(datei);
          if (r && r.url) { bild.url = r.url; zeichnen(); aufAenderung(); }
        });
        wrap.appendChild(row);
      });
      const knopf = document.createElement('button');
      knopf.type = 'button'; knopf.className = 'btn ghost be-bild-neu'; knopf.textContent = '+ Bild';
      knopf.addEventListener('click', () => { bilder.push({ alt: '', url: '', groesse: 'gross' }); zeichnen(); aufAenderung(); });
      wrap.appendChild(knopf);
    };
    zeichnen();
    return wrap;
  }

  /* ---------- eine Blockzeile bauen ---------- */
  function zeileBauen(b) {
    const li = document.createElement('li');
    li.className = 'be-zeile'; li.dataset.key = b.clientKey; li.dataset.typ = b.typ; li.draggable = true;

    const kopf = document.createElement('div'); kopf.className = 'be-kopf';
    kopf.innerHTML = `
      <button type="button" class="be-griff" title="Zum Umsortieren ziehen">⠿</button>
      <span class="be-typ"><span class="be-typ-icon">${esc(typIcon(b.typ))}</span>${esc(typLabel(b.typ))}</span>
      <span class="be-kopf-fuell"></span>
      <button type="button" class="be-menu-knopf" title="Weitere Optionen">⋯</button>`;
    li.appendChild(kopf);

    li.appendChild(feldInhaltBauen(b));

    /* Menü: Breite, Bewegung, Notiz an Claude, Duplizieren, Löschen. */
    const menu = document.createElement('div'); menu.className = 'be-menu'; menu.hidden = true;
    menu.innerHTML = `
      <label>Breite
        <select class="be-breite">${BREITEN.map(x => `<option value="${x.wert}"${b.breite === x.wert ? ' selected' : ''}>${esc(x.label)}</option>`).join('')}</select>
      </label>
      <label>Bewegung
        <select class="be-bewegung">${BEWEGUNGEN.map(x => `<option value="${x.wert}"${b.bewegung === x.wert ? ' selected' : ''}>${esc(x.label)}</option>`).join('')}</select>
      </label>
      <label>Notiz an Claude <span class="klein grau">(privat — erscheint nie auf der Seite)</span>
        <textarea class="be-notiz" rows="2" placeholder="z. B.: „hier soll das Bild beim Scrollen leicht wachsen“">${esc(b.notiz || '')}</textarea>
      </label>
      <div class="be-menu-knoepfe">
        <button type="button" class="btn ghost be-duplizieren">Duplizieren</button>
        <button type="button" class="btn ghost be-loeschen">Löschen</button>
      </div>`;
    li.appendChild(menu);

    kopf.querySelector('.be-menu-knopf').addEventListener('click', () => { menu.hidden = !menu.hidden; });
    menu.querySelector('.be-breite').addEventListener('change', (e) => { b.breite = e.target.value; blockSpeichern(b); vorschauNeuZeichnen(); });
    menu.querySelector('.be-bewegung').addEventListener('change', (e) => { b.bewegung = e.target.value; blockSpeichern(b); vorschauNeuZeichnen(); });
    const notizFeld = menu.querySelector('.be-notiz');
    autoWachsen(notizFeld);
    notizFeld.addEventListener('input', (e) => { b.notiz = e.target.value; blockSpeichernEntprellt(b); });
    menu.querySelector('.be-duplizieren').addEventListener('click', () => {
      vorMutationMerken(); blockDuplizieren(b); neuZeichnen();
    });
    menu.querySelector('.be-loeschen').addEventListener('click', () => {
      vorMutationMerken(); blockLoeschen(b); neuZeichnen();
    });

    return li;
  }

  /* Baut den typspezifischen Eingabebereich eines Blocks. */
  function feldInhaltBauen(b) {
    const aendern = (patch) => { Object.assign(b.inhalt, patch); blockSpeichernEntprellt(b); };
    const aendernSofort = (patch) => { Object.assign(b.inhalt, patch); blockSpeichern(b); vorschauNeuZeichnen(); };

    switch (b.typ) {
      case 'text': {
        const ta = textFeldBauen(b, b.inhalt.roh || '', (wert) => { b.inhalt.roh = wert; blockSpeichernEntprellt(b); vorschauNeuZeichnen(); },
          { mehrzeilig: true, platzhalter: 'Schreib los — „/“ öffnet die Blockauswahl.' });
        ta.dataset.fokus = b.clientKey;
        return feldZeileBauen(ta);
      }
      case 'ueberschrift': {
        const { ebene, text } = ueberschriftLesen(b.inhalt.roh);
        const wrap = document.createElement('div'); wrap.className = 'be-ueberschrift-wrap';
        const ebeneWahl = document.createElement('select'); ebeneWahl.className = 'be-ebene';
        ebeneWahl.innerHTML = `<option value="2"${ebene === 2 ? ' selected' : ''}>groß</option><option value="3"${ebene === 3 ? ' selected' : ''}>klein</option>`;
        const ta = textFeldBauen(b, text, (wert) => {
          b.inhalt.roh = ueberschriftBauen(+ebeneWahl.value, wert); blockSpeichernEntprellt(b); vorschauNeuZeichnen();
        }, { mehrzeilig: false, platzhalter: 'Überschrift' });
        ta.classList.add('be-ueberschrift'); ta.dataset.fokus = b.clientKey;
        ebeneWahl.addEventListener('change', () => {
          b.inhalt.roh = ueberschriftBauen(+ebeneWahl.value, ueberschriftLesen(b.inhalt.roh).text);
          blockSpeichern(b); vorschauNeuZeichnen();
        });
        wrap.append(ebeneWahl, ta);
        return feldZeileBauen(wrap);
      }
      case 'bild': {
        const bilder = bildZeilenLesen(b.inhalt.roh);
        const liste = bildlisteBauen(bilder, () => { b.inhalt.roh = bildZeilenBauen(bilder); blockSpeichernEntprellt(b); vorschauNeuZeichnen(); });
        return feldZeileBauen(liste);
      }
      case 'gif': {
        const wrap = document.createElement('div'); wrap.className = 'be-gif';
        const m = String(b.inhalt.roh || '').match(/^!\[([^\]]*)\]\(([^)\s]+)\)/);
        const alt = m ? m[1] : '', url = m ? m[2] : '';
        wrap.innerHTML = `
          ${url ? `<img class="be-bild-vorschau" src="${esc(url)}" alt="">` : '<div class="be-bild-vorschau be-bild-leer">kein GIF</div>'}
          <input class="be-gif-alt" placeholder="Alt-Text" value="${esc(alt)}">
          <button type="button" class="btn ghost be-gif-wahl">GIF wählen</button>
          <input type="file" class="be-gif-datei" accept="image/gif,image/apng" hidden>
          <p class="klein grau">GIFs werden NICHT verkleinert — sonst bliebe nur das erste Einzelbild übrig.</p>`;
        const setzen = (neuAlt, neuUrl) => { b.inhalt.roh = `![${neuAlt}](${neuUrl})`; };
        wrap.querySelector('.be-gif-alt').addEventListener('input', (e) => { setzen(e.target.value, url); blockSpeichernEntprellt(b); vorschauNeuZeichnen(); });
        wrap.querySelector('.be-gif-wahl').addEventListener('click', () => wrap.querySelector('.be-gif-datei').click());
        wrap.querySelector('.be-gif-datei').addEventListener('change', async (e) => {
          const datei = e.target.files[0]; e.target.value = ''; if (!datei) return;
          const r = await api.bildHochladen(datei);
          if (r && r.url) { setzen(wrap.querySelector('.be-gif-alt').value, r.url); blockSpeichern(b); neuZeichnen(); }
        });
        return feldZeileBauen(wrap);
      }
      case 'video': {
        const wrap = document.createElement('div'); wrap.className = 'be-video';
        const input = document.createElement('input');
        input.className = 'be-video-url'; input.placeholder = 'https://youtu.be/… oder https://vimeo.com/…';
        input.value = b.inhalt.roh || '';
        const hinweis = document.createElement('p'); hinweis.className = 'klein grau be-video-hinweis';
        const pruefen = () => {
          const v = window.mm && window.mm.videoEmbed(input.value);
          hinweis.textContent = !input.value ? '' : v ? 'Erkannt: ' + v.kind : 'Kein YouTube- oder Vimeo-Link erkannt.';
        };
        pruefen();
        input.addEventListener('input', () => { b.inhalt.roh = input.value; pruefen(); blockSpeichernEntprellt(b); vorschauNeuZeichnen(); });
        wrap.append(input, hinweis);
        return feldZeileBauen(wrap);
      }
      case 'text_mit_bild': {
        const gelesen = textMitBildLesen(b.inhalt.roh);
        const wrap = document.createElement('div'); wrap.className = 'be-textmitbild';
        const schalter = document.createElement('label'); schalter.className = 'schalter';
        schalter.innerHTML = `<input type="checkbox"${gelesen.bilderLinks ? ' checked' : ''}> Bilder links statt rechts`;
        const ta = textFeldBauen(b, gelesen.text, (wert) => {
          gelesen.text = wert; b.inhalt.roh = textMitBildBauen(gelesen); blockSpeichernEntprellt(b); vorschauNeuZeichnen();
        }, { mehrzeilig: true, platzhalter: 'Der Text neben den Bildern.' });
        ta.dataset.fokus = b.clientKey;
        const bilderListe = bildlisteBauen(gelesen.bilder, () => {
          b.inhalt.roh = textMitBildBauen(gelesen); blockSpeichernEntprellt(b); vorschauNeuZeichnen();
        });
        schalter.querySelector('input').addEventListener('change', (e) => {
          gelesen.bilderLinks = e.target.checked; b.inhalt.roh = textMitBildBauen(gelesen); blockSpeichern(b); vorschauNeuZeichnen();
        });
        wrap.append(schalter, ta, bilderListe);
        return feldZeileBauen(wrap);
      }
      case 'code': {
        const { sprache, code } = codeLesen(b.inhalt.roh);
        const wrap = document.createElement('div'); wrap.className = 'be-code';
        const sprachWahl = document.createElement('select'); sprachWahl.className = 'be-code-sprache';
        sprachWahl.innerHTML = ['', 'js', 'swift', 'bash', 'json', 'csv']
          .map(s => `<option value="${s}"${sprache === s ? ' selected' : ''}>${s || 'einfacher Text'}</option>`).join('');
        const ta = document.createElement('textarea'); ta.className = 'be-code-text'; ta.rows = 4; ta.value = code;
        autoWachsen(ta);
        sprachWahl.addEventListener('change', () => { b.inhalt.roh = codeBauen(sprachWahl.value, ta.value); blockSpeichern(b); vorschauNeuZeichnen(); });
        ta.addEventListener('input', () => { b.inhalt.roh = codeBauen(sprachWahl.value, ta.value); blockSpeichernEntprellt(b); vorschauNeuZeichnen(); });
        wrap.append(sprachWahl, ta);
        return feldZeileBauen(wrap);
      }
      case 'werkzeug': {
        const { kennung } = werkzeugLesen(b.inhalt.roh);
        const input = document.createElement('input'); input.className = 'be-werkzeug';
        input.placeholder = 'Kennung der Einlage, z. B. the-race'; input.value = kennung;
        input.addEventListener('input', () => { b.inhalt.roh = werkzeugBauen(input.value); blockSpeichernEntprellt(b); vorschauNeuZeichnen(); });
        return feldZeileBauen(input);
      }
      case 'trenner': {
        const p = document.createElement('p'); p.className = 'be-trenner-hinweis klein grau';
        p.textContent = 'Trennstrich mit Blume — braucht keinen Inhalt.';
        return feldZeileBauen(p);
      }
      case 'tuer': {
        const wrap = document.createElement('div'); wrap.className = 'be-tuer';
        wrap.innerHTML = `
          <input class="be-tuer-text" placeholder="Beschriftung, z. B. „Auf YouTube ansehen“" value="${esc(b.inhalt.text || '')}">
          <input class="be-tuer-ziel" placeholder="Adresse oder /welt/…" value="${esc(b.inhalt.ziel || '')}">`;
        wrap.querySelector('.be-tuer-text').addEventListener('input', (e) => aendern({ text: e.target.value }));
        wrap.querySelector('.be-tuer-ziel').addEventListener('input', (e) => aendern({ ziel: e.target.value }));
        return feldZeileBauen(wrap);
      }
      case 'randnotiz': {
        const wrap = document.createElement('div'); wrap.className = 'be-randnotiz';
        wrap.innerHTML = `
          <input class="be-rn-titel" placeholder="Titel" value="${esc(b.inhalt.titel || '')}">
          <input class="be-rn-z1" placeholder="Zeile 1" value="${esc(b.inhalt.zeile1 || '')}">
          <input class="be-rn-z2" placeholder="Zeile 2 (optional)" value="${esc(b.inhalt.zeile2 || '')}">
          <label class="schalter"><input type="checkbox" class="be-rn-punkt"${b.inhalt.punkt ? ' checked' : ''}> grüner Punkt davor</label>`;
        wrap.querySelector('.be-rn-titel').addEventListener('input', (e) => aendern({ titel: e.target.value }));
        wrap.querySelector('.be-rn-z1').addEventListener('input', (e) => aendern({ zeile1: e.target.value }));
        wrap.querySelector('.be-rn-z2').addEventListener('input', (e) => aendern({ zeile2: e.target.value }));
        wrap.querySelector('.be-rn-punkt').addEventListener('change', (e) => aendernSofort({ punkt: e.target.checked }));
        return feldZeileBauen(wrap);
      }
      case 'abschnitt': {
        const wrap = document.createElement('div'); wrap.className = 'be-abschnitt';
        wrap.innerHTML = `
          <input class="be-ab-titel" placeholder="Titel des Abschnitts" value="${esc(b.inhalt.titel || '')}">
          <select class="be-ab-art">
            <option value="beruflich"${b.inhalt.art === 'beruflich' ? ' selected' : ''}>beruflich</option>
            <option value="persoenlich"${b.inhalt.art === 'persoenlich' ? ' selected' : ''}>persönlich</option>
            <option value="kontakt"${b.inhalt.art === 'kontakt' ? ' selected' : ''}>kontakt</option>
          </select>
          <input type="text" class="be-ab-farbe" placeholder="#RRGGBB (optional)" value="${esc(b.inhalt.farbe || '')}">`;
        wrap.querySelector('.be-ab-titel').addEventListener('input', (e) => aendern({ titel: e.target.value }));
        wrap.querySelector('.be-ab-art').addEventListener('change', (e) => aendernSofort({ art: e.target.value }));
        wrap.querySelector('.be-ab-farbe').addEventListener('input', (e) => aendern({ farbe: e.target.value || null }));
        return feldZeileBauen(wrap);
      }
      default:
        return feldZeileBauen(document.createElement('div'));
    }
  }

  /* ---------- Ziehen zum Umsortieren (wie in der alten Projektliste) ---------- */
  let gezogen = null;
  function verdrahteListe() {
    const ul = liste();
    ul.addEventListener('dragstart', (e) => {
      gezogen = e.target.closest('.be-zeile');
      gezogen?.classList.add('wird-gezogen');
    });
    ul.addEventListener('dragend', () => {
      gezogen?.classList.remove('wird-gezogen');
      ul.querySelectorAll('.be-zeile.ziel').forEach(z => z.classList.remove('ziel'));
      gezogen = null;
    });
    ul.addEventListener('dragover', (e) => {
      e.preventDefault();
      const ziel = e.target.closest('.be-zeile');
      if (!ziel || ziel === gezogen) return;
      ul.querySelectorAll('.be-zeile.ziel').forEach(z => z.classList.remove('ziel'));
      ziel.classList.add('ziel');
    });
    ul.addEventListener('drop', (e) => {
      e.preventDefault();
      const ziel = e.target.closest('.be-zeile');
      if (!ziel || !gezogen || ziel === gezogen) return;
      vorMutationMerken();
      const vonKey = gezogen.dataset.key, nachKey = ziel.dataset.key;
      /* BEIDE Indizes VOR dem Entnehmen lesen -- sonst vergleicht man einen
         Index von vorher mit einem von nachher, und bei benachbarten Zeilen
         landet der gezogene Block wieder an derselben Stelle. */
      const vonIdx = zustand.bloecke.findIndex(x => x.clientKey === vonKey);
      const nachIdx = zustand.bloecke.findIndex(x => x.clientKey === nachKey);
      const [b] = zustand.bloecke.splice(vonIdx, 1);
      /* Nach dem Entnehmen rutscht der Index des Ziels um eins zurück,
         wenn es hinter der Entnahmestelle lag. */
      const nachIdxNeu = nachIdx > vonIdx ? nachIdx - 1 : nachIdx;
      /* Reihenfolge wie im DOM: hinter das Ziel, wenn von oben kommend. */
      const davorBild = vonIdx < nachIdx ? nachIdxNeu + 1 : nachIdxNeu;
      zustand.bloecke.splice(davorBild, 0, b);
      const davor = zustand.bloecke[davorBild - 1];
      const danach = zustand.bloecke[davorBild + 1];
      b.sort_order = naechsteSortierung(davor ? davor.sort_order : null, danach ? danach.sort_order : null);
      blockSpeichern(b);
      neuZeichnen();
    });
  }

  /* ---------- Rückgängig ---------- */
  function rueckgaengig() {
    const vorher = undo.zurueck();
    if (!vorher) return;
    /* Unterschied zum aktuellen Stand ermitteln und NUR die betroffenen
       Zeilen speichern -- läuft über dieselbe sichere Warteschlange wie
       jede andere Änderung, verliert also selbst bei einem Rückgängig
       kurz nach einer Änderung nichts. */
    const jetztKeys = new Set(zustand.bloecke.map(b => b.clientKey));
    const vorherKeys = new Set(vorher.map(b => b.clientKey));
    zustand.bloecke.forEach(b => { if (!vorherKeys.has(b.clientKey)) blockLoeschenSpeichern(b); });
    vorher.forEach(b => { if (!jetztKeys.has(b.clientKey)) blockSpeichern(b); });
    zustand.bloecke = vorher;
    /* Für alle weiterhin existierenden Blöcke den wiederhergestellten Stand
       ebenfalls speichern -- er könnte sich vom zuletzt gespeicherten
       unterscheiden. */
    zustand.bloecke.forEach(b => { if (jetztKeys.has(b.clientKey) && vorherKeys.has(b.clientKey)) blockSpeichern(b); });
    neuZeichnen();
  }

  /* ---------- Aufbau ---------- */
  wurzel.innerHTML = '<ul class="be-liste"></ul><div class="be-unten"><button type="button" class="btn ghost be-neu-unten">+ Block hinzufügen</button></div>';
  neuZeichnen();
  wurzel.querySelector('.be-neu-unten').addEventListener('click', () => {
    vorMutationMerken();
    const b = blockAmEndeEinfuegen('text');
    neuZeichnen();
    fokussiere(b.clientKey);
  });
  const aussenKlick = (e) => {
    if (!e.target.closest('.be-menu') && !e.target.closest('.be-menu-knopf'))
      wurzel.querySelectorAll('.be-menu').forEach(m => { m.hidden = true; });
    if (!e.target.closest('.be-slash') && !e.target.closest('.be-text')) slashSchliessen();
  };
  document.addEventListener('mousedown', aussenKlick);

  return {
    bloecke() { return zustand.bloecke; },
    rueckgaengig,
    neuZeichnen,
    blockAmEndeEinfuegen(typ) { const b = blockAmEndeEinfuegen(typ); neuZeichnen(); return b; },
    /* Beim Wechsel auf eine andere Seite aufrufen -- sonst sammeln sich bei
       jedem Öffnen des Editors weitere globale Klick-Beobachter an. */
    zerstoeren() {
      document.removeEventListener('mousedown', aussenKlick);
      entprellungen.forEach(t => clearTimeout(t));
      entprellungen.clear();
    },
  };
}
