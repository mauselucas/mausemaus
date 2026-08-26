/* mausemaus — der Blockeditor (DOM + Speichern).

   Grundgedanke nach der Neugestaltung: DIE SCHREIBFLÄCHE IST DIE VORSCHAU.
   Es gibt keine zweite Spalte mehr, in der dasselbe noch einmal steht.
   - Textblöcke sehen aus wie das Ergebnis: ein durchscheinendes Textfeld
     liegt über einer eingefärbten Schicht (auszeichnungsHtml aus
     block-modell.js). Beide sind zeichengleich, sonst steht die Schrift
     versetzt zum Cursor.
   - Medien (Bild, GIF, Video, Trenner, Türchen, Werkzeug) werden mit dem
     ÖFFENTLICHEN Umsetzer (bloecke.js) fertig dargestellt; ihre Bedienung
     erscheint erst bei Annäherung.
   - Griff und "⋯" bleiben unsichtbar, bis die Maus nah ist.
   - Alle Blockeinstellungen (Breite, Farbe, Notiz) liegen im "⋯"-Menü.
     Blöcke mit Notiz tragen dauerhaft einen kleinen Punkt am Rand.

   Die private Notiz wird dem Umsetzer GAR NICHT ERST übergeben (siehe
   oeffentlich()) -- sie kann deshalb nicht versehentlich im HTML landen. */

import {
  BLOCKARTEN_NACH_TYP, leererInhalt, slashTreffer,
  naechsteSortierung, umschliesseAuswahl, linkEinfuegen, tuerEinfuegen,
  bildZeilenLesen, bildZeilenBauen, textMitBildLesen, textMitBildBauen,
  ueberschriftLesen, ueberschriftBauen, codeLesen, codeBauen,
  werkzeugLesen, werkzeugBauen,
  erzeugeUndoStapel, erzeugeSpeicherWarteschlange, auszeichnungsHtml,
  FARBEN, FARBIGE_TYPEN,
} from '/assets/block-modell.js';

const esc = (s) => (window.mm ? window.mm.esc(s) : String(s ?? ''));
const neuerSchluessel = () => (crypto.randomUUID ? crypto.randomUUID()
  : 'k-' + Date.now() + '-' + Math.random().toString(36).slice(2));

export function mountBlockEditor(wurzel, {
  seiteId, anfangsBloecke, api, statusEl, fremdWiederholen = null,
}) {
  const zustand = {
    bloecke: (anfangsBloecke || []).slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(b => ({ clientKey: neuerSchluessel(), ...b })),
    slash: null,
  };
  const warteschlangen = new Map();      // clientKey -> Speicher-Warteschlange
  const undo = erzeugeUndoStapel(30);
  let aktiveSchreibvorgaenge = 0;
  let fremdeSchreibvorgaenge = 0;        // von admin.js gemeldet (Seiten-Felder)
  let fremdFehler = false;

  /* ---------- "gespeichert"-Anzeige ----------
     Ein einziger Ort, der die Anzeige beschreibt. Sonst überschreibt die
     eine Quelle (Blöcke) die Meldung der anderen (Seiten-Felder) und ein
     Fehlerhinweis verschwindet, kaum dass er dasteht. */
  function fehlerOffen() {
    if (fremdFehler) return true;
    for (const q of warteschlangen.values()) if (q.hatFehler && q.hatFehler()) return true;
    return false;
  }
  function statusAktualisieren() {
    if (!statusEl) return;
    if (fehlerOffen()) {
      statusEl.textContent = 'nicht gespeichert — klicken zum Wiederholen';
      statusEl.classList.add('status-fehler');
      statusEl.setAttribute('title', 'Der letzte Stand kam nicht an. Klicken schickt ihn erneut los.');
      return;
    }
    statusEl.classList.remove('status-fehler');
    statusEl.removeAttribute('title');
    statusEl.textContent = (aktiveSchreibvorgaenge + fremdeSchreibvorgaenge) > 0
      ? 'speichert…'
      : 'gespeichert ' + new Date().toLocaleTimeString('de-DE');
  }
  function allesWiederholen() {
    let etwas = false;
    for (const q of warteschlangen.values()) if (q.wiederholen && q.wiederholen()) etwas = true;
    if (fremdWiederholen && fremdWiederholen()) etwas = true;
    if (etwas) statusAktualisieren();
    return etwas;
  }
  if (statusEl) statusEl.addEventListener('click', () => { if (fehlerOffen()) allesWiederholen(); });

  /* ---------- Speichern je Block ---------- */
  function basisEntwurf(b) {
    return {
      seite_id: seiteId, typ: b.typ, inhalt: b.inhalt, breite: b.breite,
      bewegung: b.bewegung, notiz: b.notiz || null, sort_order: b.sort_order,
    };
  }
  function warteschlangeFuer(b) {
    if (warteschlangen.has(b.clientKey)) return warteschlangen.get(b.clientKey);
    const schreiben = async (daten) => {
      aktiveSchreibvorgaenge++; statusAktualisieren();
      try {
        if (daten && daten.__geloescht) {
          if (b.id) await api.loeschen(b.id);
          return;
        }
        if (b.id) await api.aktualisieren(b.id, daten);
        else {
          const erstellt = await api.neu({ ...basisEntwurf(b), ...daten });
          b.id = erstellt.id;
        }
      } finally {
        aktiveSchreibvorgaenge--; statusAktualisieren();
      }
    };
    /* Mit Fehlerbehandlung: ein gescheiterter Stand bleibt liegen, statt
       still zu verschwinden (siehe erzeugeSpeicherWarteschlange). */
    const q = erzeugeSpeicherWarteschlange(schreiben, () => statusAktualisieren());
    warteschlangen.set(b.clientKey, q);
    return q;
  }
  function blockSpeichern(b) {
    warteschlangeFuer(b).anstossen({
      /* `typ` MUSS mit: Ein Block kann seine Art nachtraeglich aendern --
         ueber das "/"-Menue, beim Aufteilen eines Artikels, beim Einfuegen
         eines Bildes in einen leeren Textblock. Ohne diese Zeile blieb die
         Aenderung nur im Fenster stehen und die Datenbank behielt die alte
         Art.
         Lange unbemerkt, weil es fuer die meisten Arten folgenlos war: Ein
         Textblock mit "## Titel" oder "![](…)" darin wird vom Umsetzer
         ohnehin als Ueberschrift bzw. Bild dargestellt. Erst bei Kasten und
         Zitat faellt es auf -- deren Aussehen haengt wirklich an der Art,
         und die kamen auf der Seite als schlichter (eingefaerbter) Text an.
         Die alte Pruefung sah es nicht, weil sie nur den Zustand im
         Fenster verglich, nicht den in der Datenbank. */
      typ: b.typ,
      /* "bewegung" steht hier ABSICHTLICH nicht. Die Seite animiert seit
         dem Umbau alles von selbst beim Scrollen (assets/bewegung.css), das
         Feld gibt es im Menue nicht mehr -- wir aendern den Wert also nie und
         schicken ihn deshalb auch nicht mit. Das ist das GEGENTEIL des
         "typ"-Fehlers darueber: dort wurde ein Wert geaendert und nicht
         geschickt, hier wird er nie geaendert. */
      inhalt: b.inhalt, breite: b.breite,
      notiz: b.notiz || null, sort_order: b.sort_order,
    });
  }

  const entprellungen = new Map();   // clientKey -> Zeitgeber-id ODER null
  function blockSpeichernEntprellt(b, verzoegerungMs = 500) {
    clearTimeout(entprellungen.get(b.clientKey));
    entprellungen.set(b.clientKey, setTimeout(() => {
      entprellungen.set(b.clientKey, null);
      blockSpeichern(b);
    }, verzoegerungMs));
  }
  function blockLoeschenSpeichern(b) {
    clearTimeout(entprellungen.get(b.clientKey));
    entprellungen.set(b.clientKey, null);
    warteschlangeFuer(b).anstossen({ __geloescht: true });
  }

  /* ---------- Beim Verlassen: Ausstehendes SOFORT rausschreiben ----------
     Dieselbe Falle wie früher bei den Seiten-Feldern: Wer tippt und sofort
     "Zurück" drückt, verlöre alles, was innerhalb der 500 ms Entprellung
     entstanden ist -- zerstoeren() hätte den Zeitgeber einfach gekappt. */
  function flush() {
    let etwas = false;
    entprellungen.forEach((t, key) => {
      if (!t) return;
      clearTimeout(t); entprellungen.set(key, null);
      const b = zustand.bloecke.find(x => x.clientKey === key);
      if (b) { blockSpeichern(b); etwas = true; }
    });
    return etwas;
  }
  function beschaeftigt() {
    for (const q of warteschlangen.values()) if (q.beschaeftigt()) return true;
    return false;
  }

  /* ---------- Rückgängig ---------- */
  function momentaufnahme() {
    return zustand.bloecke.map(b => ({ ...b, inhalt: JSON.parse(JSON.stringify(b.inhalt)) }));
  }
  function vorMutationMerken() { undo.merken(momentaufnahme()); }

  /* ---------- Rendern ---------- */
  function liste() { return wurzel.querySelector('.be-liste'); }
  function zeileVon(b) { return wurzel.querySelector(`.be-zeile[data-key="${b.clientKey}"]`); }

  function neuZeichnen() {
    const alt = liste();
    const neu = document.createElement('ul');
    neu.className = 'be-liste';
    zustand.bloecke.forEach(b => neu.appendChild(zeileBauen(b)));
    alt.replaceWith(neu);
    verdrahteListe();
  }

  /* Nur EINE Zeile neu -- nach Strukturänderungen (Größe, Ebene, Upload …).
     Ein offenes "⋯"-Menü bleibt offen: sonst klappt es beim Ändern der
     Breite zu und man kommt nicht direkt zur Farbe darunter. */
  function ersetzeZeile(b) {
    const alt = zeileVon(b);
    if (!alt) return neuZeichnen();
    const menuWarOffen = alt.querySelector('.be-menu') && !alt.querySelector('.be-menu').hidden;
    alt.replaceWith(zeileBauen(b));
    if (menuWarOffen) {
      const m = zeileVon(b)?.querySelector('.be-menu');
      if (m) m.hidden = false;
    }
  }

  /* Eine EINZELNE neue Zeile einhängen, statt die ganze Liste neu zu bauen.
     Wichtig gegen flackernde Videos: neuZeichnen() baut jedes <iframe> neu
     auf, ein Enter mitten im Text würde also alle Videos der Seite neu
     laden. `nach` fehlt nur beim Knopf ganz unten -- dort ist Anhängen
     richtig; bei Enter und Duplizieren muss die Zeile an die STELLE des
     Bezugsblocks, sonst laufen Datenmodell und Anzeige auseinander. */
  function zeileEinfuegen(b, { nach = null } = {}) {
    const el = zeileBauen(b);
    const bezug = nach && nach.isConnected ? nach : null;
    if (bezug) bezug.after(el); else liste().appendChild(el);
    return el;
  }

  function typLabel(typ) { return (BLOCKARTEN_NACH_TYP[typ] || {}).label || typ; }

  /* Öffentliche Sicht eines Blocks -- OHNE notiz, niemals. Der Umsetzer
     bekommt das Feld gar nicht erst zu sehen; es kann deshalb auch bei
     einem Fehler im Umsetzer nicht im HTML auftauchen. */
  function oeffentlich(b) {
    return {
      typ: b.typ, inhalt: b.inhalt,
      breite: b.breite || 'normal',
    };
  }
  function renderHtml(b) {
    if (!window.mmBloecke) return '';
    try { return window.mmBloecke.seite([oeffentlich(b)]) || ''; } catch (_) { return ''; }
  }
  function nachAktivieren(el) {
    try { if (window.mmInhalt) window.mmInhalt(el); } catch (_) {}
  }

  function autoWachsen(ta) {
    const h = () => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; };
    ta.addEventListener('input', h);
    requestAnimationFrame(h);
    return h;
  }

  /* Die eingefärbte Schicht hinter dem durchscheinenden Textfeld.
     Das abschließende "\n" sorgt dafür, dass eine leere letzte Zeile
     genauso hoch ist wie im Textfeld. */
  function highlightAnbinden(ta) {
    const hl = ta.parentElement.querySelector('.be-highlight');
    if (!hl) return;
    const sync = () => { hl.innerHTML = auszeichnungsHtml(ta.value) + '\n'; };
    sync();
    ta.addEventListener('input', sync);
    ta.addEventListener('scroll', () => { hl.scrollTop = ta.scrollTop; });
  }

  /* ---------- Textfeld mit "/", Enter/Rücktaste, Auswahl-Leiste ---------- */
  function textFeldBauen(b, wert, aufAenderung,
    { mehrzeilig = true, platzhalter = '', klasse = 'be-text' } = {}) {
    const ta = document.createElement('textarea');
    ta.className = klasse; ta.value = wert; ta.rows = 1; ta.placeholder = platzhalter;
    ta.dataset.key = b.clientKey;
    autoWachsen(ta);

    ta.addEventListener('input', () => {
      if (ta.value === '/') { slashOeffnen(b, ta.parentElement); return; }
      if (zustand.slash && zustand.slash.clientKey === b.clientKey) {
        if (ta.value.startsWith('/')) slashFilternAuf(ta.value.slice(1));
        else slashSchliessen();
      }
      aufAenderung(ta.value);
    });

    ta.addEventListener('keydown', (e) => {
      if (zustand.slash && zustand.slash.clientKey === b.clientKey) {
        if (e.key === 'Escape') {
          e.preventDefault(); ta.value = ''; aufAenderung(''); slashSchliessen(); return;
        }
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter') {
          e.preventDefault(); slashTaste(e.key); return;
        }
      }
      if (e.key === 'Enter' && (!mehrzeilig || !e.shiftKey)) {
        e.preventDefault();
        vorMutationMerken();
        const bezug = zeileVon(b);
        const neuerBlock = blockEinfuegenNach(b, 'text');
        zeileEinfuegen(neuerBlock, { nach: bezug });
        fokussiere(neuerBlock.clientKey);
        return;
      }
      if (e.key === 'Backspace' && ta.value === '' && ta.selectionStart === 0) {
        if (zustand.bloecke.length <= 1) return;
        e.preventDefault();
        vorMutationMerken();
        const vorheriger = blockLoeschen(b);
        const weg = zeileVon(b);
        if (weg) weg.remove(); else neuZeichnen();
        if (vorheriger) fokussiere(vorheriger.clientKey, { ansEnde: true });
      }
    });

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
    const alt = wurzel.querySelector('.be-slash');
    if (alt) alt.remove();
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
    const s = zustand.slash;
    if (!s) return;
    const b = zustand.bloecke.find(x => x.clientKey === s.clientKey);
    slashSchliessen();
    if (!b) return;
    vorMutationMerken();
    b.typ = typ; b.inhalt = leererInhalt(typ);
    blockSpeichern(b);
    ersetzeZeile(b);          // nur diese eine Zeile -- schont fremde Videos
    fokussiere(b.clientKey);
  }
  function slashZeichnen(ankerEl) {
    let el = wurzel.querySelector('.be-slash');
    if (!el) {
      el = document.createElement('div'); el.className = 'be-slash';
      if (ankerEl && ankerEl.after) ankerEl.after(el); else wurzel.appendChild(el);
    }
    const s = zustand.slash;
    el.innerHTML = s.treffer.length
      ? s.treffer.map((blk, i) => `<button type="button" class="be-slash-eintrag${i === s.auswahl ? ' be-slash-aktiv' : ''}" data-typ="${blk.typ}"><span class="be-slash-icon">${esc(blk.icon)}</span>${esc(blk.label)}</button>`).join('')
      : '<p class="be-slash-leer">Keine Blockart gefunden.</p>';
    el.querySelectorAll('[data-typ]').forEach(btn =>
      btn.addEventListener('mousedown', (e) => { e.preventDefault(); slashAuswaehlen(btn.dataset.typ); }));
  }

  /* ---------- Auswahl-Leiste (fett, kursiv, Link, Türchen) ---------- */
  function formatLeisteVerbergen() {
    const el = wurzel.querySelector('.be-format');
    if (el) el.remove();
  }
  function kleinerDialog({ titel, hinweis = '', felder }) {
    return new Promise((loese) => {
      const hg = document.createElement('div'); hg.className = 'mini-hg';
      hg.innerHTML = `<form class="mini-box">
        <h3>${esc(titel)}</h3>
        ${felder.map(f => `<label>${esc(f.label)}
          <input name="${esc(f.name)}" placeholder="${esc(f.platzhalter || '')}"
            value="${esc(f.wert || '')}"${f.pflicht ? ' required' : ''}></label>`).join('')}
        ${hinweis ? `<p class="klein grau">${esc(hinweis)}</p>` : ''}
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

  /* ---------- Einen Textblock in echte Blöcke zerlegen ----------
     Wer einen ganzen Artikel aus einem anderen Programm einfügt, hat
     Überschriften, Trennstriche und Bilder als Markdown-Zeichen im Text --
     "### Titel", "---", "![](…)". Auf der öffentlichen Seite ist das
     richtig (renderMarkdown versteht alles davon), im Editor sieht man
     aber nur die Zeichen: Die Schreibfläche kann nur die Auszeichnungen
     INNERHALB eines Blocks darstellen, nicht ganze Blockarten.

     splitBlocks() aus shared.js kennt genau diese Grenzen -- es ist
     dieselbe Funktion, die beim Umzug aus den alten Tabellen alle heutigen
     Blöcke erzeugt hat, und ihre Verlustfreiheit ist bewiesen
     (tests/pruefe-umzug.mjs). */
  function teileVon(roh) {
    if (!window.mm || !window.mm.splitBlocks) return [];
    try { return window.mm.splitBlocks(String(roh || '')) || []; } catch (_) { return []; }
  }
  function laesstSichAufteilen(b) {
    if (b.typ !== 'text') return false;
    const teile = teileVon(b.inhalt && b.inhalt.roh);
    return teile.length > 1 || (teile.length === 1 && teile[0].typ !== 'text');
  }
  function aufteilen(b, roh) {
    const teile = teileVon(roh);
    if (!teile.length) return false;
    if (teile.length === 1 && teile[0].typ === 'text') return false;
    vorMutationMerken();
    b.typ = teile[0].typ;
    b.inhalt = { roh: teile[0].roh };
    blockSpeichern(b);
    let vorheriger = b;
    for (const teil of teile.slice(1)) {
      const nb = blockEinfuegenNach(vorheriger, teil.typ);
      nb.inhalt = { roh: teil.roh };
      blockSpeichern(nb);
      vorheriger = nb;
    }
    neuZeichnen();
    return true;
  }

  /* ---------- Einfügen / löschen / duplizieren ---------- */
  function neuerBlockDatensatz(typ, davor, danach) {
    return {
      clientKey: neuerSchluessel(), id: null, seite_id: seiteId, typ,
      inhalt: leererInhalt(typ), breite: 'normal', bewegung: 'keine', notiz: '',
      sort_order: naechsteSortierung(davor, danach),
    };
  }
  function blockEinfuegenNach(nachB, typ) {
    const idx = zustand.bloecke.findIndex(x => x.clientKey === nachB.clientKey);
    const danach = zustand.bloecke[idx + 1];
    const neu = neuerBlockDatensatz(typ, nachB.sort_order, danach ? danach.sort_order : null);
    zustand.bloecke.splice(idx + 1, 0, neu);
    blockSpeichern(neu);
    return neu;
  }
  function blockAmEndeEinfuegen(typ) {
    const letzter = zustand.bloecke[zustand.bloecke.length - 1];
    const neu = neuerBlockDatensatz(typ, letzter ? letzter.sort_order : null, null);
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
    const kopie = neuerBlockDatensatz(b.typ, b.sort_order, danach ? danach.sort_order : null);
    kopie.inhalt = JSON.parse(JSON.stringify(b.inhalt));
    kopie.breite = b.breite; kopie.bewegung = b.bewegung; kopie.notiz = b.notiz || '';
    zustand.bloecke.splice(idx + 1, 0, kopie);
    blockSpeichern(kopie);
    return kopie;
  }
  function fokussiere(clientKey, { ansEnde = false } = {}) {
    const el = wurzel.querySelector(`[data-fokus="${clientKey}"]`)
      || wurzel.querySelector(`[data-key="${clientKey}"]`);
    if (!el || !el.focus) return;
    el.focus();
    if (ansEnde && el.setSelectionRange) el.setSelectionRange(el.value.length, el.value.length);
  }

  /* ---------- Bild-Bedienung (Upload, Alt-Text, Größe) ---------- */
  function bildSteuerungBauen(b, bilder, { beiAlt, beiStruktur }) {
    const wrap = document.createElement('div'); wrap.className = 'be-bilder';
    const zeichnen = () => {
      wrap.innerHTML = '';
      bilder.forEach((bild, i) => {
        const row = document.createElement('div'); row.className = 'be-bild-zeile';
        row.innerHTML = `
          ${bild.url ? `<img class="be-bild-vorschau" src="${esc(bild.url)}" alt="">` : '<div class="be-bild-vorschau be-bild-leer">kein Bild</div>'}
          <input class="be-bild-alt" placeholder="Alt-Text (Bildunterschrift / für Sehbehinderte)" value="${esc(bild.alt || '')}">
          <select class="be-bild-groesse" aria-label="Bildgröße">
            <option value="gross"${bild.groesse !== 'mittel' && bild.groesse !== 'klein' ? ' selected' : ''}>groß</option>
            <option value="mittel"${bild.groesse === 'mittel' ? ' selected' : ''}>mittel</option>
            <option value="klein"${bild.groesse === 'klein' ? ' selected' : ''}>klein</option>
          </select>
          <button type="button" class="btn ghost be-bild-ersetzen">Bild wählen</button>
          <button type="button" class="btn ghost be-bild-weg" title="Entfernen">×</button>
          <input type="file" class="be-bild-datei" accept="image/*,image/gif" hidden>`;
        row.querySelector('.be-bild-alt').addEventListener('input', (e) => {
          bild.alt = e.target.value;
          b.inhalt.roh = bildZeilenBauen(bilder);
          blockSpeichernEntprellt(b);
          beiAlt(bild);
        });
        row.querySelector('.be-bild-groesse').addEventListener('change', (e) => {
          bild.groesse = e.target.value;
          b.inhalt.roh = bildZeilenBauen(bilder);
          blockSpeichern(b); beiStruktur();
        });
        row.querySelector('.be-bild-weg').addEventListener('click', () => {
          bilder.splice(i, 1);
          b.inhalt.roh = bildZeilenBauen(bilder);
          blockSpeichern(b); beiStruktur();
        });
        row.querySelector('.be-bild-ersetzen')
          .addEventListener('click', () => row.querySelector('.be-bild-datei').click());
        row.querySelector('.be-bild-datei').addEventListener('change', async (e) => {
          const datei = e.target.files[0]; e.target.value = '';
          if (!datei) return;
          const r = await api.bildHochladen(datei);
          if (r && r.url) {
            bild.url = r.url;
            if (!bild.groesse) bild.groesse = 'gross';
            b.inhalt.roh = bildZeilenBauen(bilder);
            blockSpeichern(b); beiStruktur();
          }
        });
        wrap.appendChild(row);
      });
      /* "+ Bild" oeffnet SOFORT die Dateiauswahl, statt erst eine leere
         Zeile anzulegen. Der alte Weg schrieb "![]()"  in den Text -- und
         das laesst sich nicht wieder einlesen (bildZeilenLesen verlangt
         eine Adresse). Die leere Zeile verschwand beim naechsten Aufbau
         also wieder, das "![]()" blieb als sichtbarer Text stehen und
         waere so auf der oeffentlichen Seite gelandet.
         Jetzt entsteht ein Eintrag erst, wenn wirklich ein Bild da ist. */
      const knopf = document.createElement('button');
      knopf.type = 'button'; knopf.className = 'btn ghost be-bild-neu'; knopf.textContent = '+ Bild';
      const auswahl = document.createElement('input');
      auswahl.type = 'file'; auswahl.accept = 'image/*,image/gif';
      auswahl.multiple = true; auswahl.hidden = true;
      auswahl.className = 'be-bild-neu-datei';
      knopf.addEventListener('click', () => auswahl.click());
      auswahl.addEventListener('change', async (e) => {
        const dateien = [...e.target.files]; e.target.value = '';
        if (!dateien.length) return;
        knopf.disabled = true; knopf.textContent = 'lädt…';
        let neue = 0;
        for (const datei of dateien) {
          const r = await api.bildHochladen(datei);
          if (r && r.url) { bilder.push({ alt: '', url: r.url, groesse: 'gross' }); neue++; }
        }
        knopf.disabled = false; knopf.textContent = '+ Bild';
        if (!neue) return;
        b.inhalt.roh = bildZeilenBauen(bilder);
        blockSpeichern(b);
        zeichnen(); beiStruktur();
      });
      wrap.append(knopf, auswahl);
    };
    zeichnen();
    return wrap;
  }
  /* Alt-Text in der fertigen Darstellung mitziehen, ohne sie neu zu bauen. */
  function altInDarstellungPatchen(darstellung, alt) {
    if (!darstellung) return;
    darstellung.querySelectorAll('img').forEach(img => img.setAttribute('alt', alt));
    darstellung.querySelectorAll('figcaption').forEach(fc => { fc.textContent = alt; });
  }

  /* ---------- Der Inhalt eines Blocks ---------- */
  function feldInhaltBauen(b) {
    const inhaltDiv = document.createElement('div'); inhaltDiv.className = 'be-inhalt';

    /* Fertig dargestellt + Bedienung, die erst bei Annäherung erscheint.
       `leer` heißt: noch nichts da, dann muss die Bedienung sichtbar
       bleiben -- sonst sieht man bei einem frischen Block gar nichts. */
    const medienGeruest = (leer) => {
      const darstellung = document.createElement('div');
      darstellung.className = 'be-vorschau-html prose';
      darstellung.innerHTML = renderHtml(b);
      nachAktivieren(darstellung);
      const steuerung = document.createElement('div');
      steuerung.className = 'be-medien-steuerung' + (leer ? ' leer' : '');
      inhaltDiv.append(darstellung, steuerung);
      return { darstellung, steuerung };
    };

    const textFlaeche = (wert, aufAenderung, platzhalter) => {
      const wrap = document.createElement('div'); wrap.className = 'be-text-wrap';
      const hl = document.createElement('div'); hl.className = 'be-highlight';
      hl.setAttribute('aria-hidden', 'true');
      const ta = textFeldBauen(b, wert, aufAenderung, { mehrzeilig: true, platzhalter });
      ta.dataset.fokus = b.clientKey;
      wrap.append(hl, ta);
      return { wrap, ta };
    };

    switch (b.typ) {
      case 'text': {
        const { wrap, ta } = textFlaeche(b.inhalt.roh || '',
          (wert) => { b.inhalt.roh = wert; blockSpeichernEntprellt(b); },
          'Schreib los — „/" öffnet die Blockauswahl.');
        ta.setAttribute('aria-label', 'Textblock');
        inhaltDiv.appendChild(wrap);
        highlightAnbinden(ta);
        return inhaltDiv;
      }
      case 'ueberschrift': {
        const { ebene, text } = ueberschriftLesen(b.inhalt.roh);
        const wrap = document.createElement('div'); wrap.className = 'be-ueberschrift-wrap';
        const ebeneWahl = document.createElement('select');
        ebeneWahl.className = 'be-ebene';
        ebeneWahl.setAttribute('aria-label', 'Überschriftengröße');
        ebeneWahl.innerHTML = `<option value="2"${ebene === 2 ? ' selected' : ''}>groß</option><option value="3"${ebene === 3 ? ' selected' : ''}>klein</option>`;
        const ta = textFeldBauen(b, text, (wert) => {
          b.inhalt.roh = ueberschriftBauen(+ebeneWahl.value, wert);
          blockSpeichernEntprellt(b);
        }, { mehrzeilig: false, platzhalter: 'Überschrift', klasse: 'be-ueberschrift' });
        ta.dataset.ebene = String(ebene);
        ta.dataset.fokus = b.clientKey;
        ta.setAttribute('aria-label', 'Überschrift');
        ebeneWahl.addEventListener('change', () => {
          ta.dataset.ebene = ebeneWahl.value;
          b.inhalt.roh = ueberschriftBauen(+ebeneWahl.value, ueberschriftLesen(b.inhalt.roh).text);
          blockSpeichern(b);
        });
        wrap.append(ebeneWahl, ta);
        inhaltDiv.appendChild(wrap);
        return inhaltDiv;
      }
      case 'kasten':
      case 'zitat': {
        /* Beide sehen im Editor schon aus wie das Ergebnis: der Kasten mit
           seinem hellen Grund, das Zitat mit dem farbigen Balken links.
           Innen liegt dieselbe durchscheinende Schreibflaeche wie beim
           Textblock -- fett, kursiv, Links und Tuerchen wirken also auch
           hier. */
        const huelle = document.createElement('div');
        huelle.className = (b.typ === 'kasten' ? 'mm-kasten' : 'mm-zitat') + ' be-huelle';
        if (b.inhalt.farbe) huelle.classList.add('mm-farbe-' + b.inhalt.farbe);
        const { wrap, ta } = textFlaeche(b.inhalt.roh || '',
          (wert) => { b.inhalt.roh = wert; blockSpeichernEntprellt(b); },
          b.typ === 'kasten' ? 'Was in den Kasten soll.' : 'Das Zitat.');
        ta.setAttribute('aria-label', b.typ === 'kasten' ? 'Kasten' : 'Zitat');
        huelle.appendChild(wrap);
        inhaltDiv.appendChild(huelle);
        highlightAnbinden(ta);
        return inhaltDiv;
      }
      case 'randnotiz': {
        const wrap = document.createElement('div'); wrap.className = 'be-randnotiz';
        wrap.innerHTML = `
          <input class="be-rn-titel" placeholder="Titel" value="${esc(b.inhalt.titel || '')}">
          <input class="be-rn-z1" placeholder="Zeile 1" value="${esc(b.inhalt.zeile1 || '')}">
          <input class="be-rn-z2" placeholder="Zeile 2 (optional)" value="${esc(b.inhalt.zeile2 || '')}">
          <label class="schalter"><input type="checkbox" class="be-rn-punkt"${b.inhalt.punkt ? ' checked' : ''}> grüner Punkt davor</label>`;
        const aendern = (patch, sofort) => {
          Object.assign(b.inhalt, patch);
          if (sofort) blockSpeichern(b); else blockSpeichernEntprellt(b);
        };
        wrap.querySelector('.be-rn-titel').addEventListener('input', (e) => aendern({ titel: e.target.value }));
        wrap.querySelector('.be-rn-z1').addEventListener('input', (e) => aendern({ zeile1: e.target.value }));
        wrap.querySelector('.be-rn-z2').addEventListener('input', (e) => aendern({ zeile2: e.target.value }));
        wrap.querySelector('.be-rn-punkt').addEventListener('change', (e) => aendern({ punkt: e.target.checked }, true));
        inhaltDiv.appendChild(wrap);
        return inhaltDiv;
      }
      case 'code': {
        const { sprache, code } = codeLesen(b.inhalt.roh);
        const wrap = document.createElement('div'); wrap.className = 'be-code';
        const sprachWahl = document.createElement('select');
        sprachWahl.className = 'be-code-sprache';
        sprachWahl.setAttribute('aria-label', 'Sprache');
        sprachWahl.innerHTML = ['', 'js', 'swift', 'bash', 'json', 'csv']
          .map(sp => `<option value="${sp}"${sprache === sp ? ' selected' : ''}>${sp || 'einfacher Text'}</option>`).join('');
        const ta = document.createElement('textarea');
        ta.className = 'be-code-text'; ta.rows = 4; ta.value = code;
        ta.dataset.fokus = b.clientKey;
        ta.setAttribute('aria-label', 'Code');
        autoWachsen(ta);
        sprachWahl.addEventListener('change', () => {
          b.inhalt.roh = codeBauen(sprachWahl.value, ta.value); blockSpeichern(b);
        });
        ta.addEventListener('input', () => {
          b.inhalt.roh = codeBauen(sprachWahl.value, ta.value); blockSpeichernEntprellt(b);
        });
        wrap.append(sprachWahl, ta);
        inhaltDiv.appendChild(wrap);
        return inhaltDiv;
      }
      case 'bild': {
        const bilder = bildZeilenLesen(b.inhalt.roh);
        const { darstellung, steuerung } = medienGeruest(bilder.length === 0);
        steuerung.appendChild(bildSteuerungBauen(b, bilder, {
          beiAlt: (bild) => altInDarstellungPatchen(darstellung, bild.alt),
          beiStruktur: () => ersetzeZeile(b),
        }));
        return inhaltDiv;
      }
      case 'gif': {
        const m = String(b.inhalt.roh || '').match(/^!\[([^\]]*)\]\(([^)\s]+)\)/);
        const url = m ? m[2] : '';
        const { darstellung, steuerung } = medienGeruest(!url);
        const wrap = document.createElement('div'); wrap.className = 'be-gif';
        wrap.innerHTML = `
          <input class="be-gif-alt" placeholder="Alt-Text" value="${esc(m ? m[1] : '')}">
          <button type="button" class="btn ghost">GIF wählen</button>
          <input type="file" accept="image/gif,image/apng,image/webp" hidden>
          <p class="klein grau">GIFs werden NICHT verkleinert — sonst bliebe nur das erste Einzelbild übrig.</p>`;
        wrap.querySelector('input[type=file]').addEventListener('change', async (e) => {
          const datei = e.target.files[0]; e.target.value = '';
          if (!datei) return;
          const r = await api.bildHochladen(datei);
          if (r && r.url) {
            b.inhalt.roh = `![${wrap.querySelector('.be-gif-alt').value}](${r.url})`;
            blockSpeichern(b); ersetzeZeile(b);
          }
        });
        wrap.querySelector('.be-gif-alt').addEventListener('input', (e) => {
          const neuAlt = e.target.value;
          const mm = String(b.inhalt.roh || '').match(/^!\[([^\]]*)\]\(([^)\s]+)\)/);
          b.inhalt.roh = `![${neuAlt}](${mm ? mm[2] : ''})`;
          blockSpeichernEntprellt(b);
          altInDarstellungPatchen(darstellung, neuAlt);
        });
        wrap.querySelector('button').addEventListener('click',
          () => wrap.querySelector('input[type=file]').click());
        steuerung.appendChild(wrap);
        return inhaltDiv;
      }
      case 'video': {
        const url = String(b.inhalt.roh || '').trim();
        const { steuerung } = medienGeruest(!url);
        const wrap = document.createElement('div'); wrap.className = 'be-video';
        const input = document.createElement('input');
        input.className = 'be-video-url';
        input.placeholder = 'https://youtu.be/… oder https://vimeo.com/…';
        input.value = b.inhalt.roh || '';
        const hinweis = document.createElement('p');
        hinweis.className = 'klein grau be-video-hinweis';
        const pruefen = () => {
          const v = window.mm && window.mm.videoEmbed(input.value);
          hinweis.textContent = !input.value ? ''
            : v ? 'Erkannt: ' + v.kind : 'Kein YouTube- oder Vimeo-Link erkannt.';
        };
        pruefen();
        input.addEventListener('input', () => {
          b.inhalt.roh = input.value; pruefen(); blockSpeichernEntprellt(b);
        });
        /* Erst beim Verlassen neu darstellen -- sonst würde bei jedem
           Tastendruck ein <iframe> neu aufgebaut und das Tippen stottert. */
        input.addEventListener('blur', () => ersetzeZeile(b));
        wrap.append(input, hinweis);
        steuerung.appendChild(wrap);
        return inhaltDiv;
      }
      case 'werkzeug': {
        const { kennung } = werkzeugLesen(b.inhalt.roh);
        const { steuerung } = medienGeruest(!kennung);
        const input = document.createElement('input');
        input.className = 'be-werkzeug';
        input.placeholder = 'Kennung der Einlage, z. B. the-race';
        input.value = kennung;
        input.addEventListener('input', () => {
          b.inhalt.roh = werkzeugBauen(input.value); blockSpeichernEntprellt(b);
        });
        input.addEventListener('blur', () => ersetzeZeile(b));
        steuerung.appendChild(input);
        return inhaltDiv;
      }
      case 'trenner': {
        medienGeruest(false);
        return inhaltDiv;
      }
      case 'tuer': {
        const leer = !(b.inhalt.text || '').trim() && !(b.inhalt.ziel || '').trim();
        const { darstellung, steuerung } = medienGeruest(leer);
        const wrap = document.createElement('div'); wrap.className = 'be-tuer';
        wrap.innerHTML = `
          <input class="be-tuer-text" placeholder="Beschriftung, z. B. „Auf YouTube ansehen“" value="${esc(b.inhalt.text || '')}">
          <input class="be-tuer-ziel" placeholder="Adresse oder /welt/…" value="${esc(b.inhalt.ziel || '')}">`;
        wrap.querySelector('.be-tuer-text').addEventListener('input', (e) => {
          b.inhalt.text = e.target.value;
          blockSpeichernEntprellt(b);
          const el = darstellung.querySelector('a, button');
          if (el) el.textContent = b.inhalt.text || '';
        });
        wrap.querySelector('.be-tuer-ziel').addEventListener('input', (e) => {
          b.inhalt.ziel = e.target.value; blockSpeichernEntprellt(b);
        });
        wrap.querySelectorAll('input').forEach(i => i.addEventListener('blur', () => ersetzeZeile(b)));
        steuerung.appendChild(wrap);
        return inhaltDiv;
      }
      case 'abschnitt': {
        /* Ein Abschnitt hat mehr Felder, als frueher zu sehen waren: "rolle"
           entscheidet ueber die Sonderdarstellung im Brief, "zusatz" ist die
           farbig gesetzte zweite Zeile des Grusses ("Lucas :)") und "kicker"
           die kleine gesperrte Zeile darunter. Alle drei wurden vom Brief
           laengst gerendert, waren im Editor aber nirgends erreichbar --
           Lucas konnte seinen eigenen Namen auf der Startseite nicht
           aendern. */
        const rollen = [['', '— normaler Abschnitt'], ['hallo', 'Gruss (grosse Kopfzeile)'],
          ['profil', 'Profil'], ['kontakt', 'Kontakt (mit Formular)']];
        const wrap = document.createElement('div'); wrap.className = 'be-abschnitt';
        wrap.innerHTML = `
          <input class="be-ab-titel" placeholder="Titel des Abschnitts" value="${esc(b.inhalt.titel || '')}">
          <input class="be-ab-zusatz" placeholder="zweite Zeile, farbig (z. B. „Lucas :)“)" value="${esc(b.inhalt.zusatz || '')}">
          <span class="ab-zusatz">
            <select class="be-ab-rolle" aria-label="Rolle im Brief">
              ${rollen.map(([v, l]) => `<option value="${v}"${(b.inhalt.rolle || '') === v ? ' selected' : ''}>${l}</option>`).join('')}
            </select>
            <select class="be-ab-art" aria-label="Art des Abschnitts">
              <option value="beruflich"${b.inhalt.art === 'beruflich' ? ' selected' : ''}>beruflich</option>
              <option value="persoenlich"${b.inhalt.art === 'persoenlich' ? ' selected' : ''}>persönlich</option>
              <option value="kontakt"${b.inhalt.art === 'kontakt' ? ' selected' : ''}>kontakt</option>
            </select>
            <input type="text" class="be-ab-farbe" placeholder="#RRGGBB" value="${esc(b.inhalt.farbe || '')}" aria-label="Farbe">
            <input type="text" class="be-ab-kicker" placeholder="kleine Zeile darunter" value="${esc(b.inhalt.kicker || '')}" aria-label="Kleine Zeile">
          </span>`;
        const aendern = (patch, sofort) => {
          Object.assign(b.inhalt, patch);
          if (sofort) blockSpeichern(b); else blockSpeichernEntprellt(b);
        };
        const zusatzFeld = wrap.querySelector('.be-ab-zusatz');
        /* Die farbige Zeile gehoert nur zum Gruss -- bei allen anderen
           Rollen waere sie ein Feld ohne Wirkung. */
        const zusatzZeigen = () => {
          zusatzFeld.hidden = (b.inhalt.rolle || '') !== 'hallo';
        };
        zusatzZeigen();
        wrap.querySelector('.be-ab-titel').addEventListener('input', (e) => aendern({ titel: e.target.value }));
        zusatzFeld.addEventListener('input', (e) => aendern({ zusatz: e.target.value }));
        wrap.querySelector('.be-ab-kicker').addEventListener('input', (e) => aendern({ kicker: e.target.value }));
        wrap.querySelector('.be-ab-rolle').addEventListener('change', (e) => {
          aendern({ rolle: e.target.value || null }, true);
          zusatzZeigen();
        });
        wrap.querySelector('.be-ab-art').addEventListener('change', (e) => aendern({ art: e.target.value }, true));
        wrap.querySelector('.be-ab-farbe').addEventListener('input', (e) => aendern({ farbe: e.target.value || null }));
        inhaltDiv.appendChild(wrap);
        return inhaltDiv;
      }
      case 'text_mit_bild': {
        const gelesen = textMitBildLesen(b.inhalt.roh);
        const gitter = document.createElement('div'); gitter.className = 'tm-gitter';
        gitter.dataset.links = gelesen.bilderLinks ? '1' : '0';

        const textSeite = document.createElement('div'); textSeite.className = 'tm-text';
        const { wrap, ta } = textFlaeche(gelesen.text, (wert) => {
          gelesen.text = wert;
          b.inhalt.roh = textMitBildBauen(gelesen);
          blockSpeichernEntprellt(b);
        }, 'Der Text neben den Bildern.');
        textSeite.appendChild(wrap);

        const bildSeite = document.createElement('div');
        bildSeite.className = 'tm-bilder-seite be-vorschau-html prose';
        const bilderRendern = () => {
          bildSeite.innerHTML = renderHtml({
            typ: 'bild', inhalt: { roh: bildZeilenBauen(gelesen.bilder) },
            breite: 'normal', bewegung: 'keine',
          });
          nachAktivieren(bildSeite);
        };
        bilderRendern();

        const steuerung = document.createElement('div');
        steuerung.className = 'be-medien-steuerung' + (gelesen.bilder.length === 0 ? ' leer' : '');
        const schalter = document.createElement('label'); schalter.className = 'schalter';
        schalter.innerHTML = `<input type="checkbox"${gelesen.bilderLinks ? ' checked' : ''}> Bilder links statt rechts`;
        schalter.querySelector('input').addEventListener('change', (e) => {
          gelesen.bilderLinks = e.target.checked;
          b.inhalt.roh = textMitBildBauen(gelesen);
          blockSpeichern(b);
          gitter.dataset.links = gelesen.bilderLinks ? '1' : '0';   // ohne Neuaufbau
        });
        steuerung.appendChild(schalter);
        steuerung.appendChild(bildSteuerungBauen(b, gelesen.bilder, {
          beiAlt: (bild) => altInDarstellungPatchen(bildSeite, bild.alt),
          beiStruktur: () => { b.inhalt.roh = textMitBildBauen(gelesen); bilderRendern(); },
        }));

        gitter.append(textSeite, bildSeite);
        inhaltDiv.append(gitter, steuerung);
        highlightAnbinden(ta);
        return inhaltDiv;
      }
      default:
        return inhaltDiv;
    }
  }

  /* ---------- Eine Blockzeile ---------- */
  function zeileBauen(b) {
    const li = document.createElement('li');
    li.className = 'be-zeile';
    li.dataset.key = b.clientKey; li.dataset.typ = b.typ;
    /* draggable erst beim Anfassen des Griffs: ein dauerhaft ziehbares
       Elternelement macht das Markieren von Text in den Feldern darin
       unzuverlässig. */
    li.draggable = false;

    const rail = document.createElement('div'); rail.className = 'be-rail';
    const marke = document.createElement('span');
    marke.className = 'be-notiz-marke';
    marke.hidden = !b.notiz;
    marke.title = 'Dieser Block hat eine Notiz an Claude';
    const griff = document.createElement('button');
    griff.type = 'button'; griff.className = 'be-griff';
    griff.title = 'Zum Umsortieren ziehen'; griff.textContent = '⠿';
    griff.addEventListener('mousedown', () => { li.draggable = true; });
    const menueKnopf = document.createElement('button');
    menueKnopf.type = 'button'; menueKnopf.className = 'be-menu-knopf';
    menueKnopf.title = `${typLabel(b.typ)} — Einstellungen`;
    menueKnopf.textContent = '⋯';
    rail.append(marke, griff, menueKnopf);
    li.appendChild(rail);

    li.appendChild(feldInhaltBauen(b));

    /* Alle Einstellungen des Blocks an EINEM Ort. */
    const menu = document.createElement('div'); menu.className = 'be-menu'; menu.hidden = true;
    const auswahl = (klasse, beschriftung, werte, jetzt) => `<label>${beschriftung}
      <select class="${klasse}">${werte.map(p => {
    const [v, l] = p.split('|');
    return `<option value="${v}"${jetzt === v ? ' selected' : ''}>${l}</option>`;
  }).join('')}</select></label>`;
    menu.innerHTML = `
      ${auswahl('be-breite', 'Breite',
    ['schmal|Schmal', 'normal|Normal', 'randnotiz|Randnotiz (am Rand)', 'voll|Volle Breite'], b.breite)}
      ${FARBIGE_TYPEN.includes(b.typ) ? `<label>Farbe
        <span class="be-farben">${FARBEN.map(f => `
          <button type="button" class="be-farbe${(b.inhalt.farbe || '') === f.wert ? ' gewaehlt' : ''}"
            data-farbe="${f.wert}" title="${esc(f.label)}" aria-label="${esc(f.label)}"
            ${f.hex ? `style="--bf:${f.hex}"` : 'data-ohne="1"'}></button>`).join('')}</span>
      </label>` : ''}
      ${(b.typ === 'bild' || b.typ === 'gif') ? `<label class="schalter">
        <input type="checkbox" class="be-rahmen"${b.inhalt.ohne_rahmen ? '' : ' checked'}>
        Kontur und Schatten
      </label>` : ''}
      <label>Notiz an Claude <span class="klein grau">(privat — erscheint nie auf der Seite)</span>
        <textarea class="be-notiz" rows="2" placeholder="z. B.: „hier fehlt noch ein besseres Bild“">${esc(b.notiz || '')}</textarea>
      </label>
      <div class="be-menu-knoepfe">
        <button type="button" class="btn ghost be-duplizieren">Duplizieren</button>
        <button type="button" class="btn ghost be-loeschen">Löschen</button>
      </div>
      <button type="button" class="btn ghost be-aufteilen"${laesstSichAufteilen(b) ? '' : ' hidden'}
        title="Überschriften, Trennstriche und Bilder werden zu eigenen Blöcken">In Blöcke aufteilen</button>`;
    li.appendChild(menu);

    menueKnopf.addEventListener('click', () => {
      wurzel.querySelectorAll('.be-menu').forEach(m => { if (m !== menu) m.hidden = true; });
      menu.hidden = !menu.hidden;
    });
    menu.querySelector('.be-breite').addEventListener('change', (e) => {
      b.breite = e.target.value; blockSpeichern(b); ersetzeZeile(b);
    });
    menu.querySelectorAll('.be-farbe').forEach(k => k.addEventListener('click', () => {
      b.inhalt.farbe = k.dataset.farbe || '';
      blockSpeichern(b);
      menu.querySelectorAll('.be-farbe').forEach(x =>
        x.classList.toggle('gewaehlt', (x.dataset.farbe || '') === (b.inhalt.farbe || '')));
      /* Kasten und Zitat tragen die Farbe sichtbar -- dort sofort nachziehen,
         ohne die Zeile neu zu bauen (das Schreibfeld soll den Fokus behalten). */
      const huelle = zeileVon(b)?.querySelector('.be-huelle');
      if (huelle) {
        [...huelle.classList].filter(c => c.startsWith('mm-farbe-')).forEach(c => huelle.classList.remove(c));
        if (b.inhalt.farbe) huelle.classList.add('mm-farbe-' + b.inhalt.farbe);
      }
      if (b.typ === 'text') ersetzeZeile(b);
    }));
    const rahmenFeld = menu.querySelector('.be-rahmen');
    if (rahmenFeld) rahmenFeld.addEventListener('change', (e) => {
      /* Gespeichert wird die AUSNAHME (ohne_rahmen), nicht der Normalfall --
         so bleibt jeder vorhandene Block unveraendert und die bestehenden
         Pruefungen sehen weiterhin dasselbe HTML. */
      b.inhalt.ohne_rahmen = !e.target.checked;
      blockSpeichern(b);
      ersetzeZeile(b);
    });
    const notizFeld = menu.querySelector('.be-notiz');
    autoWachsen(notizFeld);
    notizFeld.addEventListener('input', (e) => {
      b.notiz = e.target.value;
      blockSpeichernEntprellt(b);
      marke.hidden = !b.notiz;
    });
    menu.querySelector('.be-duplizieren').addEventListener('click', () => {
      vorMutationMerken();
      const bezug = zeileVon(b);
      const kopie = blockDuplizieren(b);
      zeileEinfuegen(kopie, { nach: bezug });
      menu.hidden = true;
    });
    menu.querySelector('.be-aufteilen').addEventListener('click', () => {
      menu.hidden = true;
      aufteilen(b, b.inhalt && b.inhalt.roh);
    });
    menu.querySelector('.be-loeschen').addEventListener('click', () => {
      vorMutationMerken();
      const weg = zeileVon(b);
      blockLoeschen(b);
      if (weg) weg.remove(); else neuZeichnen();
    });

    return li;
  }

  /* ---------- Ziehen zum Umsortieren ---------- */
  let gezogen = null;
  function verdrahteListe() {
    const ul = liste();
    ul.addEventListener('dragstart', (e) => {
      gezogen = e.target.closest('.be-zeile');
      if (gezogen) gezogen.classList.add('wird-gezogen');
    });
    ul.addEventListener('dragend', () => {
      if (gezogen) { gezogen.classList.remove('wird-gezogen'); gezogen.draggable = false; }
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
      /* BEIDE Indizes VOR dem Entnehmen lesen -- danach hat sich der
         zweite bereits verschoben. */
      const vonIdx = zustand.bloecke.findIndex(x => x.clientKey === vonKey);
      const nachIdx = zustand.bloecke.findIndex(x => x.clientKey === nachKey);
      const [bl] = zustand.bloecke.splice(vonIdx, 1);
      const nachIdxNeu = nachIdx > vonIdx ? nachIdx - 1 : nachIdx;
      const einfugeStelle = vonIdx < nachIdx ? nachIdxNeu + 1 : nachIdxNeu;
      zustand.bloecke.splice(einfugeStelle, 0, bl);
      const davor = zustand.bloecke[einfugeStelle - 1];
      const danach = zustand.bloecke[einfugeStelle + 1];
      bl.sort_order = naechsteSortierung(
        davor ? davor.sort_order : null, danach ? danach.sort_order : null);
      blockSpeichern(bl);
      neuZeichnen();
    });
  }

  /* ---------- Rückgängig ---------- */
  function rueckgaengig() {
    const vorher = undo.zurueck();
    if (!vorher) return false;
    const jetztKeys = new Set(zustand.bloecke.map(bl => bl.clientKey));
    const vorherKeys = new Set(vorher.map(bl => bl.clientKey));
    zustand.bloecke.forEach(bl => { if (!vorherKeys.has(bl.clientKey)) blockLoeschenSpeichern(bl); });
    vorher.forEach(bl => { if (!jetztKeys.has(bl.clientKey)) blockSpeichern(bl); });
    zustand.bloecke = vorher;
    zustand.bloecke.forEach(bl => {
      if (jetztKeys.has(bl.clientKey) && vorherKeys.has(bl.clientKey)) blockSpeichern(bl);
    });
    neuZeichnen();
    return true;
  }

  /* ---------- Aufbau ---------- */
  wurzel.innerHTML = '<ul class="be-liste"></ul>'
    + '<div class="be-unten"><button type="button" class="btn ghost be-neu-unten">+ Block hinzufügen</button></div>';
  neuZeichnen();
  wurzel.querySelector('.be-neu-unten').addEventListener('click', () => {
    vorMutationMerken();
    const bl = blockAmEndeEinfuegen('text');
    zeileEinfuegen(bl);            // ans Ende -- hier ist Anhängen richtig
    fokussiere(bl.clientKey);
  });

  const aussenKlick = (e) => {
    if (!e.target.closest('.be-menu') && !e.target.closest('.be-menu-knopf'))
      wurzel.querySelectorAll('.be-menu').forEach(m => { m.hidden = true; });
    if (!e.target.closest('.be-slash') && !e.target.closest('.be-text')) slashSchliessen();
  };
  const escapeDruck = (e) => {
    if (e.key !== 'Escape') return;
    wurzel.querySelectorAll('.be-menu').forEach(m => { m.hidden = true; });
    slashSchliessen(); formatLeisteVerbergen();
  };
  /* ---------- Bild aus der Zwischenablage einfuegen (Strg/Cmd+V) ----------
     Fuer jemanden, der den ganzen Tag Einzelbilder aus dem Schnittprogramm
     kopiert, ist das der kuerzeste denkbare Weg: kopieren, in den Text
     klicken, einfuegen. Ohne das muesste jedes Bild erst als Datei
     gespeichert und dann ueber die Dateiauswahl geholt werden.

     Wichtig: Nur eingreifen, wenn wirklich BILDER in der Zwischenablage
     liegen. Reiner Text muss ganz normal eingefuegt werden -- sonst waere
     das Einfuegen von Text kaputt, und das macht man tausendmal
     haeufiger. */
  let ladeVorgang = false;
  const einfuegen = async (e) => {
    if (ladeVorgang) return;
    const daten = e.clipboardData;
    if (!daten) return;
    const bilder = [...(daten.files || [])].filter(f => f.type && f.type.startsWith('image/'));

    /* In welchen Block wird eingefuegt? */
    const zeile = (document.activeElement && document.activeElement.closest)
      ? document.activeElement.closest('.be-zeile') : null;
    const ziel = zeile ? zustand.bloecke.find(x => x.clientKey === zeile.dataset.key) : null;

    if (!bilder.length) {
      /* Kein Bild -- aber vielleicht ein ganzer Artikel als Markdown.
         SEHR zurueckhaltend eingreifen: nur in einen LEEREN Textblock und
         nur, wenn dabei wirklich mehr als ein Block entsteht. Alles andere
         muss ganz normal eingefuegt werden -- Text einfuegen macht man
         tausendmal haeufiger, und das darf nie kaputtgehen. */
      const text = daten.getData('text/plain');
      const leererText = ziel && ziel.typ === 'text' && !String(ziel.inhalt.roh || '').trim();
      if (!text || !leererText) return;
      const teile = teileVon(text);
      if (teile.length < 2 && !(teile.length === 1 && teile[0].typ !== 'text')) return;
      e.preventDefault();
      aufteilen(ziel, text);
      return;
    }
    e.preventDefault();

    ladeVorgang = true;
    const merker = statusEl ? statusEl.textContent : '';
    if (statusEl) statusEl.textContent = bilder.length > 1
      ? `${bilder.length} Bilder werden hochgeladen…` : 'Bild wird hochgeladen…';
    const adressen = [];
    try {
      for (const datei of bilder) {
        const r = await api.bildHochladen(datei);
        if (r && r.url) adressen.push(r.url);
      }
    } finally {
      ladeVorgang = false;
      if (statusEl) statusEl.textContent = merker;
    }
    if (!adressen.length) return;

    const roh = adressen.map(u => `![](${u})`).join('\n');
    vorMutationMerken();

    /* Steht der Cursor in einem LEEREN Textblock, wird dieser zum Bildblock
       -- sonst haette man nach jedem Einfuegen eine leere Zeile darueber. */
    const istLeererText = ziel && ziel.typ === 'text' && !String(ziel.inhalt.roh || '').trim();
    if (istLeererText) {
      ziel.typ = 'bild';
      ziel.inhalt = { roh };
      blockSpeichern(ziel);
      ersetzeZeile(ziel);
      return;
    }

    const bezug = ziel ? zeileVon(ziel) : null;
    const neuerBlock = ziel ? blockEinfuegenNach(ziel, 'bild') : blockAmEndeEinfuegen('bild');
    neuerBlock.inhalt = { roh };
    blockSpeichern(neuerBlock);
    zeileEinfuegen(neuerBlock, { nach: bezug });
  };

  document.addEventListener('mousedown', aussenKlick);
  document.addEventListener('keydown', escapeDruck);
  wurzel.addEventListener('paste', einfuegen);

  return {
    bloecke() { return zustand.bloecke; },
    rueckgaengig,
    neuZeichnen,
    flush,
    beschaeftigt,
    hatFehler: fehlerOffen,
    wiederholen: allesWiederholen,
    /* Von admin.js gemeldet, damit die "gespeichert"-Anzeige EINE Quelle
       hat und sich Block- und Seiten-Meldungen nicht überschreiben. */
    fremdSpeichertStart() { fremdeSchreibvorgaenge++; fremdFehler = false; statusAktualisieren(); },
    fremdSpeichertEnde(fehler = null) {
      fremdeSchreibvorgaenge = Math.max(0, fremdeSchreibvorgaenge - 1);
      fremdFehler = !!fehler;
      statusAktualisieren();
    },
    blockAmEndeEinfuegen(typ) {
      const bl = blockAmEndeEinfuegen(typ);
      zeileEinfuegen(bl);
      return bl;
    },
    zerstoeren() {
      document.removeEventListener('mousedown', aussenKlick);
      document.removeEventListener('keydown', escapeDruck);
      wurzel.removeEventListener('paste', einfuegen);
      /* Sicherheitsnetz NACH flush() im Ablauf: hier sollte nichts mehr
         pendeln -- falls doch, lieber kappen als später auf eine ganz
         andere Seite feuern. */
      entprellungen.forEach(t => clearTimeout(t));
      entprellungen.clear();
    },
  };
}
