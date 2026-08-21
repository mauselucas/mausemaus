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
const IMG_LINE   = /^!\[([^\]]*)\]\(([^)\s]+)\)(?:\{(klein|mittel|gross)\})?$/;
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
        const [, alt, roh, groesse] = zeile.match(IMG_LINE);
        /* Relative Pfade auf die Wurzel beziehen — sonst zeigen sie unter
           /blog/… ins Leere, weil der Browser gegen /blog/ auflöst. */
        const url = /^(https?:|data:|\/)/.test(roh) ? roh : '/' + roh;
        const kl = GROESSEN[groesse] || '';
        return `<figure class="${kl}" data-bild="${nr}">`
          + `<img src="${esc(url)}" alt="${esc(alt)}" loading="lazy">`
          + (alt ? `<figcaption>${inline(alt)}</figcaption>` : '') + '</figure>';
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

window.mm = { esc, inline, renderMarkdown, excerpt, videoEmbed, coverFromVideoUrl, slugify, linkZiel };
