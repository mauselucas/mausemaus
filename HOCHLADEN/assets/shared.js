/* mausemaus — gemeinsame Bausteine
   Wird von index.html (öffentliche Seite) UND admin.html (Live-Vorschau) geladen.
   Dadurch ist die Vorschau im Admin garantiert identisch mit dem, was Besucher sehen. */

/* ---------- Helfer ---------- */

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

/* Video-URL -> Einbett-URL. Erkennt YouTube (auch youtu.be und /shorts/) und Vimeo. */
function videoEmbed(url) {
  const u = String(url).trim();
  let m = u.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/);
  if (m) return { kind: 'youtube', id: m[1], src: `https://www.youtube-nocookie.com/embed/${m[1]}` };
  m = u.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (m) return { kind: 'vimeo', id: m[1], src: `https://player.vimeo.com/video/${m[1]}` };
  return null;
}

/* YouTube-Thumbnail zu einer Video-URL — für "Cover automatisch aus Link". */
function coverFromVideoUrl(url) {
  const v = videoEmbed(url);
  return v && v.kind === 'youtube' ? `https://i.ytimg.com/vi/${v.id}/maxresdefault.jpg` : null;
}

/* ---------- Markdown (bewusst winziger Dialekt) ---------- */

/* Fett/kursiv/Links innerhalb einer Zeile. Alles andere wird escaped. */
function inline(t) {
  let s = esc(t);
  /* Hintertürchen. Zwei Schreibweisen:
       [[Wort|slug|Titel|Text]]   sichtbare Tür, mit Blümchen
       ((Wort|slug|Titel|Text))   Geheimtür, ohne Kennzeichen — leuchtet nur
                                  auf, wenn jemand zufällig darüberfährt
     Müssen vor allen anderen Regeln stehen, sonst frisst die Link-Regel die
     inneren Klammern. s ist hier bereits durch esc() gelaufen — nicht noch
     einmal maskieren. */
  const tuer = (wort, slug, titel, text, geheim) => {
    const rein = x => String(x || '').trim().replace(/"/g, '&quot;');
    /* slugify() beherrscht Umlaute: aus "Grün" wird "gruen", nicht "Grn". */
    const ziel = slugify(rein(slug));
    if (!ziel) return wort;
    return '<a class="mm-tuer' + (geheim ? ' mm-tuer-geheim' : '') +
           '" href="/welt/' + ziel + '"' +
           ' data-titel="' + rein(titel) + '"' +
           ' data-text="' + rein(text) + '">' + wort.trim() + '</a>';
  };
  s = s.replace(/\[\[([^\]|]+)\|([^\]|]+)(?:\|([^\]|]*))?(?:\|([^\]|]*))?\]\]/g,
    (_, w, sl, t, x) => tuer(w, sl, t, x, false));
  s = s.replace(/\(\(([^)|]+)\|([^)|]+)(?:\|([^)|]*))?(?:\|([^)|]*))?\)\)/g,
    (_, w, sl, t, x) => tuer(w, sl, t, x, true));
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (ganz, text, ziel) => {
    const url = linkZiel(ziel);
    return url ? `<a href="${url}" target="_blank" rel="noopener">${text}</a>` : ganz;
  });
  return s;
}

/* Prüft und vervollständigt eine Adresse. Fehlendes https:// wird ergänzt —
   sonst bliebe [Anleitung](www.beispiel.de) stillschweigend roher Text.
   Gibt null zurück, wenn es gar nicht nach einer Adresse aussieht. */
function linkZiel(ziel) {
  const z = String(ziel).trim();
  if (/^(https?:\/\/|mailto:|tel:|\/|#)/i.test(z)) return z;
  if (/^[\w-]+(\.[\w-]+)+([\/?#]|$)/.test(z)) return 'https://' + z;
  return null;
}

/* Bild-Zeile, optional mit Größenangabe: ![Text](bild.jpg){klein} */
/* Eine Bild-Zeile:  ![Unterschrift](adresse){groesse}{Beschreibung}
   Beide {…} sind freiwillig.

   WARUM zwei getrennte Texte: Bis hierher gab es nur EINEN, und der landete
   gleichzeitig im alt-Attribut UND sichtbar als Bildunterschrift. Wer ein
   Bild für Blinde beschreiben wollte, musste diese Beschreibung also allen
   sichtbar unter das Bild schreiben -- weshalb es niemand tat und saemtliche
   Bilder der Seite ohne alt-Text dastanden. Jetzt gilt:
     Gruppe 1  Unterschrift  -> sichtbar als <figcaption>
     Gruppe 4  Beschreibung  -> unsichtbar, nur als alt-Attribut
   Fehlt die Beschreibung, springt wie bisher die Unterschrift ein: alle
   bestehenden Inhalte verhalten sich dadurch haargenau wie vorher. */
const IMG_LINE   = /^!\[([^\]]*)\]\(([^)\s]+)\)(?:\{(klein|mittel|gross)\})?(?:\{([^}]*)\})?$/;

/* Liest die Bildmaße aus dem Dateinamen (…-1600x900.webp) und macht daraus
   width/height am <img>.

   Wozu: Ohne diese Angaben ist ein Bild fuer den Browser bis zum Laden
   0 Pixel hoch. Steht es erst einmal da, springt alles darunter nach unten
   -- besonders auffaellig hier, weil die Zeitleiste links sich danach neu
   vermessen muss. Mit width/height kennt der Browser das Seitenverhaeltnis
   von Anfang an und haelt den Platz frei.

   Die Maße vergibt admin.js beim Hochladen. Bilder von frueher tragen sie
   nicht -- die bekommen wie bisher gar keine Angabe und verhalten sich
   unveraendert. */
const MASSE_IM_NAMEN = /-(\d{2,5})x(\d{2,5})\.[a-z0-9]+(?:[?#]|$)/i;
function masseVon(url) {
  const t = String(url).match(MASSE_IM_NAMEN);
  return t ? ` width="${t[1]}" height="${t[2]}"` : '';
}
const GROESSEN   = { klein: 'mm-klein', mittel: 'mm-mittel', gross: '' };

/* Etikett oben links am Code-Block. Schlüssel = was du hinter ``` schreibst. */
const SPRACHEN = {
  jsx:          { label: 'ExtendScript · After Effects', hl: 'javascript' },
  extendscript: { label: 'ExtendScript · After Effects', hl: 'javascript' },
  js:           { label: 'JavaScript',  hl: 'javascript' },
  javascript:   { label: 'JavaScript',  hl: 'javascript' },
  swift:        { label: 'Swift',       hl: 'swift' },
  bash:         { label: 'Terminal',    hl: 'bash' },
  sh:           { label: 'Terminal',    hl: 'bash' },
  json:         { label: 'JSON',        hl: 'json' },
  csv:          { label: 'CSV',         hl: 'plaintext' },
  '':           { label: 'Code',        hl: 'plaintext' },
};
const VIDEO_LINE = /^(https?:\/\/\S+)$/;

/* Markdown -> HTML. Gibt nur bekannte Konstrukte aus, alles andere wird escaped. */
function renderMarkdown(src) {
  const lines = String(src ?? '').replace(/\r\n?/g, '\n').split('\n');
  const html = [];
  let para = [], list = [], quote = [], bildNr = 0;

  const flushPara  = () => { if (para.length)  { html.push(`<p>${inline(para.join(' '))}</p>`); para = []; } };
  const flushList  = () => { if (list.length)  { html.push(`<ul>${list.map(i => `<li>${inline(i)}</li>`).join('')}</ul>`); list = []; } };
  const flushQuote = () => { if (quote.length) { html.push(`<blockquote>${inline(quote.join(' '))}</blockquote>`); quote = []; } };
  const flushAll   = () => { flushPara(); flushList(); flushQuote(); };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (!line) { flushAll(); continue; }

    /* Textblock mit Bildern daneben:  :::  …  :::
       Alles Geschriebene landet links, Bilder rechts.
       Mit ":::links" stehen die Bilder stattdessen links. */
    if (/^:::/.test(line)) {
      flushAll();
      const bilderLinks = /^:::\s*links/.test(line);
      const inhalt = [];
      i++;
      while (i < lines.length && !/^:::\s*$/.test(lines[i].trim())) inhalt.push(lines[i]), i++;

      const istBild = (z) => IMG_LINE.test(z.trim());
      const bilder  = inhalt.filter(istBild);
      const text    = inhalt.filter(z => !istBild(z));

      html.push(
        `<div class="mm-block${bilderLinks ? ' mm-block-links' : ''}">`
        + `<div class="mm-block-text">${renderMarkdown(text.join('\n'))}</div>`
        + `<div class="mm-block-media">${renderMarkdown(bilder.join('\n'))}</div>`
        + '</div>');
      continue;
    }

    /* Code-Block: ```sprache … ```  — muss VOR allem anderen geprüft werden,
       damit der Inhalt nicht als Markdown weiterverarbeitet wird. */
    if (line.startsWith('```')) {
      flushAll();
      const kennung = line.slice(3).trim().toLowerCase();
      const spr = SPRACHEN[kennung] || SPRACHEN[''];
      const inhalt = [];
      i++;
      /* Rohzeilen sammeln — Einrückung muss erhalten bleiben. */
      while (i < lines.length && !lines[i].trim().startsWith('```')) inhalt.push(lines[i]), i++;
      html.push(
        '<figure class="code-block">'
        + '<figcaption class="code-kopf">'
        +   `<span class="code-sprache">${esc(spr.label)}</span>`
        +   '<button type="button" class="code-kopieren">Kopieren</button>'
        + '</figcaption>'
        + `<pre><code class="language-${esc(spr.hl)}">${esc(inhalt.join('\n'))}</code></pre>`
        + '</figure>');
      continue;
    }

    /* Platzhalter für eine interaktive Einlage: ::demo kennung */
    const demo = line.match(/^::demo\s+([\w-]+)$/);
    if (demo) {
      flushAll();
      html.push(`<div class="mm-demo" data-demo="${esc(demo[1])}"></div>`);
      continue;
    }

    /* --- Trennstrich mit Blume in der Mitte --- */
    if (/^-{3,}$/.test(line)) {
      flushAll();
      html.push('<div class="md-rule"><svg viewBox="0 0 303.13 275.3"><use href="#bl-a"/></svg></div>');
      continue;
    }

    /* Überschriften */
    const h = line.match(/^(#{2,3})\s+(.*)$/);
    if (h) { flushAll(); const lvl = h[1].length; html.push(`<h${lvl} class="tropi">${inline(h[2])}</h${lvl}>`); continue; }

    /* Bilder. Ohne Größenangabe werden direkt aufeinanderfolgende zur Galerie
       nebeneinander gestellt; ein Bild mit eigener Größe steht immer für sich. */
    if (IMG_LINE.test(line)) {
      flushAll();
      const bild = (zeile, nr) => {
        const [, unterschrift, roh, groesse, beschreibung] = zeile.match(IMG_LINE);
        /* Das alt-Attribut ist das, was ein Screenreader VORLIEST. Erste Wahl
           ist die eigens dafuer gedachte Beschreibung; gibt es keine, ist die
           Unterschrift immer noch besser als nichts. */
        const alt = beschreibung || unterschrift || '';
        /* Relative Pfade auf die Wurzel beziehen — sonst zeigen sie unter
           /blog/… ins Leere, weil der Browser gegen /blog/ auflöst. */
        const url = /^(https?:|data:|\/)/.test(roh) ? roh : '/' + roh;
        const kl = GROESSEN[groesse] || '';
        return `<figure class="${kl}" data-bild="${nr}">`
          + `<img src="${esc(url)}" alt="${esc(alt)}" loading="lazy"${masseVon(url)}>`
          + (unterschrift ? `<figcaption>${inline(unterschrift)}</figcaption>` : '') + '</figure>';
      };
      const eigeneGroesse = (z) => !!z.match(IMG_LINE)[3];

      if (eigeneGroesse(line)) {
        html.push(`<div class="md-gallery md-gallery-1">${bild(line, bildNr++)}</div>`);
        continue;
      }
      const group = [];
      while (i < lines.length && IMG_LINE.test(lines[i].trim()) && !eigeneGroesse(lines[i].trim())) {
        group.push(bild(lines[i].trim(), bildNr++));
        i++;
      }
      i--;
      html.push(`<div class="md-gallery md-gallery-${Math.min(group.length, 3)}">${group.join('')}</div>`);
      continue;
    }

    /* Video allein auf einer Zeile */
    if (VIDEO_LINE.test(line)) {
      const v = videoEmbed(line);
      if (v) {
        flushAll();
        html.push(`<div class="md-video"><iframe src="${esc(v.src)}" loading="lazy" allowfullscreen `
          + `allow="accelerometer; clipboard-write; encrypted-media; picture-in-picture" `
          + `referrerpolicy="strict-origin-when-cross-origin" title="Video"></iframe></div>`);
        continue;
      }
    }

    /* Liste */
    if (/^[-*]\s+/.test(line)) { flushPara(); flushQuote(); list.push(line.replace(/^[-*]\s+/, '')); continue; }

    /* Zitat */
    if (/^>\s?/.test(line)) { flushPara(); flushList(); quote.push(line.replace(/^>\s?/, '')); continue; }

    flushList(); flushQuote();
    para.push(line);
  }
  flushAll();
  return html.join('\n');
}

/* ---------- Blöcke (für den Umzug nach seiten/bloecke) ---------- */

/* Zerlegt einen Markdown-Rohtext in eine Folge von Blöcken, an genau den
   Stellen, an denen renderMarkdown() auch eine neue Auszeichnung erkennt
   (Überschrift, Bild(er), Video, Code, ::demo, :::-Block, --- Trenner).
   Alles andere (Absätze, Listen, Zitate) bleibt als roher Text in einem
   'text'-Block zusammen -- beim Anzeigen läuft er GENAU durch dieselbe
   renderMarkdown()-Funktion wie früher, nur eben einzeln pro Block. Damit
   kann die Zerlegung selbst nie einen Unterschied im Ergebnis erzeugen:
   jeder Block ist wörtlich ein Ausschnitt aus dem Original.
   Gibt eine Liste { typ, roh } zurück -- 'roh' ist das arg für renderMarkdown(). */
function splitBlocks(src) {
  const lines = String(src ?? '').replace(/\r\n?/g, '\n').split('\n');
  const bloecke = [];
  let sammel = [];

  const flushText = () => {
    while (sammel.length && sammel[0].trim() === '') sammel.shift();
    while (sammel.length && sammel[sammel.length - 1].trim() === '') sammel.pop();
    if (sammel.length) bloecke.push({ typ: 'text', roh: sammel.join('\n') });
    sammel = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const roh0 = lines[i];
    const line = roh0.trim();

    if (!line) {
      /* Eine Leerzeile beendet einen zusammenhängenden Textabschnitt --
         mehrere Leerzeilen hintereinander werden dabei zu einer Grenze
         zusammengefasst, genau wie renderMarkdown() es beim Aufsammeln tut. */
      if (sammel.some(z => z.trim() !== '')) flushText();
      continue;
    }

    /* Textblock mit Bildern daneben: ::: … ::: -- als Ganzes ein Block,
       damit renderMarkdown() ihn beim Anzeigen wieder als Einheit erkennt. */
    if (/^:::/.test(line)) {
      flushText();
      const start = i;
      i++;
      while (i < lines.length && !/^:::\s*$/.test(lines[i].trim())) i++;
      bloecke.push({ typ: 'text_mit_bild', roh: lines.slice(start, i + 1).join('\n') });
      continue;
    }

    /* Code-Block: ```sprache … ``` */
    if (line.startsWith('```')) {
      flushText();
      const start = i;
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) i++;
      bloecke.push({ typ: 'code', roh: lines.slice(start, i + 1).join('\n') });
      continue;
    }

    /* Einlage: ::demo kennung -> eigener Block, Blockart "werkzeug" */
    if (/^::demo\s+[\w-]+$/.test(line)) {
      flushText();
      bloecke.push({ typ: 'werkzeug', roh: line });
      continue;
    }

    /* Trennstrich */
    if (/^-{3,}$/.test(line)) {
      flushText();
      bloecke.push({ typ: 'trenner', roh: line });
      continue;
    }

    /* Überschrift */
    if (/^#{2,3}\s+.*$/.test(line)) {
      flushText();
      bloecke.push({ typ: 'ueberschrift', roh: line });
      continue;
    }

    /* Bild(er). Ein Bild mit eigener Größe oder ein GIF steht immer für
       sich; unbenannte Bilder direkt hintereinander bilden einen Block
       (aus dem renderMarkdown() beim Anzeigen wieder eine Galerie macht). */
    if (IMG_LINE.test(line)) {
      flushText();
      const istGif = z => /\.gif(\?|#|$)/i.test(z.match(IMG_LINE)[2]);
      const eigeneGroesse = z => !!z.match(IMG_LINE)[3];
      if (eigeneGroesse(line) || istGif(line)) {
        bloecke.push({ typ: istGif(line) ? 'gif' : 'bild', roh: line });
        continue;
      }
      const gruppe = [];
      while (i < lines.length && IMG_LINE.test(lines[i].trim()) &&
             !eigeneGroesse(lines[i].trim()) && !istGif(lines[i].trim())) {
        gruppe.push(lines[i].trim());
        i++;
      }
      i--;
      bloecke.push({ typ: 'bild', roh: gruppe.join('\n') });
      continue;
    }

    /* Video allein auf einer Zeile -- nur, wenn es wirklich eins ist.
       Sonst (wie in renderMarkdown()) als normale Textzeile weiterlaufen. */
    if (VIDEO_LINE.test(line) && videoEmbed(line)) {
      flushText();
      bloecke.push({ typ: 'video', roh: line });
      continue;
    }

    sammel.push(roh0);
  }
  flushText();
  return bloecke;
}

/* Kurzfassung für die Kachel, falls keine eigene Zusammenfassung gepflegt ist. */
function excerpt(md, max = 150) {
  const plain = String(md ?? '')
    .replace(/^!\[.*$/gm, '').replace(/^https?:\/\/\S+$/gm, '')
    .replace(/^#{2,3}\s+/gm, '').replace(/^-{3,}$/gm, '')
    .replace(/[*>_`]/g, '').replace(/\s+/g, ' ').trim();
  return plain.length > max ? plain.slice(0, max).replace(/\s\S*$/, '') + '…' : plain;
}

const slugify = (s) => String(s).toLowerCase()
  .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

window.mm = { esc, inline, renderMarkdown, excerpt, videoEmbed, coverFromVideoUrl, slugify, linkZiel, splitBlocks };

/* Die Blumenformen, auf die der Trenner (---) verweist. Sie gehören hierher und
   nicht in eine einzelne HTML-Datei: Wer diesen Umsetzer lädt, bekommt sie mit.
   Beim Umbau auf den Brief sind sie genau deshalb einmal verlorengegangen. */
(() => {
  if (document.getElementById('mm-blumen')) return;
  const anlegen = () => {
    if (document.getElementById('mm-blumen')) return;
    const h = document.createElement('div');
    h.id = 'mm-blumen';
    h.setAttribute('aria-hidden', 'true');
    h.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    h.innerHTML = '<svg><defs><g id="bl-a"><path d="M133.16,237.99c-27.41,30.79-70.23,50.09-108.82,27.42-52.03-30.05-9.9-88.95,26.67-111.64,13.68-9.57-3.11-19.24-9.83-27.25-22.29-22.11-15.89-64.81,14.36-76.37,19.47-7.55,41.05-1.43,59.19,7.2,30.33,16.74,20.74-31.04,56.28-50.89,20.6-12.12,49.99-6.68,64.78,12.11,21.92,29.53-20.36,62.52,7.41,59.6,63.44-16.1,84.14,47.01,24.47,73.12-25.08,15.3,28.46,25.23,33.07,68.9,1.88,50.65-67.55,63.04-101.36,36.42-31.17-16.42-35.94-52.26-66.21-18.63ZM181.49,172.16c25.07-7.83,36.49-38.21,21.19-60.04-21.35-29.92-69.93-20.46-76.64,16.25-4.81,30.78,27.11,53.37,55.45,43.78Z"/></g><g id="bl-b"><path d="M256.5,328.87c-22.51,14.23-48.14-36.46-58.53-58.06-6.58-13.69-11.73-26.84-16.73-42.16l-15.67,55.34c-4.2,14.84-10.13,28.64-18.18,41.55-6.76,10.84-18.22,17.35-27.79,11.41-17.3-10.74,1.21-70.61,8.28-94.15-12.5,10.06-24.62,18.92-37.29,28.09s-24.16,19.55-40.49,20.01c-6.27.18-11.1-3.46-12.62-9.44-6.64-26.27,38.34-63.7,59.56-81.22-22.31,3.93-43.65,7.49-65.96,8.35-15.62.61-32.67-1.35-30.96-16.29,3.49-30.49,61.98-35.81,91.13-37.86-22.79-18.55-61.71-52.96-67.28-79.68-1.3-6.23-.13-13.43,5.23-16.85,19.45-12.39,72.72,34.04,92.96,50.12-9.68-25.92-38.97-95.88-14.25-106.71,29.53-12.94,53.73,72.87,62.42,98.82,4.28-26.93,9.5-59.45,21.4-82.07,5.79-11.01,16.69-20.48,25.64-15.67,2.57,1.38,5.4,5.07,5.99,8.66,4.34,26.19-6.93,57.18-14.12,84.35,12.33-16.41,22.54-32.45,35.81-46.96,10.23-11.19,26.96-22.39,37.46-12.62,7.21,6.71.88,26.18-4.76,37.29-8.02,15.81-17.66,30.08-28.26,44.67,22.89-8.55,45.69-15.14,69.64-19.21,5.32-.9,11.44.6,14.81,4.24,12.13,13.1-13.98,33.36-28.67,42.69-16.64,10.57-34.6,16.48-54.32,22.32,24.64,5.93,48.87,12.88,71.86,23.88,13.56,6.48,28.35,16.09,26.2,29.84-.66,4.2-4.05,9.24-8.77,11.78-26.52,14.26-83.82-10.23-114.11-22.89,11.57,23.04,22.55,45.63,31.22,69.69,4.36,12.1,6.57,24.11,6.09,36.61-1.19,5.3-3.39,9.9-6.94,12.14ZM191.09,204.76c11.78-6.75,19.92-18.31,23.46-31.21,3.1-11.28.64-21.95-5.7-31.31-9.94-14.69-24.98-23.49-43.4-23.59-21.07-.12-39.78,15.4-44.04,36.2-1.93,9.42-1.15,19.54,2.99,27.98l3.31,6.76c7.52,15.33,40.73,28.15,63.37,15.18Z"/><path d="M171.64,182.31c4.96-1.04,3.31-9,7.68-10.88,2.15-.92,6.38.16,6.74,2.18,1.17,6.52-2.31,12.02-6.4,15.42-4.75,3.94-11.02,5.03-17.01,3.39-7.97-2.19-14.1-7.81-15.72-16.35-.31-1.63,1.59-4.46,2.94-5.26s5.68-.41,6.33,1.04c1.7,6.93,7.93,12.03,15.43,10.45Z"/><circle cx="150.71" cy="156.98" r="5.18"/><circle cx="167.68" cy="165.04" r="5.18"/><circle cx="185.13" cy="153.98" r="5.19"/></g><g id="bl-c"><path d="M304.65,412.67c-30.63-4.53-62.93-28.94-71.23-59.85l-5.11-27.79c-18.9,56.57-87.34,84.22-139.4,55.87-33.8-18.4-49.38-56.85-38.06-93.7,8.48-27.6,29.3-48.55,55.74-60.26-44.22-.17-87.83-23.14-103.03-64.46-8.89-25.96-.75-53.55,20.66-70.59,41.36-32.9,107.68-22.24,143.74,16.59,3.32-44.04,31.7-83.16,70.66-100.68,36.55-15.97,76.78-7.99,94.19,29.13,14.18,32.71,4.81,68.65-15.33,98.19,39.6-25.22,102.34-34.5,138.76-5.11,16.24,13.11,22.29,33.52,15.8,53.45-14.6,44.8-73.87,71.84-120.58,71.51,13.18,6.09,23.93,15.47,32.56,27.32,7.57,10.39,14.26,20.59,17.94,32.99,7.13,22.02,3.12,44.94-11.64,63.21-20.38,25.24-53.1,38.98-85.66,34.17ZM242.55,257.05c31.45-2.95,52.52-30.48,47.74-61.23-5.2-33.43-37.29-56.96-70.71-52.43-30.72,4.17-50.81,32.34-44.91,62.8,6.06,31.3,35.43,53.91,67.88,50.87Z"/></g></defs></svg>';
    document.body.prepend(h);
  };
  if (document.body) anlegen();
  else document.addEventListener('DOMContentLoaded', anlegen);
})();
