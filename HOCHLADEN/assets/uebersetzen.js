/* mausemaus — die englische Fassung einer Seite pflegen.

   Bewusst eine EIGENE, schlichte Ansicht und kein zweiter Modus im
   Blockeditor: Der Blockeditor greift an über siebzig Stellen auf `inhalt`
   zu; ihn auf ein umschaltbares Feld umzubauen waere der riskanteste Teil
   des ganzen Vorhabens gewesen -- fuer eine Ansicht, in der ohnehin nichts
   gestaltet, sondern nur uebersetzt wird.

   Was hier passiert:
     links  der deutsche Text (unveraenderbar, nur zum Abschreiben)
     rechts das englische Feld

   Ein LEERES Feld heisst: hier bleibt Deutsch stehen. Genau so verhaelt
   sich die Seite auch (assets/sprache.js verschmilzt `inhalt_en` feldweise
   ueber `inhalt` und nimmt nur nicht-leere Werte). Man kann also jederzeit
   aufhoeren und spaeter weitermachen, ohne dass etwas kaputt aussieht.

   Und weil neunzig Felder einzeln zu uebersetzen niemand durchhaelt, gibt
   es oben zwei Knoepfe: alles auf einmal herauskopieren (zum Uebersetzen
   woanders) und die Antwort wieder einfuegen. */

import { erzeugeSpeicherWarteschlange } from '/assets/block-modell.js';

/* Welche Felder einer Blockart tragen Sprache?
   Alles andere -- Adressen, Farben, Breiten, der gruene Punkt, Bilder,
   Videos, Code, Trennstriche -- bleibt unberuehrt und taucht hier gar
   nicht erst auf. */
const FELDER = {
  text:          [['roh', 'Text']],
  ueberschrift:  [['roh', 'Überschrift']],
  kasten:        [['roh', 'Text im Kasten']],
  zitat:         [['roh', 'Zitat']],
  text_mit_bild: [['roh', 'Text (mit Bild daneben)']],
  randnotiz:     [['titel', 'Titel'], ['zeile1', 'Zeile 1'], ['zeile2', 'Zeile 2']],
  abschnitt:     [['titel', 'Titel'], ['kicker', 'Kleine Zeile darüber'], ['zusatz', 'Zusatz']],
  tuer:          [['text', 'Beschriftung des Knopfes']],
};

/* Nur fuer die Beschriftung in der Liste. */
const ARTNAME = { randnotiz: 'Randnotiz', abschnitt: 'Abschnitt' };

const ANWEISUNG =
  'Übersetze die folgenden Abschnitte einer Portfolio-Website ins Englische. ' +
  'Der Ton ist locker und persönlich — bitte genauso im Englischen. ' +
  'Behalte die Nummern in eckigen Klammern EXAKT bei, jede Nummer in einer ' +
  'eigenen Zeile davor. Behalte Markdown (**fett**, ## Überschrift, Listen), ' +
  'alle Links und alle Adressen unverändert. Antworte nur mit der Liste, ' +
  'ohne Vorwort.';

const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function mountUebersetzung(wurzel, { sb, seite, bloecke, statusMelden }) {
  /* ---------- Die Stellen einsammeln ----------
     Eine "Stelle" ist ein einzelnes uebersetzbares Feld. Sie kennt ihren
     deutschen Text, ihren aktuellen englischen Stand und weiss, wohin sie
     gehoert. Nur Stellen mit deutschem Text kommen vor: ein leeres Feld
     zu uebersetzen ergibt nichts. */
  const stellen = [];
  const seitenStand = { titel_en: seite.titel_en || '', untertitel_en: seite.untertitel_en || '' };

  if (seite.titel) {
    stellen.push({ quelle: 'seite', feld: 'titel', label: 'Titel der Seite',
      deutsch: seite.titel, wert: seitenStand.titel_en });
  }
  if (seite.untertitel) {
    stellen.push({ quelle: 'seite', feld: 'untertitel', label: 'Untertitel',
      deutsch: seite.untertitel, wert: seitenStand.untertitel_en });
  }

  /* Der Stand je Block: `inhalt_en` wird hier gehalten und als GANZES
     Objekt geschrieben. So kann kein Feld verlorengehen, wenn zwei
     Aenderungen kurz hintereinander kommen. */
  const stand = new Map();     // block.id -> das kuenftige inhalt_en

  bloecke.slice().sort((a, b) => a.sort_order - b.sort_order).forEach(b => {
    const felder = FELDER[b.typ];
    if (!felder) return;                       // Bild, Video, Code, Trenner …
    const de = b.inhalt || {}, en = b.inhalt_en || {};
    stand.set(b.id, { ...en });
    felder.forEach(([feld, label]) => {
      const deutsch = de[feld];
      if (typeof deutsch !== 'string' || deutsch.trim() === '') return;
      /* Bei mehrfeldrigen Bloecken die Art davorschreiben -- sonst stehen
         drei Zeilen "Titel / Zeile 1 / Zeile 2" untereinander, ohne dass
         man sieht, dass sie zusammengehoeren. */
      const voll = felder.length > 1 ? (ARTNAME[b.typ] || b.typ) + ' · ' + label : label;
      stellen.push({ quelle: 'block', block: b, feld, label: voll, deutsch, wert: en[feld] || '' });
    });
  });

  stellen.forEach((st, i) => { st.marke = i + 1; });

  /* ---------- Speichern ----------
     Eine Warteschlange je Block (und eine fuer die Seite), genau wie im
     Blockeditor: zwei schnelle Aenderungen koennen sich nicht gegenseitig
     ueberschreiben, und ein misslungener Stand wird FESTGEHALTEN statt
     weggeworfen. */
  const warteschlangen = new Map();

  function warteschlangeFuer(schluessel, schreiben) {
    if (!warteschlangen.has(schluessel)) {
      warteschlangen.set(schluessel, erzeugeSpeicherWarteschlange(
        async (daten) => { statusMelden('speichert'); await schreiben(daten); statusMelden('gespeichert'); },
        (fehler) => statusMelden('fehler', fehler)));
    }
    return warteschlangen.get(schluessel);
  }

  function stelleSpeichern(st) {
    if (st.quelle === 'seite') {
      seitenStand[st.feld + '_en'] = st.wert;
      seite[st.feld + '_en'] = st.wert;         // damit die Liste den Stand behaelt
      warteschlangeFuer('seite', async (felder) => {
        const { error } = await sb.from('seiten').update(felder).eq('id', seite.id);
        if (error) throw error;
      }).anstossen({ ...seitenStand });
      return;
    }
    const id = st.block.id;
    const objekt = stand.get(id) || {};
    /* Leer heisst "hier bleibt Deutsch": das Feld wird ENTFERNT statt als
       leerer Text gespeichert. Sonst stuende spaeter in der Datenbank ein
       leerer englischer Text, und niemand saehe ihm an, dass er nie
       ausgefuellt wurde. */
    if (st.wert.trim() === '') delete objekt[st.feld];
    else objekt[st.feld] = st.wert;
    stand.set(id, objekt);
    st.block.inhalt_en = objekt;
    const leer = Object.keys(objekt).length === 0;
    warteschlangeFuer('block-' + id, async (daten) => {
      const { error } = await sb.from('bloecke').update({ inhalt_en: daten }).eq('id', id);
      if (error) throw error;
    }).anstossen(leer ? null : { ...objekt });
  }

  /* ---------- Zwischenablage: alles raus, alles rein ---------- */

  function alsText() {
    return ANWEISUNG + '\n\n' +
      stellen.map(st => '[' + st.marke + ']\n' + st.deutsch).join('\n\n');
  }

  /* Liest zurueck, was von der Uebersetzung kommt. Angenommen wird nur,
     was sich eindeutig einer Marke zuordnen laesst -- alles andere wird
     nicht etwa geraten, sondern gemeldet. */
  function ausText(text) {
    const treffer = new Map();
    const teile = String(text).split(/^\s*\[(\d+)\]\s*$/m);
    /* split mit einer Gruppe liefert: [vorspann, nummer, text, nummer, text, …] */
    for (let i = 1; i < teile.length; i += 2) {
      const nummer = Number(teile[i]);
      const inhalt = (teile[i + 1] || '').trim();
      if (nummer && inhalt) treffer.set(nummer, inhalt);
    }
    return treffer;
  }

  /* ---------- Die Ansicht ---------- */

  wurzel.innerHTML =
    '<div class="ue-kopf">' +
      '<div>' +
        '<h2>Englische Fassung</h2>' +
        '<p class="klein grau">Was du hier leer lässt, bleibt auf der Seite deutsch stehen. ' +
        'Du kannst also jederzeit aufhören und später weitermachen.</p>' +
      '</div>' +
      '<div class="ue-knoepfe">' +
        '<button class="btn ghost" id="ue-kopieren" type="button">Ganze Seite zum Übersetzen kopieren</button>' +
        '<button class="btn ghost" id="ue-einfuegen" type="button">Übersetzung einfügen</button>' +
        '<button class="btn primary" id="ue-fertig" type="button">Fertig</button>' +
      '</div>' +
    '</div>' +
    '<p class="ue-meldung" id="ue-meldung" role="status" aria-live="polite"></p>' +
    '<div class="ue-liste" id="ue-liste"></div>';

  const liste = wurzel.querySelector('#ue-liste');
  const meldung = wurzel.querySelector('#ue-meldung');

  if (!stellen.length) {
    liste.innerHTML = '<p class="klein grau">Auf dieser Seite steht nichts, was sich übersetzen ließe — ' +
      'nur Bilder, Videos oder Trennstriche.</p>';
  }

  stellen.forEach(st => {
    const zeile = document.createElement('div');
    zeile.className = 'ue-zeile';
    const mehrzeilig = st.feld === 'roh' || st.deutsch.length > 60;
    zeile.innerHTML =
      '<div class="ue-marke">' + st.marke + '</div>' +
      '<div class="ue-de">' +
        '<span class="ue-label">' + esc(st.label) + '</span>' +
        '<div class="ue-deutsch">' + esc(st.deutsch) + '</div>' +
      '</div>' +
      '<div class="ue-en">' +
        '<span class="ue-label">Englisch</span>' +
        (mehrzeilig
          ? '<textarea rows="3" placeholder="leer = bleibt deutsch"></textarea>'
          : '<input type="text" placeholder="leer = bleibt deutsch">') +
      '</div>';
    const feld = zeile.querySelector('textarea, input');
    feld.value = st.wert;
    st.element = feld;
    let ruhe = null;
    feld.addEventListener('input', () => {
      st.wert = feld.value;
      zeile.classList.toggle('ue-fertig', feld.value.trim() !== '');
      clearTimeout(ruhe);
      ruhe = setTimeout(() => stelleSpeichern(st), 500);
    });
    /* Verlaesst der Zeiger das Feld, sofort schreiben -- nicht erst nach
       der Ruhezeit. Wer eine Zeile fertig hat und weiterklickt, soll nicht
       auf einen Zeitgeber angewiesen sein. */
    feld.addEventListener('blur', () => { clearTimeout(ruhe); stelleSpeichern(st); });
    if (st.wert.trim() !== '') zeile.classList.add('ue-fertig');
    liste.appendChild(zeile);
  });

  wurzel.querySelector('#ue-kopieren').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(alsText());
      sagen('Kopiert. Jetzt in ChatGPT einfügen, übersetzen lassen, und die Antwort ' +
        'hier über „Übersetzung einfügen“ wieder hereinholen.');
    } catch {
      sagen('Die Zwischenablage wollte nicht. Der Text steht unten im Feld — von dort ' +
        'kopieren.', true);
      textZeigen(alsText());
    }
  });

  wurzel.querySelector('#ue-einfuegen').addEventListener('click', () => einfuegeFeldZeigen());

  function sagen(text, schlecht = false) {
    meldung.textContent = text;
    meldung.className = 'ue-meldung' + (schlecht ? ' schlecht' : ' gut');
  }

  function textZeigen(text) {
    let kasten = wurzel.querySelector('#ue-rohtext');
    if (!kasten) {
      kasten = document.createElement('textarea');
      kasten.id = 'ue-rohtext'; kasten.className = 'ue-rohtext'; kasten.rows = 8;
      meldung.after(kasten);
    }
    kasten.value = text; kasten.select();
  }

  function einfuegeFeldZeigen() {
    let kasten = wurzel.querySelector('#ue-einfuegefeld');
    if (kasten) { kasten.focus(); return; }
    kasten = document.createElement('div');
    kasten.id = 'ue-einfuegefeld'; kasten.className = 'ue-einfuegen';
    kasten.innerHTML =
      '<p class="klein grau">Die Antwort der Übersetzung hier hineinkopieren. ' +
      'Zugeordnet wird über die Nummern in eckigen Klammern.</p>' +
      '<textarea rows="8" placeholder="[1]&#10;Hi, I’m …"></textarea>' +
      '<div class="ue-knoepfe">' +
        '<button class="btn primary" type="button" data-ue="uebernehmen">Übernehmen</button>' +
        '<button class="btn ghost" type="button" data-ue="abbrechen">Abbrechen</button>' +
      '</div>';
    meldung.after(kasten);
    const ta = kasten.querySelector('textarea');
    ta.focus();
    kasten.querySelector('[data-ue="abbrechen"]').addEventListener('click', () => kasten.remove());
    kasten.querySelector('[data-ue="uebernehmen"]').addEventListener('click', () => {
      const treffer = ausText(ta.value);
      if (!treffer.size) {
        sagen('Da war keine einzige Nummer in eckigen Klammern drin. Nichts geändert — ' +
          'schau nochmal, ob die Antwort vollständig kopiert wurde.', true);
        return;
      }
      let gesetzt = 0;
      stellen.forEach(st => {
        const neu = treffer.get(st.marke);
        if (neu == null) return;
        st.wert = neu;
        st.element.value = neu;
        st.element.closest('.ue-zeile').classList.add('ue-fertig');
        stelleSpeichern(st);
        gesetzt++;
      });
      const fehlend = stellen.length - gesetzt;
      const unbekannt = [...treffer.keys()].filter(n => !stellen.some(st => st.marke === n));
      sagen(gesetzt + ' von ' + stellen.length + ' Abschnitten übernommen.' +
        (fehlend ? ' ' + fehlend + ' ohne Übersetzung — die bleiben deutsch.' : '') +
        (unbekannt.length ? ' Nummern ohne Gegenstück hier: ' + unbekannt.join(', ') + '.' : ''));
      kasten.remove();
    });
  }

  return {
    beiFertig(rueckruf) { wurzel.querySelector('#ue-fertig').addEventListener('click', rueckruf); },
    /* Fuer den Fall, dass beim Schliessen noch etwas unterwegs ist. */
    beschaeftigt() { return [...warteschlangen.values()].some(q => q.beschaeftigt()); },
    alleWiederholen() {
      let etwas = false;
      warteschlangen.forEach(q => { if (q.wiederholen()) etwas = true; });
      return etwas;
    },
  };
}
