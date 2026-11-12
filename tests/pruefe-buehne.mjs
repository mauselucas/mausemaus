/* Die Bühne: Projekte sind im Brief zugeklappt (Karten) und öffnen sich in
   einem modalen Fenster mit Kapiteln (assets/buehne.js, buehne.css).

   Geprüft wird, was Lucas sieht und was ein Besucher mit Tastatur oder
   Screenreader erlebt -- mit ECHTEN Tastendrücken (Input.dispatchKeyEvent),
   nicht mit nachgebauten Ereignissen: nur ein echtes Esc löst beim <dialog>
   das "cancel" aus, an dem das Schließen hängt. */
import { starteChrome, oeffne, pruefe, bericht } from './chrome.mjs';
import { starteServer } from './server.mjs';

const wurzel = new URL('../HOCHLADEN/', import.meta.url).pathname;
const server = await starteServer({ wurzel, port: 8931 });
const chrome = await starteChrome({ port: 9371 });
const ADR = 'http://127.0.0.1:8931/';

const bereit = (s) => s.bisWahr(`!document.getElementById('mm-laden') && !!window.mmProjekte`, 20000);
/* Wartet, bis die Bühne fertig hochgeglitten ist. Feste 700 ms reichten auf
   einem langsamen Rechner nicht (gemessen: 3–10 px zu tief). Wirft nicht:
   läuft die Frist ab, misst die Prüfung trotzdem und wird ehrlich rot. */
const aufgeglitten = (s) => s.bisWahr(
  `(() => { const d = document.querySelector('dialog.bu');
     return !!d && d.open && d.getAnimations().every(a => a.playState === 'finished'); })()`, 5000)
  .then(() => true, () => false);
const nr = (slug) => `window.mmProjekte.findIndex(p => p.slug === '${slug}')`;
/* Welche Projekte geprüft werden, steht im Inhalt, nicht hier: Lucas
   archiviert und baut um (Istanbul und Simplicissimus am 12.11. raus).
   VIEL = das Projekt mit den meisten Kapiteln (nicht das letzte -- dahinter
   muss ein "Nächstes Projekt" kommen), MEIST = das mit den meisten Blöcken.
   Ermittelt gleich nach dem ersten Laden. */
let VIEL, VIEL_TITEL, N_VIEL, MEIST;
const stand = `JSON.stringify({
  offen: !!document.querySelector('dialog.bu')?.open,
  modal: !!document.querySelector('dialog.bu:modal'),
  titel: document.querySelector('.bu-titel')?.textContent || '',
  zaehler: document.querySelector('.bu-zaehler')?.textContent || '',
  hash: location.hash,
  fokus: (document.activeElement && (document.activeElement.className || document.activeElement.tagName)) || ''
})`;

/* ================= Rechner, 1440 px ================= */
{
  const s = await oeffne(ADR, { port: 9371, breite: 1440, hoehe: 900 });
  await bereit(s);
  ({ VIEL, VIEL_TITEL, N_VIEL, MEIST } = JSON.parse(await s.werte(`JSON.stringify((() => {
    const P = window.mmProjekte, kap = P.map(p => window.mmKapitel(p.bloecke, !!p.coverHtml).length);
    let i = 0; for (let j = 0; j < P.length - 1; j++) if (kap[j] > kap[i]) i = j;
    let m = 0; P.forEach((p, j) => { if (p.bloecke.length > P[m].bloecke.length) m = j; });
    return { VIEL: P[i].slug, VIEL_TITEL: P[i].titel, N_VIEL: kap[i], MEIST: P[m].slug }; })())`)));
  console.log(`  info  geprüft an: ${VIEL} (${N_VIEL} Kapitel), meiste Blöcke: ${MEIST}`);

  /* ---- Die Karten ---- */
  const k = JSON.parse(await s.werte(`JSON.stringify({
    karten: document.querySelectorAll('.br-karte').length,
    projekte: window.mmProjekte.length,
    knoepfe: document.querySelectorAll('.br-karte .br-mehr-ansehen').length,
    medien: document.querySelectorAll('.br-karte .br-karte-medium').length,
    /* Der Rest eines Projekts steht NICHT im Dokument -- keine versteckten
       Tab-Fallen. Geprüft am Projekt mit den meisten Blöcken. */
    simpliBloecke: window.mmProjekte[${nr(MEIST)}].bloecke.length,
    simpliImBrief: document.querySelectorAll('.br-karte[data-slug="${MEIST}"] .br-text').length
  })`));
  pruefe('jedes Projekt steht als Karte im Brief', k.karten === k.projekte && k.karten >= 2, k.karten + ' / ' + k.projekte);
  pruefe('…jede mit "Mehr ansehen"', k.knoepfe === k.karten, String(k.knoepfe));
  pruefe('…und einem Vorschau-Medium', k.medien === k.karten, String(k.medien));
  pruefe('zugeklappt steht nur der Anfang im Dokument, nicht alles',
    k.simpliImBrief < k.simpliBloecke, k.simpliImBrief + ' von ' + k.simpliBloecke + ' Bloecken');

  /* ---- Kapitel ---- */
  const kap = JSON.parse(await s.werte(`JSON.stringify(Object.fromEntries(window.mmProjekte.map(p =>
    [p.slug, window.mmKapitel(p.bloecke, !!p.coverHtml).map(k => (k.medium === 'cover' ? 'cover' : k.medium ? k.medium.typ : '-') + '+' + k.texte.length)])))`));
  /* Die REGEL, an jedem veröffentlichten Projekt: jedes Medium (und ein
     Cover) beginnt genau ein Kapitel. Ein Kapitel ganz ohne Bild entsteht
     nur durch einen Trenner (so ist z. B. The Race gebaut). */
  const regel = JSON.parse(await s.werte(`JSON.stringify(window.mmProjekte.map(p => ({ slug: p.slug,
    medien: p.bloecke.filter(b => ['bild', 'gif', 'video'].includes(b.typ)).length + (p.coverHtml ? 1 : 0),
    trenner: p.bloecke.filter(b => b.typ === 'trenner').length })))`));
  const falsch = regel.filter(r => kap[r.slug].filter(x => !x.startsWith('-')).length !== r.medien
    || kap[r.slug].filter(x => x.startsWith('-')).length > r.trenner);
  pruefe('jedes Projekt: ein Kapitel je Medium, ohne Bild nur nach einem Trenner', falsch.length === 0,
    falsch.map(r => r.slug + ' ' + JSON.stringify(kap[r.slug]) + ' bei ' + r.medien + ' Medien').join('; '));
  const N = N_VIEL;
  pruefe(`es gibt ein Projekt mit mehreren Kapiteln zum Blättern`, N >= 2, `${VIEL}: ${N}`);
  /* Ohne Cover gehört der Text vor dem ersten Medium zu dessen Kapitel, und
     ein Trenner am Ende fällt weg. Gerade hat kein Projekt "ohne Cover" --
     darum mit erfundenen Blöcken, unabhängig vom Inhalt. */
  const ohneCover = await s.werte(`JSON.stringify(window.mmKapitel([
    { typ: 'text' }, { typ: 'gif' }, { typ: 'text' }, { typ: 'bild' }, { typ: 'text' }, { typ: 'trenner' }], false)
    .map(k => (k.medium ? k.medium.typ : '-') + '+' + k.texte.length))`);
  pruefe('ohne Cover: Text davor gehört zum ersten Medium, Trenner am Ende fällt weg',
    ohneCover === '["gif+2","bild+1"]', ohneCover);

  /* ---- Öffnen per Klick ---- */
  await s.werte(`document.querySelector('.br-karte[data-slug="${VIEL}"] .br-mehr-ansehen').click()`);
  await s.warte(700);   // Verwandlung + Einblenden (0,46 s) -- echte Zeit, kein Zustand
  let st = JSON.parse(await s.werte(stand));
  pruefe('Klick auf "Mehr ansehen" öffnet die Bühne als MODALES Fenster', st.offen && st.modal, JSON.stringify(st));
  pruefe('…mit Titel und "Kapitel 1 von N"', st.titel === VIEL_TITEL && st.zaehler === `Kapitel 1 von ${N}`, st.titel + ' · ' + st.zaehler);
  pruefe('…die Adresse nennt das Projekt', st.hash === '#' + VIEL, st.hash);
  pruefe('…und der Fokus steht in der Bühne', st.fokus.includes('bu-titel'), st.fokus);

  /* Hintergrund stumm: nichts außerhalb des Fensters ist erreichbar. */
  const inert = JSON.parse(await s.werte(`(() => {
    const knopf = document.querySelector('.br-karte .br-mehr-ansehen');
    knopf.focus();
    return JSON.stringify({ fokusDraussen: document.activeElement === knopf });
  })()`));
  pruefe('der Brief dahinter ist nicht erreichbar (inert)', !inert.fokusDraussen, JSON.stringify(inert));
  await s.werte(`document.querySelector('.bu-titel').focus()`);

  /* ---- Weiterschalten: Pfeiltaste und Knopf ---- */
  await s.taste('ArrowRight', 'ArrowRight', 39);
  await s.warte(500);
  st = JSON.parse(await s.werte(stand));
  pruefe('Pfeil rechts schaltet ein Kapitel weiter', st.zaehler === `Kapitel 2 von ${N}`, st.zaehler);
  pruefe('…und die Adresse merkt sich das Kapitel', st.hash === '#' + VIEL + '/2', st.hash);
  const nachWechsel = Number(await s.werte(`document.querySelectorAll('.bu-kapitel').length`));
  pruefe('…das alte Kapitel ist danach wieder weg', nachWechsel === 1, nachWechsel + ' im Dokument');
  await s.taste('ArrowLeft', 'ArrowLeft', 37);
  await s.warte(500);
  st = JSON.parse(await s.werte(stand));
  pruefe('Pfeil links geht zurück', st.zaehler === `Kapitel 1 von ${N}`, st.zaehler);
  for (let i = 0; i < N - 1; i++) { await s.werte(`document.querySelector('.bu-weiter').click()`); await s.warte(120); }
  await s.warte(500);
  const letzt = JSON.parse(await s.werte(`JSON.stringify({ z: document.querySelector('.bu-zaehler').textContent,
    w: document.querySelector('.bu-weiter').textContent })`));
  pruefe('schnelles Klicken landet sauber im letzten Kapitel', letzt.z === `Kapitel ${N} von ${N}`, letzt.z);
  pruefe('…dort heißt der Knopf "Nächstes Projekt: …"', letzt.w.startsWith('Nächstes Projekt: '), letzt.w);
  await s.werte(`document.querySelector('.bu-weiter').click()`);
  /* Auf den Zustand warten statt auf die Uhr: der Wechsel zum nächsten
     Projekt ist eine Verwandlung, deren Dauer unter Last schwankt. */
  await s.bisWahr(`(() => { const d = document.querySelector('dialog.bu');
    return !!d && d.open && (document.querySelector('.bu-titel')?.textContent || '') !== ${JSON.stringify(VIEL_TITEL ?? '')}; })()`, 5000).catch(() => {});
  st = JSON.parse(await s.werte(stand));
  pruefe('"Nächstes Projekt" wechselt in der Bühne zum nächsten Eintrag',
    st.offen && st.titel !== VIEL_TITEL && st.zaehler.startsWith('Kapitel 1 von'), st.titel + ' · ' + st.zaehler);

  /* ---- Schließen mit echtem Esc ---- */
  await s.taste('Escape', 'Escape', 27);
  await s.warte(600);
  st = JSON.parse(await s.werte(stand));
  pruefe('Esc schließt die Bühne', !st.offen, JSON.stringify(st));
  pruefe('…die Adresse ist wieder ohne Projekt', st.hash === '', st.hash);
  pruefe('…und der Fokus steht wieder auf einem "Mehr ansehen"', st.fokus.includes('br-mehr-ansehen'), st.fokus);

  /* ---- Zurück im Browser schließt ---- */
  await s.werte(`document.querySelector('.br-karte[data-slug="jules"] .br-mehr-ansehen').click()`);
  await s.warte(600);
  await s.werte(`history.back()`);
  await s.warte(600);
  st = JSON.parse(await s.werte(stand));
  pruefe('"Zurück" im Browser schließt die Bühne, statt die Seite zu verlassen',
    !st.offen, JSON.stringify(st));
  const nochDa = await s.werte(`location.pathname`);
  pruefe('…und man ist noch auf der Seite', nochDa === '/', nochDa);

  const jsF = s.fehlerAufSeite();
  pruefe('Rechner: keine JavaScript-Fehler', jsF.length === 0, jsF.join(' | '));
  await s.zu();
}

/* ================= Lucas' Screenshots vom 05.10.: kein Rollbalken, nichts verblasst ================= */
for (const [breite, hoehe] of [[1440, 900], [1280, 760]]) {
  const s = await oeffne(ADR, { port: 9371, breite, hoehe });
  await bereit(s);
  const r = JSON.parse(await s.werte(`(async () => {
    const warte = ms => new Promise(x => setTimeout(x, ms));
    const raus = { rollt: [], blass: [], seiten: {}, text: {} };
    for (let n = 0; n < window.mmProjekte.length; n++) {
      const p = window.mmProjekte[n];
      window.mmBuehneOeffnen(n, 0, { ohneAdresse: true });
      await warte(450);
      let gesamt = '';
      for (let i = 0; i < 40; i++) {
        const k = document.querySelector('.bu-kapitel:not(.bu-geht)');
        const t = k.querySelector('.bu-text');
        if (t && t.scrollHeight > t.clientHeight + 2)
          raus.rollt.push(p.slug + ' S.' + (i + 1) + ': ' + t.scrollHeight + '>' + t.clientHeight);
        k.querySelectorAll('.bu-text > *').forEach(el => {
          const o = Number(getComputedStyle(el).opacity);
          if (o < 0.7) raus.blass.push(p.slug + ' ' + el.className + ' ' + o);
        });
        gesamt += t ? t.textContent : '';
        const z = document.querySelector('.bu-zaehler').textContent.match(/(\\d+)\\D+(\\d+)/);
        if (z[1] === z[2]) { raus.seiten[p.slug] = Number(z[2]); break; }
        document.querySelector('.bu-weiter').click();
        await warte(450);
      }
      /* Kein Satz darf beim Umbrechen verlorengehen: aller Text der Bloecke
         muss ueber die Seiten verteilt wieder auftauchen. */
      const soll = window.mmKapitel(p.bloecke, !!p.coverHtml).flatMap(k => k.texte)
        .map(b => { const d = document.createElement('div'); d.innerHTML = window.mmBloecke.render(b, 'br-text'); return d.textContent; })
        .join('').replace(/\\s+/g, '');
      raus.text[p.slug] = soll === gesamt.replace(/\\s+/g, '') ? 'ok' : soll.length + ' vs ' + gesamt.replace(/\\s+/g, '').length;
      window.mmBuehneSchliessen();
      await warte(400);
    }
    return JSON.stringify(raus);
  })()`));
  pruefe(`${breite}×${hoehe}: kein Kapitel braucht einen Rollbalken`, r.rollt.length === 0,
    r.rollt.slice(0, 4).join(' | ') || JSON.stringify(r.seiten));
  pruefe(`${breite}×${hoehe}: nichts in der Bühne steht verblasst da (Zitate, Türchen)`, r.blass.length === 0,
    r.blass.slice(0, 4).join(' | '));
  pruefe(`${breite}×${hoehe}: beim Umbrechen in Seiten geht kein Text verloren`,
    Object.values(r.text).every(x => x === 'ok'), JSON.stringify(r.text));
  await s.zu();
}

/* Kontakt-Links: Salbei-Streifen nur unter dem Text, nicht über die ganze
   Breite. Kopfbild: bündig oben in der Karte, kein weißer Streifen darüber. */
{
  const s = await oeffne(ADR, { port: 9371, breite: 1280, hoehe: 900 });
  await bereit(s);
  const r = JSON.parse(await s.werte(`(() => {
    /* Scroll-Einblendungen aus: sonst misst man das Kopfbild mitten in
       seiner Einblendung (leicht verkleinert, ein paar px tiefer). */
    const st = document.createElement('style');
    st.textContent = '*{animation:none !important}';
    document.head.appendChild(st);
    /* Seit dem 06.10. stehen E-Mail und Telefon nicht mehr auf der Seite
       (Lucas nutzt das Formular). Geprüft wird die GESTALTUNG für den
       Fall, dass er sie im Admin wieder einträgt -- genau so, wie
       brief.js die Zeile baut. */
    if (!document.querySelector('.br-kontakt a')) {
      [...document.querySelectorAll('section.br-abschnitt:not(.br-karte) > h2.br-titel')].pop()
        .insertAdjacentHTML('afterend', '<p class="br-kontakt"><a href="mailto:a@b.de">probe@beispiel.de</a></p>');
    }
    const a = document.querySelector('.br-kontakt a');
    /* Die Karte mit Kopfbild; hat gerade kein Projekt eins (Lucas hat das
       Simplicissimus-Banner am 06.10. geleert), wird eins genau so
       eingesetzt, wie brief.js es baut -- geprüft wird hier die Gestaltung,
       nicht der Inhalt. */
    let kb = document.querySelector('.br-karte .br-kopfbild');
    if (!kb) {
      const ziel = document.querySelector('.br-karte');
      ziel.insertAdjacentHTML('afterbegin', '<figure class="br-kopfbild"><img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" alt="" width="1600" height="400"></figure>');
      kb = ziel.querySelector('.br-kopfbild');
    }
    const k = kb.closest('.br-karte');
    const cs = getComputedStyle(k, '::before');
    return JSON.stringify({
      linkBreite: a ? Math.round(a.getBoundingClientRect().width) : -1,
      spalte: a ? Math.round(a.parentElement.getBoundingClientRect().width) : -1,
      luftUeberKopfbild: kb ? Math.round(kb.getBoundingClientRect().top - (k.getBoundingClientRect().top + parseFloat(cs.top))) : 'kein Kopfbild' });
  })()`));
  pruefe('Kontakt: der Link ist nur so breit wie sein Text', r.linkBreite > 0 && r.linkBreite < r.spalte * 0.8,
    r.linkBreite + ' von ' + r.spalte + ' px');
  pruefe('Kopfbild sitzt bündig oben in der Karte (kein weißer Streifen)', r.luftUeberKopfbild === 0,
    String(r.luftUeberKopfbild));
  await s.zu();
}

/* ================= Direkt verlinkt: /#slug/2 ================= */
{
  const K = Math.min(3, N_VIEL);
  const s = await oeffne(ADR + `#${VIEL}/${K}`, { port: 9371, breite: 1440, hoehe: 900 });
  await bereit(s);
  await s.warte(700);
  const st = JSON.parse(await s.werte(stand));
  pruefe(`ein geteilter Link /#${VIEL}/${K} öffnet genau dieses Kapitel`,
    st.offen && st.zaehler === `Kapitel ${K} von ${N_VIEL}`, st.zaehler);
  await s.zu();
}

/* ================= Handy, 520 px ================= */
{
  const s = await oeffne(ADR, { port: 9371, breite: 520, hoehe: 900 });
  await bereit(s);
  await s.werte(`document.querySelector('.br-karte[data-slug="${VIEL}"] .br-mehr-ansehen').click()`);
  await aufgeglitten(s);
  const m = JSON.parse(await s.werte(`(() => {
    const d = document.querySelector('dialog.bu').getBoundingClientRect();
    const w = document.querySelector('.bu-weiter').getBoundingClientRect();
    return JSON.stringify({ l: Math.round(d.left), r: Math.round(d.right), o: Math.round(d.top), u: Math.round(d.bottom),
      breite: innerWidth, hoehe: innerHeight, weiterIm: w.bottom <= innerHeight && w.top >= 0 });
  })()`));
  pruefe('Handy: die Bühne füllt den Bildschirm', m.l === 0 && m.r === m.breite && m.o === 0 && m.u === m.hoehe, JSON.stringify(m));
  pruefe('…und "Weiter" ist im Bild', m.weiterIm);
  const jsF = s.fehlerAufSeite();
  pruefe('Handy: keine JavaScript-Fehler', jsF.length === 0, jsF.join(' | '));
  await s.zu();
}

/* ================= Bewegung reduzieren ================= */
{
  const s = await oeffne(ADR, { port: 9371, breite: 1440, hoehe: 900 });
  await s.medien({ 'prefers-reduced-motion': 'reduce' });
  await s.werte('location.reload()').catch(() => {});
  await bereit(s);
  await s.werte(`document.querySelector('.br-karte[data-slug="${VIEL}"] .br-mehr-ansehen').click()`);
  await s.warte(300);
  await s.werte(`document.querySelector('.bu-weiter').click()`);
  const r = JSON.parse(await s.werte(`(() => {
    const k = [...document.querySelectorAll('.bu-kapitel')];
    const sc = getComputedStyle(document.getElementById('scroller'));
    return JSON.stringify({ verschoben: k.some(x => [...x.children].some(c => getComputedStyle(c).translate !== 'none')),
      unscharf: k.some(x => [...x.children].some(c => getComputedStyle(c).filter !== 'none')),
      hintergrund: sc.transform });
  })()`));
  pruefe('Bewegung reduzieren: Kapitel gleiten nicht, sie blenden nur über', !r.verschoben && !r.unscharf, JSON.stringify(r));
  pruefe('…und der Brief dahinter zoomt nicht', r.hintergrund === 'none', r.hintergrund);
  await s.zu();
}

chrome.beenden(); server.beenden();
bericht();
