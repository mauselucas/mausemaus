/* Emotes wie im Twitch-Chat: :PepeLaugh: im Text wird ein kleines Bild in
   derselben Zeile (shared.js: emotesEinsetzen; Tabelle `emotes`; Admin:
   emotes-admin.js).

   Geprüft wird, was Lucas sieht: Das Emote steht ZWISCHEN den Wörtern,
   ist gut erkennbar (1,75 x Schrift), reißt die Zeile kaum auf, bewegt
   sich und bleibt durchsichtig. Und im Admin: ":" plus Buchstaben bietet
   Emotes an, Enter setzt sie ein -- mit echten Tastendrücken. */
import { starteChrome, oeffne, pruefe, bericht } from './chrome.mjs';
import { starteServer } from './server.mjs';

const wurzel = new URL('../HOCHLADEN/', import.meta.url).pathname;
const server = await starteServer({ wurzel, port: 8934 });
const chrome = await starteChrome({ port: 9374 });
const ADR = 'http://127.0.0.1:8934/';

async function wirdWahr(seite, ausdruck, frist = 8000, takt = 120) {
  const ende = Date.now() + frist;
  for (;;) {
    let wert = false;
    try { wert = await seite.werte(ausdruck); } catch {}
    if (wert) return true;
    if (Date.now() > ende) return false;
    await new Promise(r => setTimeout(r, takt));
  }
}

/* ================= 1. Startseite: Daten und Umsetzung ================= */
{
  const s = await oeffne(ADR, { port: 9374, breite: 1440, hoehe: 900 });
  await s.bisWahr(`!document.getElementById('mm-laden') && !!window.mmProjekte`, 20000);

  const d = JSON.parse(await s.werte(`JSON.stringify({
    namen: Object.keys(window.mmEmotes || {}).sort(),
    pepe: (window.mmEmotes || {}).PepeLaugh
  })`));
  pruefe('die Emotes kommen aus der Datenbank mit', d.namen.length >= 6 && d.namen.includes('PepeLaugh'), d.namen.join(', '));

  const u = JSON.parse(await s.werte(`(() => {
    const r = (t) => { const x = document.createElement('template'); x.innerHTML = window.mm.renderMarkdown(t); return x.content; };
    const a = r('Haha :PepeLaugh: echt jetzt');
    const img = a.querySelector('img.mm-emote');
    const link = r('[Seite](https://beispiel.de/:PepeLaugh:/x)').querySelector('a');
    return JSON.stringify({
      bild: !!img, alt: img?.getAttribute('alt'), titel: img?.getAttribute('title'),
      src: img?.getAttribute('src'), masse: img ? img.getAttribute('width') + 'x' + img.getAttribute('height') : '',
      imAbsatz: img?.parentElement?.tagName, text: a.textContent,
      unbekannt: r('So :GibtsNicht: eben').querySelector('img') ? 'Bild' : r('So :GibtsNicht: eben').textContent,
      klein: !!r('ein :pepelaugh: klein').querySelector('img'),
      uhr: r('um 10:30:00 Uhr').textContent,
      href: link?.getAttribute('href'),
      zwei: r(':peepoHey: und :Weirdge:').querySelectorAll('img.mm-emote').length,
      auszug: window.mm.excerpt('Haha :PepeLaugh: echt')
    });
  })()`));
  pruefe(':PepeLaugh: im Text wird ein Bild', u.bild && /PepeLaugh/.test(u.src), u.src);
  pruefe('…mitten im Absatz, zwischen den Wörtern', u.imAbsatz === 'P' && u.text.replace(/\s+/g, ' ').trim() === 'Haha echt jetzt', u.imAbsatz + ' / ' + u.text);
  pruefe('…mit dem Namen für Screenreader und beim Drüberfahren', u.alt === ':PepeLaugh:' && u.titel === 'PepeLaugh');
  pruefe('…und seinen Maßen (kein Springen beim Laden)', u.masse === '64x64', u.masse);
  pruefe('mehrere Emotes in einem Satz', u.zwei === 2, String(u.zwei));
  pruefe('ein unbekannter Name bleibt als Text stehen, keine Lücke', u.unbekannt === 'So :GibtsNicht: eben', u.unbekannt);
  pruefe('Groß-/Kleinschreibung zählt (:pepelaugh: bleibt Text)', !u.klein);
  pruefe('Uhrzeiten bleiben unangetastet', u.uhr === 'um 10:30:00 Uhr', u.uhr);
  pruefe('in einer Link-Adresse wird nichts ersetzt', u.href === 'https://beispiel.de/:PepeLaugh:/x', u.href);
  pruefe('Vorschautexte (Google, Teilen) zeigen keine :Namen:', u.auszug === 'Haha echt', u.auszug);

  /* ---- So sieht es im Brief aus: echter Absatz, echte Schrift ---- */
  const m = JSON.parse(await s.werte(`(async () => {
    const ziel = document.querySelector('#brief .br-text');
    const mit = document.createElement('div'); mit.className = 'br-text';
    mit.innerHTML = window.mm.renderMarkdown('Das war ein Spaß :PepeLaugh: wirklich.');
    const ohne = document.createElement('div'); ohne.className = 'br-text';
    ohne.innerHTML = window.mm.renderMarkdown('Das war ein Spaß wirklich.');
    ziel.after(mit, ohne);
    const img = mit.querySelector('img.mm-emote');
    await img.decode().catch(() => {});
    const p = mit.querySelector('p'), wort = document.createRange();
    wort.selectNodeContents(p.lastChild);
    const w = wort.getBoundingClientRect(), b = img.getBoundingClientRect();
    const cs = getComputedStyle(img), fs = parseFloat(getComputedStyle(p).fontSize);
    const r = JSON.stringify({ hoehe: b.height, fs, breite: b.width, display: cs.display,
      mitte: (b.top + b.bottom) / 2, wortMitte: (w.top + w.bottom) / 2,
      zeileMit: p.getBoundingClientRect().height, zeileOhne: ohne.querySelector('p').getBoundingClientRect().height,
      geladen: img.naturalWidth });
    mit.remove(); ohne.remove();
    return r;
  })()`));
  pruefe('im Brief: Emote geladen', m.geladen > 0, String(m.geladen));
  pruefe('…gut erkennbar: 1,75 × Schrifthöhe', Math.abs(m.hoehe - 1.75 * m.fs) <= 1, `${m.hoehe.toFixed(1)} px bei ${m.fs} px Schrift`);
  pruefe('…steht IN der Zeile (nicht als eigener Block)', m.display === 'inline-block' && m.breite < 3 * m.fs, `${m.display}, ${Math.round(m.breite)} px breit`);
  pruefe('…auf Höhe der Wörter daneben', Math.abs(m.mitte - m.wortMitte) <= 0.25 * m.fs, `${(m.mitte - m.wortMitte).toFixed(1)} px versetzt`);
  pruefe('…und macht die Zeile kaum höher (≤ 4 px)', m.zeileMit - m.zeileOhne <= 4, `${m.zeileOhne} → ${m.zeileMit} px`);

  /* ---- Die Dateien selbst: bewegt und durchsichtig ---- */
  const f = JSON.parse(await s.werte(`(async () => {
    const lies = async (url) => {
      const r = await fetch(url);
      const dec = new ImageDecoder({ data: await r.arrayBuffer(), type: r.headers.get('content-type') });
      await dec.tracks.ready; await dec.completed;
      const bild = (await dec.decode({ frameIndex: 0 })).image;
      const c = new OffscreenCanvas(bild.displayWidth, bild.displayHeight).getContext('2d');
      c.drawImage(bild, 0, 0); bild.close();
      const px = c.getImageData(0, 0, c.canvas.width, c.canvas.height).data;
      let frei = 0; for (let i = 3; i < px.length; i += 4) if (px[i] < 250) frei++;
      return { typ: r.headers.get('content-type'), bilder: dec.tracks.selectedTrack.frameCount, frei };
    };
    return JSON.stringify({ pepe: await lies(window.mmEmotes.PepeLaugh.url), weird: await lies(window.mmEmotes.Weirdge.url) });
  })()`));
  pruefe('Emote-Dateien kommen als image/avif', f.pepe.typ === 'image/avif', f.pepe.typ);
  pruefe('PepeLaugh bewegt sich (mehrere Einzelbilder)', f.pepe.bilder > 1, f.pepe.bilder + ' Bilder');
  pruefe('…und ist durchsichtig (kein Kasten um das Emote)', f.pepe.frei > 0, f.pepe.frei + ' durchsichtige Pixel');
  pruefe('Weirdge ist ein Standbild und wird trotzdem gezeigt', f.weird.bilder === 1);
  pruefe('keine JS-Fehler', s.fehlerAufSeite().length === 0, s.fehlerAufSeite().join(' | '));
  await s.zu();
}

/* ================= 2. Admin: Vorschläge beim Tippen ================= */
{
  const s = await oeffne(ADR + '404.html', { port: 9374, breite: 1280, hoehe: 800 });
  await s.bisWahr(`document.readyState === 'complete'`, 10000);
  /* Ein nachgebauter Datenbank-Zugang: Die Prüfung soll nicht am Login
     hängen, und schreiben darf sie in die echte Datenbank ohnehin nicht. */
  await s.werte(`(async () => {
    const app = document.createElement('div'); app.id = 'app';
    app.innerHTML = '<button id="btn-backup">Sicherung</button><textarea id="feld" style="width:500px;height:120px;font:16px/1.5 sans-serif"></textarea>';
    document.body.appendChild(app);
    const daten = ['GIGACHAD', 'HACKERMANS', 'PepeLaugh', 'peepoHey', 'peepoShy', 'Weirdge']
      .map((n, i) => ({ id: 'e' + i, name: n, url: '/emotes/' + n + (n === 'Weirdge' ? '-84x64' : '-64x64') + '.avif', breite: n === 'Weirdge' ? 84 : 64, hoehe: 64 }));
    const sb = { from: () => ({ select: () => ({ order: async () => ({ data: daten, error: null }) }) }) };
    const mod = await import('/assets/emotes-admin.js');
    window.__name = mod.nameAusDatei;
    const e = mod.richteEmotesEin({ sb, toast: () => {}, laden: () => {}, esc: window.mm.esc });
    await e.holen();
    window.__eingaben = 0;
    document.getElementById('feld').addEventListener('input', () => window.__eingaben++);
    document.getElementById('feld').focus();
  })()`);
  pruefe('Name aus dem Dateinamen: "PepeLaugh-2x.avif" → PepeLaugh',
    await s.werte(`__name('PepeLaugh-2x.avif') === 'PepeLaugh' && __name('Weirdge-2x.avif') === 'Weirdge' && __name('mein emote 1x.webp') === 'meinemote'`));
  pruefe('im Admin gibt es den Knopf "Emotes"', await s.werte(`!!document.getElementById('btn-emotes')`));

  await s.tippe('Das war lustig :pe');
  const v = JSON.parse(await s.werte(`JSON.stringify({
    offen: !document.querySelector('.emote-vorschlaege').hidden,
    namen: [...document.querySelectorAll('.emote-vorschlaege li')].map(l => l.textContent.trim()),
    bilder: document.querySelectorAll('.emote-vorschlaege li img').length })`));
  pruefe('":pe" öffnet Vorschläge', v.offen, JSON.stringify(v.namen));
  pruefe('…mit Vorschaubild und passenden Namen zuerst', v.namen[0] === ':PepeLaugh:' && v.namen.includes(':peepoHey:') && v.bilder === v.namen.length,
    v.namen.join(' '));
  await s.taste('ArrowDown', 'ArrowDown', 40);
  await s.taste('Enter', 'Enter', 13);
  const nach = JSON.parse(await s.werte(`JSON.stringify({ wert: document.getElementById('feld').value,
    zu: document.querySelector('.emote-vorschlaege').hidden, eingaben: __eingaben })`));
  pruefe('Pfeil runter + Enter setzt das zweite Emote ein', nach.wert === 'Das war lustig :peepoHey: ', JSON.stringify(nach.wert));
  pruefe('…die Liste geht zu, und gespeichert wird (input-Ereignis)', nach.zu && nach.eingaben >= 2);
  /* Ohne offene Liste darf Enter NICHT abgefangen werden -- sonst gäbe es
     im ganzen Editor keine neue Zeile mehr. */
  pruefe('ohne Vorschläge bleibt Enter normales Enter', await s.werte(`(() => {
    const ev = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    document.getElementById('feld').dispatchEvent(ev); return !ev.defaultPrevented; })()`));
  await s.tippe(':xyzq');
  pruefe('ohne Treffer keine leere Liste', await s.werte(`document.querySelector('.emote-vorschlaege').hidden`));
  await s.tippe(' :Gi');
  await wirdWahr(s, `!document.querySelector('.emote-vorschlaege').hidden`, 2000);
  await s.taste('Escape', 'Escape', 27);
  pruefe('Esc schließt die Liste und lässt den Text stehen', await s.werte(
    `document.querySelector('.emote-vorschlaege').hidden && document.getElementById('feld').value.endsWith(':Gi')`));
  pruefe('keine JS-Fehler im Admin-Teil', s.fehlerAufSeite().length === 0, s.fehlerAufSeite().join(' | '));
  await s.zu();
}

chrome.beenden(); server.beenden();
bericht();
