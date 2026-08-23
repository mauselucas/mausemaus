/* mausemaus — reine Logik des Blockeditors.
   Bewusst OHNE jede Abhängigkeit (kein DOM, kein Netzwerk, kein window.mm) --
   dadurch lässt sich diese Datei direkt in Node testen (siehe
   tests/pruefe-editor-modell.mjs), ganz ohne Anmeldung oder Browser.
   assets/blockeditor.js baut auf diesen Funktionen auf und bringt das DOM
   und Supabase dazu. */

/* ---------- Blockarten ---------- */

/* label = Anzeigename, stichworte = wonach die Blockauswahl ("/") sucht. */
export const BLOCKARTEN = [
  { typ: 'text',          label: 'Text',                   icon: '¶',   stichworte: ['text', 'absatz'] },
  { typ: 'ueberschrift',  label: 'Überschrift',             icon: 'H',   stichworte: ['ueberschrift', 'überschrift', 'titel', 'h2', 'h3'] },
  { typ: 'randnotiz',     label: 'Randnotiz',               icon: '▤',   stichworte: ['randnotiz', 'eckdaten', 'info', 'kasten'] },
  { typ: 'bild',          label: 'Bild',                    icon: '🖼',  stichworte: ['bild', 'foto', 'galerie', 'bilder'] },
  { typ: 'gif',           label: 'GIF',                     icon: '🎞',  stichworte: ['gif', 'animation', 'bewegtbild'] },
  { typ: 'video',         label: 'Video',                   icon: '▶',   stichworte: ['video', 'youtube', 'vimeo', 'film'] },
  { typ: 'text_mit_bild', label: 'Text mit Bild daneben',   icon: '⿰',  stichworte: ['text mit bild', 'spalte', 'nebeneinander'] },
  { typ: 'code',          label: 'Code',                    icon: '⌗',  stichworte: ['code', 'programmcode', 'sprache'] },
  { typ: 'werkzeug',      label: 'Werkzeug / Einlage',      icon: '⚙',  stichworte: ['werkzeug', 'demo', 'einlage', 'interaktiv'] },
  { typ: 'trenner',       label: 'Trennstrich',             icon: '—',   stichworte: ['trenner', 'linie', 'strich'] },
  { typ: 'tuer',          label: 'Türchen / Knopf',         icon: '🚪',  stichworte: ['tuer', 'tür', 'knopf', 'button', 'link'] },
  { typ: 'abschnitt',     label: 'Abschnitt (Zeitleiste)',  icon: '§',   stichworte: ['abschnitt', 'zeitleiste', 'section'] },
];

export const BLOCKARTEN_NACH_TYP = Object.fromEntries(BLOCKARTEN.map(b => [b.typ, b]));

export const BREITEN = [
  { wert: 'schmal',    label: 'Schmal' },
  { wert: 'normal',    label: 'Normal' },
  { wert: 'randnotiz', label: 'Randnotiz (am Rand, wie eine Spalte)' },
  { wert: 'voll',      label: 'Volle Breite' },
];

export const BEWEGUNGEN = [
  { wert: 'keine',       label: 'Keine' },
  { wert: 'einblenden',  label: 'Einblenden' },
  { wert: 'hochschieben', label: 'Hochschieben' },
  { wert: 'wachsen',     label: 'Wachsen' },
  { wert: 'zeilenweise', label: 'Zeilenweise' },
];

/* ---------- leerer Inhalt je Blockart ---------- */

export function leererInhalt(typ) {
  switch (typ) {
    case 'ueberschrift': return { roh: '## ' };
    case 'trenner':      return { roh: '---' };
    case 'werkzeug':     return { roh: '::demo ' };
    case 'code':         return { roh: '```\n```' };
    case 'text_mit_bild': return { roh: ':::\n\n:::' };
    case 'randnotiz':    return { titel: '', zeile1: '', zeile2: '', punkt: false };
    case 'tuer':          return { ziel: '', text: 'Mehr dazu' };
    case 'abschnitt':    return { titel: '', art: 'beruflich', farbe: null };
    /* text, bild, gif, video */
    default: return { roh: '' };
  }
}

/* ---------- Blockauswahl ("/") ---------- */

/* Filtert BLOCKARTEN nach einem Suchtext. Leerer Suchtext liefert alle,
   in der festen Reihenfolge oben. Ein Treffer im Label zählt mehr als
   einer nur in den Stichworten. */
export function slashTreffer(suchtext) {
  const s = String(suchtext || '').trim().toLowerCase();
  if (!s) return BLOCKARTEN.slice();
  const bewertet = BLOCKARTEN.map(b => {
    const label = b.label.toLowerCase();
    let punkte = -1;
    if (label.startsWith(s)) punkte = 100;
    else if (label.includes(s)) punkte = 50;
    else if (b.stichworte.some(w => w.startsWith(s))) punkte = 40;
    else if (b.stichworte.some(w => w.includes(s))) punkte = 20;
    return { b, punkte };
  }).filter(x => x.punkte >= 0);
  bewertet.sort((a, b) => b.punkte - a.punkte);
  return bewertet.map(x => x.b);
}

/* ---------- Sortierung ---------- */

/* Neue Position beim Verschieben: Mittelwert der Nachbarn -- wie schon in
   admin.js bei der alten Projektliste. Dadurch muss beim Umsortieren nie
   die ganze Liste neu nummeriert werden, und zwei Verschiebe-Vorgänge, die
   sich zeitlich überlappen, können sich nicht gegenseitig kaputt machen:
   jede Zeile bekommt ihre eigene, von den anderen unabhängige Zahl. */
export function naechsteSortierung(davor, danach) {
  if (davor == null && danach == null) return 1000;
  if (davor == null) return danach - 1;
  if (danach == null) return davor + 1;
  return (davor + danach) / 2;
}

/* ---------- Markdown-Auswahlwerkzeuge (fett/kursiv/Link/Türchen) ----------
   Arbeiten rein auf Text + Cursorposition, genau wie die Werkzeugleiste, die
   es im alten Editor schon gab -- nur diesmal wiederverwendbar und ohne DOM. */

export function umschliesseAuswahl(text, start, end, marker) {
  const inhalt = text.slice(start, end) || 'Text';
  const neu = text.slice(0, start) + marker + inhalt + marker + text.slice(end);
  return { text: neu, start, end: start + marker.length * 2 + inhalt.length };
}

export function linkEinfuegen(text, start, end, linktext, ziel) {
  const einsatz = `[${linktext || ziel}](${ziel})`;
  const neu = text.slice(0, start) + einsatz + text.slice(end);
  return { text: neu, start: start + einsatz.length, end: start + einsatz.length };
}

/* wort = sichtbarer Text, slug = Ziel-Welt, geheim = ohne Blumen-Kennzeichen */
export function tuerEinfuegen(text, start, end, wort, slug, titel, zusatztext, geheim) {
  const teile = [wort, slug];
  if (titel || zusatztext) teile.push(titel || '');
  if (zusatztext) teile.push(zusatztext);
  const [auf, zu] = geheim ? ['((', '))'] : ['[[', ']]'];
  const einsatz = auf + teile.join('|') + zu;
  const neu = text.slice(0, start) + einsatz + text.slice(end);
  return { text: neu, start: start + einsatz.length, end: start + einsatz.length };
}

/* ---------- Bild-Zeilen (ein 'bild'-Block kann mehrere enthalten -- eine
   Galerie) ---------- */

const IMG_LINE = /^!\[([^\]]*)\]\(([^)\s]+)\)(?:\{(klein|mittel|gross)\})?$/;

export function bildZeileBauen({ alt = '', url = '', groesse = 'gross' } = {}) {
  return `![${alt}](${url})` + (groesse && groesse !== 'gross' ? `{${groesse}}` : '');
}

export function bildZeilenLesen(roh) {
  return String(roh ?? '').split('\n')
    .map(z => z.trim()).filter(Boolean)
    .map(z => {
      const m = z.match(IMG_LINE);
      if (!m) return null;
      return { alt: m[1] || '', url: m[2] || '', groesse: m[3] || 'gross' };
    })
    .filter(Boolean);
}

export function bildZeilenBauen(liste) {
  return (liste || []).map(bildZeileBauen).join('\n');
}

/* ---------- "Text mit Bild daneben" (":::"-Block) ---------- */

export function textMitBildLesen(roh) {
  const zeilen = String(roh ?? '').replace(/\r\n?/g, '\n').split('\n');
  const kopf = (zeilen[0] || '').trim();
  const bilderLinks = /^:::\s*links/.test(kopf);
  /* Kopf- und Schlusszeile (':::' bzw. ':::links') abschneiden. */
  const rumpf = zeilen.slice(1, /^:::\s*$/.test((zeilen[zeilen.length - 1] || '').trim())
    ? zeilen.length - 1 : zeilen.length);
  const istBild = (z) => IMG_LINE.test(z.trim());
  const bilder = rumpf.filter(z => z.trim() && istBild(z));
  const text = rumpf.filter(z => !istBild(z));
  return { bilderLinks, text: text.join('\n').trim(), bilder: bildZeilenLesen(bilder.join('\n')) };
}

export function textMitBildBauen({ bilderLinks = false, text = '', bilder = [] } = {}) {
  const kopf = ':::' + (bilderLinks ? ' links' : '');
  return [kopf, text, bildZeilenBauen(bilder), ':::'].join('\n');
}

/* ---------- Überschrift ---------- */

export function ueberschriftLesen(roh) {
  const m = String(roh ?? '').match(/^(#{2,3})\s?(.*)$/);
  return { ebene: m ? m[1].length : 2, text: m ? m[2] : String(roh ?? '') };
}
export function ueberschriftBauen(ebene, text) {
  return '#'.repeat(ebene === 3 ? 3 : 2) + ' ' + String(text ?? '');
}

/* ---------- Code ---------- */

export function codeLesen(roh) {
  const zeilen = String(roh ?? '').replace(/\r\n?/g, '\n').split('\n');
  const sprache = (zeilen[0] || '').replace(/^```/, '').trim();
  const ende = zeilen.length - 1 > 0 && zeilen[zeilen.length - 1].trim().startsWith('```')
    ? zeilen.length - 1 : zeilen.length;
  return { sprache, code: zeilen.slice(1, ende).join('\n') };
}
export function codeBauen(sprache, code) {
  return '```' + (sprache || '') + '\n' + String(code ?? '') + '\n```';
}

/* ---------- Werkzeug/Einlage ---------- */

export function werkzeugLesen(roh) {
  const m = String(roh ?? '').match(/^::demo\s*(.*)$/);
  return { kennung: m ? m[1].trim() : '' };
}
export function werkzeugBauen(kennung) {
  return '::demo ' + String(kennung ?? '').trim();
}

/* ---------- Rückgängig ---------- */

/* Ein einfacher, aber echter Stapel von Momentaufnahmen der ganzen
   Blockliste. Bei der geringen Blockzahl je Seite (Dutzende, keine
   Tausende) ist das schnell genug und -- wichtiger -- beweisbar richtig:
   Rückgängig stellt exakt den vorigen Stand wieder her, unabhängig davon,
   welche Aktion ihn verändert hat. */
export function erzeugeUndoStapel(limit = 30) {
  const stapel = [];
  return {
    merken(momentaufnahme) {
      stapel.push(momentaufnahme);
      if (stapel.length > limit) stapel.shift();
    },
    zurueck() { return stapel.pop() ?? null; },
    leer() { return stapel.length === 0; },
    groesse() { return stapel.length; },
  };
}

/* ---------- Speicher-Warteschlange: das Kernstück gegen Datenverlust ----------

   Ohne diese Warteschlange könnten zwei kurz aufeinanderfolgende
   Speichervorgänge für denselben Block sich gegenseitig überschreiben: löst
   ein Netzwerk-Aufruf langsamer auf als ein späterer (z. B. weil der Server
   gerade eine Cent-Sekunde braucht), landet am Ende der ÄLTERE Stand in der
   Datenbank, obwohl der Benutzer danach noch etwas Neueres geschrieben hat.

   Diese Warteschlange verhindert das strukturell, nicht durch Zeitmessung:
   - Es läuft nie mehr als EIN Schreibvorgang gleichzeitig für denselben
     Block (kein Wettlauf möglich).
   - Kommt während eines laufenden Schreibvorgangs ein neuerer Stand herein,
     wird er gemerkt und läuft GARANTIERT als nächstes -- nicht der davor
     übersprungene Zwischenstand.
   - Der letzte "anstossen()"-Aufruf gewinnt am Ende immer, unabhängig davon,
     wie lange einzelne Netzwerk-Aufrufe brauchen. */
export function erzeugeSpeicherWarteschlange(schreiben) {
  let laeuft = false;
  let ausstehend;      // aktuell wartender Stand, oder KEIN_STAND
  const KEIN_STAND = Symbol('kein-stand');
  ausstehend = KEIN_STAND;

  async function schritt() {
    laeuft = true;
    const daten = ausstehend;
    ausstehend = KEIN_STAND;
    try {
      await schreiben(daten);
    } finally {
      laeuft = false;
      if (ausstehend !== KEIN_STAND) schritt();
    }
  }

  return {
    anstossen(daten) {
      ausstehend = daten;
      if (!laeuft) schritt();
    },
    beschaeftigt() { return laeuft || ausstehend !== KEIN_STAND; },
  };
}
