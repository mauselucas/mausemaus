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
  { typ: 'kasten',        label: 'Kasten',                  icon: '▭',   stichworte: ['kasten', 'hinweis', 'box', 'callout', 'hervorheben'] },
  { typ: 'zitat',         label: 'Zitat',                   icon: '❝',  stichworte: ['zitat', 'quote', 'einzug', 'strich'] },
];

/* ---------- Farben für Blöcke ----------
   Bewusst eine feste kleine Auswahl statt eines freien Farbwählers: Auf einer
   Seite, deren ganzer Auftritt "eine laute Stelle, sonst Ruhe" heißt, ist ein
   Farbwähler die schnellste Art, sich den Auftritt zu zerlegen. Die Töne hier
   stammen alle aus der Seite selbst -- Salbei ist der Akzent, die übrigen sind
   die Farben der Projektseiten. Terrakotta ist der einzige Zusatz, weil es
   keinen roten Ton gab.

   Gespeichert wird der NAME, nicht der Hexwert. Dadurch bleibt eine einmal
   gewählte Farbe richtig, auch wenn der Ton später nachjustiert wird -- und
   die helle Variante lässt sich aus demselben Wert ableiten, statt sie als
   zweiten Hexwert doppelt zu pflegen (siehe site.css, color-mix). */
export const FARBEN = [
  { wert: '',           label: 'ohne Farbe', hex: null },
  { wert: 'salbei',     label: 'Salbei',     hex: '#BFCC94' },
  { wert: 'oliv',       label: 'Oliv',       hex: '#7F8F55' },
  { wert: 'ocker',      label: 'Ocker',      hex: '#A8913F' },
  { wert: 'terrakotta', label: 'Terrakotta', hex: '#A85B4B' },
  { wert: 'violett',    label: 'Violett',    hex: '#8E4E9B' },
  { wert: 'tiefblau',   label: 'Tiefblau',   hex: '#344966' },
  { wert: 'schiefer',   label: 'Schiefer',   hex: '#6E6E7A' },
];
export const FARB_WERTE = FARBEN.map(f => f.wert);
/* Blockarten, bei denen eine Farbe überhaupt etwas bewirkt. */
export const FARBIGE_TYPEN = ['text', 'kasten', 'zitat'];

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
    case 'kasten':       return { roh: '', farbe: '' };
    case 'zitat':        return { roh: '', farbe: '' };
    /* text, bild, gif, video */
    default: return { roh: '' };
  }
}

/* ---------- Vorlagen: Startblöcke für "+ Neu" ----------
   Liefert eine Liste von {typ, inhalt} für eine frisch angelegte Seite --
   OHNE seite_id/breite/bewegung/sort_order, das ergänzt der Aufrufer (siehe
   admin.js), weil dort erst die echte seite_id feststeht und die Reihenfolge
   Sache des Aufrufers ist. Reine Logik, ohne Netzwerk -- deshalb direkt
   testbar wie der Rest dieser Datei (siehe tests/pruefe-vorlagen.mjs).
   Eine leere Seite wirkt für jemanden, der nicht programmiert, schnell
   einschüchternd ("was soll ich hier reinschreiben?") -- die Vorlage zeigt
   stattdessen sofort eine sinnvolle Struktur zum Überschreiben. */
export function vorlageBloecke(typ) {
  switch (typ) {
    case 'projekt':
      return [
        { typ: 'text', inhalt: { roh: 'PLATZHALTER — ein bis zwei Sätze, worum es bei diesem Projekt geht.' } },
        { typ: 'bild', inhalt: leererInhalt('bild') },
        { typ: 'trenner', inhalt: leererInhalt('trenner') },
        { typ: 'text', inhalt: { roh: 'PLATZHALTER — Stichworte, z. B. Schnitt · Motion Design' } },
      ];
    case 'welt':
      return [
        { typ: 'text', inhalt: { roh: 'PLATZHALTER — hier schreibt Lucas seinen eigenen Text.' } },
        { typ: 'bild', inhalt: leererInhalt('bild') },
      ];
    /* 'brief' entsteht nie über "+ Neu" (es gibt nur die eine feste
       Brief-Seite) -- und jede unbekannte Art bekommt lieber gar keine
       Vorlage als eine falsche. */
    default:
      return [];
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

/* ---------- Nächster freier Slug ----------
   Reine Logik ohne Netzwerk: bekommt die Menge der bereits belegten Slugs
   und liefert den ersten freien, ausgehend von `basis`. Wichtig: die
   Schleife zählt IMMER vom selben Stamm aus hoch -- ein leeres `basis`
   fällt einmal auf 'seite' zurück, und jeder weitere Versuch baut auf
   'seite' auf ('seite-2', 'seite-3', …), nicht auf dem ursprünglichen
   (leeren) `basis`. Sonst entstehen bei jedem erneuten Versuch Kennungen
   wie "-2", "-3" -- ein führender Bindestrich ohne Namen davor. */
export function naechsterFreierSlug(basis, belegteSlugs) {
  const stamm = (basis || '').trim() || 'seite';
  const belegt = new Set(belegteSlugs || []);
  let s = stamm, n = 1;
  while (belegt.has(s)) s = `${stamm}-${++n}`;
  return s;
}

/* ---------- Mehrere Abfrage-Ergebnisse zu einem Fehler zusammenfassen ----------
   Für Aufrufe wie die Sicherung, die mehrere Abfragen parallel losschickt
   (Promise.all) und danach EINEN gemeinsamen Fehler braucht: den ersten,
   der wirklich einen trägt. Von Hand aufgezählt (`a.error || b.error || …`)
   vergisst man beim Hinzufügen einer weiteren Abfrage leicht genau das
   Feld, das den Unterschied macht -- eine Sicherung, die dann still
   unvollständig bleibt, ist schlimmer als gar keine, weil man sich auf
   sie verlässt. Diese Funktion nimmt beliebig viele Ergebnisse entgegen,
   dadurch kann an der Aufrufstelle keins mehr klanglos wegfallen. */
export function ersterFehler(...ergebnisse) {
  for (const e of ergebnisse) if (e && e.error) return e.error;
  return null;
}

/* ---------- Entprellter Auslöser mit Sofort-Auslösen beim Verlassen ----------
   Bündelt schnelle Änderungen (z. B. Tastendrücke in einem Feld) zu einem
   einzigen Aufruf von `ausloesen`, der erst nach `verzoegerungMs` Ruhe
   passiert. Anders als ein bloßer setTimeout+clearTimeout WEISS dieser
   Auslöser, ob gerade eine Änderung aussteht -- das macht `sofort()`
   möglich: beim Schließen eines Editors den Zeitgeber kappen (er darf
   NICHT irgendwann später -- möglicherweise für eine inzwischen ganz
   andere Seite -- feuern) und eine noch wartende Änderung stattdessen
   SOFORT auslösen, statt sie stillschweigend zu verwerfen. Ohne das geht
   jede Änderung verloren, die innerhalb der Wartezeit vor dem Schließen
   gemacht wurde. */
export function erzeugeEntprellung(ausloesen, verzoegerungMs = 500) {
  let zeitgeber = null;
  let wartet = false;
  const abbrechen = () => { if (zeitgeber != null) clearTimeout(zeitgeber); zeitgeber = null; };

  return {
    anstossen() {
      wartet = true;
      abbrechen();
      zeitgeber = setTimeout(() => { zeitgeber = null; wartet = false; ausloesen(); }, verzoegerungMs);
    },
    /* Zeitgeber kappen und, falls etwas aussteht, SOFORT auslösen.
       Liefert zurück, ob wirklich etwas ausgelöst wurde. */
    sofort() {
      abbrechen();
      if (!wartet) return false;
      wartet = false;
      ausloesen();
      return true;
    },
    /* Zeitgeber kappen, OHNE auszulösen -- für den Fall, dass der Aufrufer
       die ausstehende Änderung längst auf anderem Weg gespeichert hat. */
    verwerfen() { abbrechen(); wartet = false; },
    ausstehend() { return wartet; },
  };
}

/* ---------- Bild-Hochladen: welche MIME-Typen dürfen durchs Canvas? ----------
   Absichtlich eine POSITIVLISTE ("diese Formate sind garantiert immer ein
   einzelnes Bild"), keine Negativliste bewegter Formate: Eine Verneinung
   ("alles außer GIF/APNG ist sicher") übersieht jedes neue bewegte Format
   von selbst -- eine animierte WebP zum Beispiel lief bisher unbemerkt
   durchs Canvas und verlor dabei ihre Bewegung, weil createImageBitmap()/
   canvas.toBlob() immer nur das erste Einzelbild sehen. Mit der Positiv-
   liste fällt ein unbekanntes oder potenziell bewegtes Format automatisch
   auf "nicht verkleinern, unverändert hochladen" zurück, statt
   automatisch als sicher zu gelten. */
export const IMMER_EINZELBILD = ['image/jpeg', 'image/png', 'image/bmp'];
export function darfDurchsCanvas(mimeType) {
  return IMMER_EINZELBILD.includes(mimeType);
}

/* ---------- Dateiendung aus dem tatsächlichen MIME-Typ ---------- */
const ENDUNG_NACH_MIME = {
  'image/gif': 'gif', 'image/png': 'png', 'image/apng': 'png',
  'image/webp': 'webp', 'image/avif': 'avif', 'image/jpeg': 'jpg',
  'image/svg+xml': 'svg', 'image/bmp': 'bmp', 'image/tiff': 'tiff',
};
export function endungFuerMime(mimeType, ersatz = 'bild') {
  return ENDUNG_NACH_MIME[mimeType] || ersatz;
}

/* ---------- Nach dem Verkleinern: Endung und Typ am WIRKLICHEN Blob ausrichten ----------
   `cv.toBlob(cb, 'image/webp', güte)` ist ein WUNSCH, kein Versprechen:
   Safari kann laut Spezifikation still ein anderes Format liefern (bisher
   PNG), wenn es WebP nicht schreiben kann -- ohne diese Prüfung läge ein
   PNG mit der Endung .webp und der Typangabe image/webp im Speicher,
   falsch in beidem. Immer den wirklich gelieferten `blob.type` nehmen,
   nie den angeforderten Typ blind übernehmen. */
export function endungUndArtFuerBlob(blobType, gewuenschterTyp = 'image/webp') {
  const art = blobType || gewuenschterTyp;
  return { endung: endungFuerMime(art, 'png'), art };
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
     wie lange einzelne Netzwerk-Aufrufe brauchen.

   Scheitert ein Schreibvorgang (Netz weg, Anmeldung abgelaufen, Zugriffs-
   regel greift), wird der Stand NICHT weggeworfen: er bleibt als
   "gescheitert" liegen und lässt sich mit wiederholen() erneut losschicken.
   Vorher verschwand er still -- die Anzeige sagte "gespeichert", angekommen
   war nichts. Das ist der schlimmste denkbare Fehler in einem Editor, dessen
   ganzes Versprechen "du musst nie auf Speichern drücken" lautet.

   `beiFehler` ist freiwillig. Fehlt es, fliegt der Fehler weiter wie bisher
   -- damit bleibt jeder vorhandene Aufrufer unverändert gültig.
   beschaeftigt() zählt einen gescheiterten Stand ABSICHTLICH nicht mit:
   sonst würde editorSchliessen() bei dauerhaftem Fehler ewig warten. */
export function erzeugeSpeicherWarteschlange(schreiben, beiFehler = null) {
  let laeuft = false;
  let ausstehend;      // aktuell wartender Stand, oder KEIN_STAND
  const KEIN_STAND = Symbol('kein-stand');
  ausstehend = KEIN_STAND;
  let gescheitert = KEIN_STAND;   // letzter Stand, dessen Schreiben fehlschlug

  async function schritt() {
    laeuft = true;
    const daten = ausstehend;
    ausstehend = KEIN_STAND;
    try {
      await schreiben(daten);
      gescheitert = KEIN_STAND;
    } catch (fehler) {
      gescheitert = daten;          // festhalten, NICHT verwerfen
      if (!beiFehler) throw fehler; // ohne Handler: Verhalten wie bisher
      beiFehler(fehler, daten);
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
    /* Gibt es einen Stand, der nicht angekommen ist? */
    hatFehler() { return gescheitert !== KEIN_STAND; },
    /* Denselben Stand noch einmal losschicken. Ein inzwischen neuerer
       Stand hat Vorrang -- der gescheiterte ist dann ohnehin überholt. */
    wiederholen() {
      if (gescheitert === KEIN_STAND) return false;
      if (ausstehend === KEIN_STAND) ausstehend = gescheitert;
      gescheitert = KEIN_STAND;
      if (!laeuft) schritt();
      return true;
    },
  };
}

/* ---------- Auszeichnungen im Schreibfeld sichtbar machen ----------
   Rein DEKORATIV. Das Textfeld bleibt die alleinige Wahrheit; hier wird nur
   berechnet, was als eingefärbte Schicht HINTER dem durchscheinenden Feld
   liegt. Zwei Invarianten, beide unverhandelbar:

   1. ERHALT -- jedes Zeichen des Rohtexts steht genau einmal im Ergebnis,
      roh oder in einem <span>. Verschwindet auch nur ein Stern, laufen
      Schicht und Textfeld auseinander und die Schrift steht versetzt zum
      Cursor.
   2. METRIK -- keine der erzeugten Klassen darf Glyphen breiter machen.
      KEIN font-weight, KEIN font-style: echtes Fett verschiebt den
      Zeilenumbruch gegenüber dem Textfeld, obwohl alle Zeichen da sind.
      Erlaubt sind nur Farbe, Hintergrund, Unterstreichung und Schatten --
      die malen, ohne das Layout anzufassen.

   EIN Durchlauf mit einem zusammengesetzten Ausdruck, kein verkettetes
   replace(): dessen eingefügte Tags enthielten selbst *, ( und ) und würden
   vom jeweils nächsten Ausdruck erneut getroffen.

   Die Weiche entscheidet nach GRUPPENFÜLLUNG, niemals nach dem ersten
   Zeichen des Treffers. Ein Kursiv-Treffer, dem eine eckige Klammer
   vorausgeht ("[*wichtig*]"), sähe sonst aus wie ein Link-Treffer, griffe
   auf leere Gruppen zu und schriebe "undefined" mitten in Lucas' Text. */
export function auszeichnungsHtml(roh) {
  const s = String(roh ?? '').replace(/[&<>]/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const RE = new RegExp([
    /\(\(([^()\n|]+)((?:[^()\n])*)\)\)/.source,        // 1,2 geheimes Türchen
    /\[\[([^\]\n|]+)((?:[^\]\n])*)\]\]/.source,        // 3,4 Türchen
    /\[([^\]\n]+)\]\(([^()\s]+)\)/.source,             // 5,6 Link
    /\*\*([^*\n]+)\*\*/.source,                        // 7   fett
    /(^|[\s({[])\*([^*\s][^*\n]*?)\*/.source,          // 8,9 kursiv
  ].join('|'), 'g');

  let aus = '', pos = 0, m;
  while ((m = RE.exec(s)) !== null) {
    aus += s.slice(pos, m.index);
    if (m[1] !== undefined) {
      aus += `<span class="hz-m">((</span><span class="hz-geheim">${m[1]}${m[2]}</span><span class="hz-m">))</span>`;
    } else if (m[3] !== undefined) {
      aus += `<span class="hz-m">[[</span><span class="hz-tuer">${m[3]}</span><span class="hz-m">${m[4]}]]</span>`;
    } else if (m[5] !== undefined) {
      aus += `<span class="hz-m">[</span><span class="hz-link">${m[5]}</span><span class="hz-m">](${m[6]})</span>`;
    } else if (m[7] !== undefined) {
      aus += `<span class="hz-fett"><span class="hz-m">**</span>${m[7]}<span class="hz-m">**</span></span>`;
    } else if (m[9] !== undefined) {
      /* m[8] ist das mitgelesene Zeichen VOR dem Stern (oder '' am Anfang)
         -- unbedingt zurückgeben, sonst fehlt es im Ergebnis. */
      aus += `${m[8] ?? ''}<span class="hz-kursiv"><span class="hz-m">*</span>${m[9]}<span class="hz-m">*</span></span>`;
    } else {
      aus += m[0];   // defensiv: im Zweifel Text NIE anfassen
    }
    pos = m.index + m[0].length;
  }
  return aus + s.slice(pos);
}

/* ---------- Entwurf für eine neue Seite ----------
   Liefert GENAU die Felder, die beim Anlegen in die Datenbank geschrieben
   werden -- und ausdrücklich KEIN `id`.

   Genau daran ist das Anlegen einer neuen Seite gescheitert: Der Entwurf
   trug ein `id: null` mit sich, weil dieselbe Form auch als Vorlage für das
   Objekt im Arbeitsspeicher diente. Ein ausdrücklich mitgeschicktes `null`
   schlägt aber den automatischen Vorgabewert der Spalte
   (`gen_random_uuid()`) -- die Datenbank bekam eine leere Kennung und wies
   den Datensatz ab: "null value in column id violates not-null constraint".

   Aufgefallen ist es erst spät, weil alle vorhandenen Seiten aus dem
   Umzugsskript stammen. Der Knopf "+ Neue Seite" war seit dem ersten Tag
   kaputt, nur hatte ihn nie jemand gedrückt.

   Reine Funktion, damit genau das prüfbar ist, ohne sich anzumelden. */
export function leerSeitenEntwurf(typ, vorhandeneSortierungen = []) {
  const zahlen = (vorhandeneSortierungen || []).filter(n => typeof n === 'number' && isFinite(n));
  const max = zahlen.length ? Math.max(0, ...zahlen) : 0;
  return {
    slug: '', typ, titel: '', untertitel: '', kunde: '', jahr: '',
    cover_url: null, cover_pos: '50% 50%', video_url: '', embed_ok: true, farbe: '',
    ist_aktuell: false, status: 'draft', sort_order: max + 10,
  };
}
