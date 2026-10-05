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
const nr = (slug) => `window.mmProjekte.findIndex(p => p.slug === '${slug}')`;
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

  /* ---- Die Karten ---- */
  const k = JSON.parse(await s.werte(`JSON.stringify({
    karten: document.querySelectorAll('.br-karte').length,
    projekte: window.mmProjekte.length,
    knoepfe: document.querySelectorAll('.br-karte .br-mehr-ansehen').length,
    medien: document.querySelectorAll('.br-karte .br-karte-medium').length,
    /* Der Rest eines Projekts steht NICHT im Dokument -- keine versteckten
       Tab-Fallen. Simplicissimus hat 7 Bloecke, die Karte zeigt davon 2-3. */
    simpliBloecke: window.mmProjekte[${nr('seite')}].bloecke.length,
    simpliImBrief: document.querySelectorAll('.br-karte[data-slug="seite"] .br-text').length
  })`));
  pruefe('jedes Projekt steht als Karte im Brief', k.karten === k.projekte && k.karten >= 5, k.karten + ' / ' + k.projekte);
  pruefe('…jede mit "Mehr ansehen"', k.knoepfe === k.karten, String(k.knoepfe));
  pruefe('…und einem Vorschau-Medium', k.medien === k.karten, String(k.medien));
  pruefe('zugeklappt steht nur der Anfang im Dokument, nicht alles',
    k.simpliImBrief < k.simpliBloecke, k.simpliImBrief + ' von ' + k.simpliBloecke + ' Bloecken');

  /* ---- Kapitel ---- */
  const kap = JSON.parse(await s.werte(`JSON.stringify(Object.fromEntries(window.mmProjekte.map(p =>
    [p.slug, window.mmKapitel(p.bloecke, !!p.coverHtml).map(k => (k.medium === 'cover' ? 'cover' : k.medium ? k.medium.typ : '-') + '+' + k.texte.length)])))`));
  /* Istanbul: Cover + 2 Texte, dann je ein Bild/GIF mit seinem Text. */
  pruefe('Istanbul: 5 Kapitel, jedes Medium beginnt eines',
    JSON.stringify(kap['istanbul-katzen']) === JSON.stringify(['cover+2', 'bild+1', 'bild+1', 'gif+1', 'bild+2']),
    JSON.stringify(kap['istanbul-katzen']));
  /* Simplicissimus: kein Cover -- der Text vor dem ersten GIF gehoert zu
     dessen Kapitel, das Banner ist das Kopfbild, der letzte Trenner faellt weg. */
  pruefe('Simplicissimus: 3 Kapitel, kein Kapitel ohne Bild',
    kap.seite.length === 3 && kap.seite.every(x => !x.startsWith('-')), JSON.stringify(kap.seite));

  /* ---- Öffnen per Klick ---- */
  await s.werte(`document.querySelector('.br-karte[data-slug="istanbul-katzen"] .br-mehr-ansehen').click()`);
  await s.warte(700);   // Verwandlung + Einblenden (0,46 s) -- echte Zeit, kein Zustand
  let st = JSON.parse(await s.werte(stand));
  pruefe('Klick auf "Mehr ansehen" öffnet die Bühne als MODALES Fenster', st.offen && st.modal, JSON.stringify(st));
  pruefe('…mit Titel und "Kapitel 1 von 5"', st.titel.includes('Travell4llove') && st.zaehler === 'Kapitel 1 von 5', st.titel + ' · ' + st.zaehler);
  pruefe('…die Adresse nennt das Projekt', st.hash === '#istanbul-katzen', st.hash);
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
  pruefe('Pfeil rechts schaltet ein Kapitel weiter', st.zaehler === 'Kapitel 2 von 5', st.zaehler);
  pruefe('…und die Adresse merkt sich das Kapitel', st.hash === '#istanbul-katzen/2', st.hash);
  const nachWechsel = Number(await s.werte(`document.querySelectorAll('.bu-kapitel').length`));
  pruefe('…das alte Kapitel ist danach wieder weg', nachWechsel === 1, nachWechsel + ' im Dokument');
  await s.taste('ArrowLeft', 'ArrowLeft', 37);
  await s.warte(500);
  st = JSON.parse(await s.werte(stand));
  pruefe('Pfeil links geht zurück', st.zaehler === 'Kapitel 1 von 5', st.zaehler);
  for (let i = 0; i < 4; i++) { await s.werte(`document.querySelector('.bu-weiter').click()`); await s.warte(120); }
  await s.warte(500);
  const letzt = JSON.parse(await s.werte(`JSON.stringify({ z: document.querySelector('.bu-zaehler').textContent,
    w: document.querySelector('.bu-weiter').textContent })`));
  pruefe('schnelles Klicken landet sauber im letzten Kapitel', letzt.z === 'Kapitel 5 von 5', letzt.z);
  pruefe('…dort heißt der Knopf "Nächstes Projekt: …"', letzt.w.startsWith('Nächstes Projekt: '), letzt.w);
  await s.werte(`document.querySelector('.bu-weiter').click()`);
  await s.warte(500);
  st = JSON.parse(await s.werte(stand));
  pruefe('"Nächstes Projekt" wechselt in der Bühne zum nächsten Eintrag',
    st.offen && !st.titel.includes('Travell4llove') && st.zaehler.startsWith('Kapitel 1 von'), st.titel + ' · ' + st.zaehler);

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

/* ================= Direkt verlinkt: /#slug/2 ================= */
{
  const s = await oeffne(ADR + '#istanbul-katzen/3', { port: 9371, breite: 1440, hoehe: 900 });
  await bereit(s);
  await s.warte(700);
  const st = JSON.parse(await s.werte(stand));
  pruefe('ein geteilter Link /#istanbul-katzen/3 öffnet genau dieses Kapitel',
    st.offen && st.zaehler === 'Kapitel 3 von 5', st.zaehler);
  await s.zu();
}

/* ================= Handy, 520 px ================= */
{
  const s = await oeffne(ADR, { port: 9371, breite: 520, hoehe: 900 });
  await bereit(s);
  await s.werte(`document.querySelector('.br-karte[data-slug="istanbul-katzen"] .br-mehr-ansehen').click()`);
  await s.warte(700);
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
  await s.werte(`document.querySelector('.br-karte[data-slug="istanbul-katzen"] .br-mehr-ansehen').click()`);
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
