/* Loop-Videos statt GIFs (shared.js: loopVideo, loopsBeobachten;
   admin: loopvideo.js).

   Ein GIF von 4 Sekunden war hier 43 MB groß, dasselbe als MP4 0,76 MB.
   Geprüft wird beides, was dafür nötig ist:
     1. Auf der Seite: Eine .mp4 in einer Bildzeile wird zum stummen,
        endlosen Video mit Standbild, das erst beim Hinscrollen lädt und
        spielt und bei "Bewegung reduzieren" stillsteht.
     2. Im Admin: Aus einem Full-HD-Video mit Ton wird ein 1280 px breites
        H.264-MP4 ohne Ton, mit Faststart und Poster -- und aus einem GIF
        ebenso ein MP4. Gerechnet wird in echtem Chrome, nicht nachgebaut. */
import { readFileSync } from 'node:fs';
import { starteChrome, oeffne, pruefe, bericht } from './chrome.mjs';
import { starteServer } from './server.mjs';

const wurzel = new URL('../HOCHLADEN/', import.meta.url).pathname;
const server = await starteServer({ wurzel, port: 8933 });
const chrome = await starteChrome({ port: 9373 });
const ADR = 'http://127.0.0.1:8933/';

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
const bereit = (s) => s.bisWahr(`!document.getElementById('mm-laden') && !!window.mmProjekte`, 20000);

/* ================= 1. Umsetzung einer Bildzeile ================= */
{
  const s = await oeffne(ADR, { port: 9373, breite: 1440, hoehe: 900 });
  await bereit(s);
  const u = JSON.parse(await s.werte(`(() => {
    /* <template>: Der Inhalt wird gelesen, aber nichts davon geladen --
       sonst fragte der Browser das (erfundene) Standbild an. */
    const t = document.createElement('template');
    t.innerHTML = window.mm.renderMarkdown('![](/medien/x/clip-800x450.mp4){gross}{Ein Clip}');
    const box = t.content;
    const v = box.querySelector('video');
    const gt = document.createElement('template');
    gt.innerHTML = window.mm.renderMarkdown('![](/medien/x/alt-800x450.gif){gross}{Ein GIF}');
    return JSON.stringify({
      video: !!v, img: !!box.querySelector('img'),
      klasse: v?.className, muted: v?.hasAttribute('muted'), loop: v?.hasAttribute('loop'),
      inline: v?.hasAttribute('playsinline'), autoplay: v?.hasAttribute('autoplay'),
      preload: v?.getAttribute('preload'), poster: v?.getAttribute('poster'),
      masse: v ? v.getAttribute('width') + 'x' + v.getAttribute('height') : '',
      label: v?.getAttribute('aria-label'),
      gifBleibtBild: !!gt.content.querySelector('img') && !gt.content.querySelector('video'),
      blocktyp: window.mm.splitBlocks('![](/medien/x/clip-800x450.mp4){gross}{Ein Clip}')[0]?.typ
    });
  })()`));
  pruefe('.mp4 in einer Bildzeile wird ein <video>, kein <img>', u.video && !u.img && u.klasse === 'mm-loop');
  pruefe('…stumm, endlos, ohne Vollbild auf dem iPhone', u.muted && u.loop && u.inline);
  pruefe('…lädt NICHT beim Öffnen der Seite (preload none, kein autoplay)',
    u.preload === 'none' && !u.autoplay, `preload=${u.preload} autoplay=${u.autoplay}`);
  pruefe('…mit Standbild gleichen Namens (.webp)', u.poster === '/medien/x/clip-800x450.webp', u.poster);
  pruefe('…mit Maßen aus dem Dateinamen (kein Springen beim Laden)', u.masse === '800x450', u.masse);
  pruefe('…und der Beschreibung für Screenreader', u.label === 'Ein Clip', u.label);
  pruefe('ein echtes GIF bleibt ein Bild', u.gifBleibtBild);
  pruefe('im Admin landet ein .mp4 im Block "Loop-Video / GIF"', u.blocktyp === 'gif', u.blocktyp);

  /* ================= 2. Auf der echten Seite ================= */
  const vorher = JSON.parse(await s.werte(`JSON.stringify({
    anzahl: document.querySelectorAll('video.mm-loop').length,
    gifs: document.querySelectorAll('img[src*=".gif"]').length,
    unten: [...document.querySelectorAll('video.mm-loop')].filter(v => v.getBoundingClientRect().top > innerHeight + 400)
      .map(v => ({ pausiert: v.paused, geladen: v.readyState, netz: v.networkState }))
  })`));
  pruefe('auf der Startseite steht mindestens ein Loop-Video', vorher.anzahl >= 1, String(vorher.anzahl));
  pruefe('…und kein GIF mehr', vorher.gifs === 0, String(vorher.gifs));
  pruefe('Videos weiter unten haben beim Öffnen noch nichts geladen',
    vorher.unten.length >= 1 && vorher.unten.every(v => v.pausiert && v.geladen === 0),
    JSON.stringify(vorher.unten));

  const form = JSON.parse(await s.werte(`(() => {
    const v = document.querySelector('video.mm-loop');
    const f = v.closest('figure');
    return JSON.stringify({ b: v.getBoundingClientRect().width, h: v.getBoundingClientRect().height,
      fb: f.getBoundingClientRect().width, w: +v.getAttribute('width'), hh: +v.getAttribute('height') });
  })()`));
  pruefe('das Video füllt seinen Rahmen wie vorher das GIF', Math.abs(form.b - form.fb) <= 1, `${form.b} / ${form.fb}`);
  pruefe('…und hat schon VOR dem Laden das richtige Seitenverhältnis',
    form.b > 0 && Math.abs(form.h / form.b - form.hh / form.w) < 0.01, `${form.b}×${form.h}`);

  await s.werte(`document.querySelector('video.mm-loop').scrollIntoView({ block: 'center' })`);
  pruefe('beim Hinscrollen startet es von selbst', await wirdWahr(s,
    `(() => { const v = document.querySelector('video.mm-loop'); return !v.paused && v.currentTime > 0.2; })()`, 10000));
  pruefe('…ohne Ton', await s.werte(`document.querySelector('video.mm-loop').muted`));
  pruefe('das Standbild liegt wirklich da', await s.werte(
    `fetch(document.querySelector('video.mm-loop').poster).then(r => r.ok && r.headers.get('content-type').startsWith('image/'))`));
  await s.werte(`scrollTo(0, 0); document.getElementById('scroller')?.scrollTo(0, 0)`);
  pruefe('beim Wegscrollen hält es an (spart Akku)', await wirdWahr(s,
    `document.querySelector('video.mm-loop').paused`, 6000));

  /* In der Bühne: Istanbul hat das Intro als Loop-Video in einem Kapitel.
     Geblättert wird mit dem echten Weiter-Knopf, bis es dasteht -- die
     Seitenzahl hängt davon ab, wie der Text umbricht. */
  const kap = await s.werte(`(() => {
    const p = window.mmProjekte.findIndex(p => p.slug === 'istanbul-katzen');
    const k = window.mmKapitel(window.mmProjekte[p].bloecke, !!window.mmProjekte[p].coverHtml)
      .findIndex(k => k.medium && k.medium !== 'cover' && /\\.mp4/.test(k.medium.inhalt?.roh || ''));
    window.mmBuehneOeffnen(p, 0);
    return k;
  })()`);
  pruefe('Istanbul: das Intro ist ein Loop-Video in einem Kapitel', kap >= 0, String(kap));
  const sichtbar = `!!document.querySelector('dialog.bu[open] .bu-kapitel:not(.bu-geht) video.mm-loop')`;
  for (let i = 0; i < 12 && !(await wirdWahr(s, sichtbar, 900)); i++) {
    await s.werte(`document.querySelector('dialog.bu .bu-weiter').click()`);
  }
  pruefe('…und spielt in der Bühne', await wirdWahr(s,
    `(() => { const v = document.querySelector('dialog.bu[open] .bu-kapitel:not(.bu-geht) video.mm-loop');
       return !!v && !v.paused && v.currentTime > 0.2; })()`, 10000));
  pruefe('keine JS-Fehler', s.fehlerAufSeite().length === 0, s.fehlerAufSeite().join(' | '));
  await s.zu();
}

/* ================= 3. Bewegung reduzieren ================= */
{
  const s = await oeffne(ADR, { port: 9373, breite: 1440, hoehe: 900 });
  await s.medien({ 'prefers-reduced-motion': 'reduce' });
  await s.werte('location.reload()');
  await bereit(s);
  await s.werte(`document.querySelector('video.mm-loop').scrollIntoView({ block: 'center' })`);
  /* Hier muss wirklich Zeit vergehen: "spielt NICHT" lässt sich nur
     beweisen, indem man eine Weile hinsieht. */
  await s.warte(1500);
  const r = await s.werte(`(() => { const v = document.querySelector('video.mm-loop');
    return v.paused && v.currentTime === 0; })()`);
  pruefe('bei "Bewegung reduzieren" bleibt nur das Standbild stehen', r);
  await s.zu();
}

/* ================= 4. Umwandlung im Admin ================= */
{
  const s = await oeffne(ADR + '404.html', { port: 9373, breite: 1024, hoehe: 700 });
  await s.bisWahr(`document.readyState === 'complete'`, 10000);
  const alsDatei = (pfad, name, typ) => {
    const b64 = readFileSync(new URL(pfad, import.meta.url)).toString('base64');
    return `new File([Uint8Array.from(atob('${b64}'), c => c.charCodeAt(0))], '${name}', { type: '${typ}' })`;
  };
  const untersuche = `async (r, MB) => {
    const roh = new Uint8Array(await r.mp4.arrayBuffer());
    const text = new TextDecoder('latin1').decode(roh);
    const input = new MB.Input({ source: new MB.BlobSource(r.mp4), formats: MB.ALL_FORMATS });
    const v = await input.getPrimaryVideoTrack();
    return {
      breite: r.breite, hoehe: r.hoehe, groesse: r.mp4.size,
      spurBreite: v.displayWidth, codec: v.codec,
      ton: (await input.getAudioTracks()).length,
      faststart: text.indexOf('moov') > 0 && text.indexOf('moov') < text.indexOf('mdat'),
      dauer: await v.computeDuration(),
      poster: r.poster.type, posterGroesse: r.poster.size
    };
  }`;
  const ergebnis = (datei) => s.werte(`(async () => {
    try {
      const { zuLoopVideo } = await import('/assets/loopvideo.js');
      const MB = await import('/assets/vendor/mediabunny-1.61.3.min.mjs');
      const datei = ${datei};
      const r = await zuLoopVideo(datei);
      return JSON.stringify({ ...(await (${untersuche})(r, MB)), vorher: datei.size });
    } catch (e) { return JSON.stringify({ fehler: String(e && e.message || e) }); }
  })()`);

  const v = JSON.parse(await ergebnis(alsDatei('./feste/loop-probe-1920x1080.mov', 'probe.mov', 'video/quicktime')));
  pruefe('Video: Umwandlung läuft durch', !v.fehler, v.fehler || '');
  pruefe('Video: von 1920 auf 1280 px verkleinert', v.breite === 1280 && v.hoehe === 720 && v.spurBreite === 1280,
    `${v.breite}×${v.hoehe}`);
  pruefe('Video: H.264, spielt in jedem Browser', v.codec === 'avc', v.codec);
  pruefe('Video: Ton ist raus', v.ton === 0, String(v.ton));
  pruefe('Video: Faststart (spielt schon während des Ladens)', v.faststart);
  pruefe('Video: deutlich kleiner als vorher', v.groesse < v.vorher / 2,
    `${Math.round(v.vorher / 1024)} kB → ${Math.round(v.groesse / 1024)} kB`);
  pruefe('Video: Länge bleibt', Math.abs(v.dauer - 1.5) < 0.15, String(v.dauer));
  pruefe('Video: Standbild dabei', /^image\/(webp|jpeg)$/.test(v.poster) && v.posterGroesse > 1000, `${v.poster} ${v.posterGroesse}`);

  const g = JSON.parse(await ergebnis(alsDatei('./feste/loop-probe.gif', 'probe.gif', 'image/gif')));
  pruefe('GIF: wird ebenfalls ein MP4', !g.fehler && g.codec === 'avc', g.fehler || g.codec);
  pruefe('GIF: Maße bleiben (nicht hochskaliert)', g.breite === 320 && g.hoehe === 180, `${g.breite}×${g.hoehe}`);
  pruefe('GIF: Tempo bleibt (10 Bilder à 0,1 s = 1 s)', Math.abs(g.dauer - 1) < 0.12, String(g.dauer));
  pruefe('GIF: Faststart und Standbild', g.faststart && g.posterGroesse > 500);
  const d = JSON.parse(await ergebnis(alsDatei('./feste/loop-probe-durchsichtig.gif', 'frei.gif', 'image/gif')));
  pruefe('ein durchsichtiges GIF wird NICHT umgewandelt (sonst schwarzer Kasten)',
    /durchsichtig/.test(d.fehler || ''), d.fehler || 'wurde umgewandelt');
  pruefe('keine JS-Fehler bei der Umwandlung', s.fehlerAufSeite().length === 0, s.fehlerAufSeite().join(' | '));
  await s.zu();
}

chrome.beenden(); server.beenden();
bericht();
