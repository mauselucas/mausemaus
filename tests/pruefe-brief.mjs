import { starteChrome, oeffne, pruefe, bericht } from './chrome.mjs';
import { starteServer } from './server.mjs';

const wurzel = new URL('../HOCHLADEN/', import.meta.url).pathname;
const server = await starteServer({ wurzel, port: 8903 });
const chrome = await starteChrome({ port: 9335 });
const s = await oeffne('http://127.0.0.1:8903/', { port: 9335 });
await s.warte(3000);

const d = JSON.parse(await s.werte(`(async () => {
  const projekte = (await window.mmLoadProjects()).filter(p => p.status === 'published');
  const abschnitte = [...document.querySelectorAll('#brief section')];
  const text = document.body.innerText;
  return JSON.stringify({
    projekte: projekte.length,
    abschnitte: abschnitte.length,
    /* jeder Projekttext muss WÖRTLICH auf der Seite stehen */
    fehlendeTexte: projekte.filter(p => p.summary && !text.includes(p.summary.trim()))
                           .map(p => p.slug),
    fehlendeTitel: projekte.filter(p => !text.includes(p.title)).map(p => p.slug),
    /* jedes Coverbild muss vorkommen */
    fehlendeBilder: projekte.filter(p => p.cover_url &&
        !document.querySelector('img[src="'+p.cover_url+'"]')).map(p => p.slug),
    leiste: document.querySelectorAll('.mml-seg').length,
    beruflich: document.querySelectorAll('.mml-seg').length -
               [...document.querySelectorAll('.mml-punkt')]
                 .filter(x => getComputedStyle(x).backgroundColor === 'rgb(214, 211, 196)').length
  });
})()`));

pruefe('fünf veröffentlichte Projekte gefunden', d.projekte === 5, String(d.projekte));
pruefe('Abschnitte = Einstieg + Profil + Projekte + Kontakt', d.abschnitte === d.projekte + 3, String(d.abschnitte));
pruefe('KEIN Projekttext wurde verändert', d.fehlendeTexte.length === 0, d.fehlendeTexte.join(','));
pruefe('KEIN Projekttitel wurde verändert', d.fehlendeTitel.length === 0, d.fehlendeTitel.join(','));
pruefe('KEIN Coverbild fehlt', d.fehlendeBilder.length === 0, d.fehlendeBilder.join(','));

/* Alles, was auf der alten Startseite stand, muss auch im Brief stehen.
   Ohne diese Prüfung verschwinden Eckdaten, Werkzeugliste und Kundenliste
   still — sie hängen nicht an den Projekten, sondern an den Einstellungen. */
const alt = JSON.parse(await s.werte(`(async () => {
  const e = await window.mmLoadSettings();
  const text = document.body.innerText;
  const fehlt = [];
  (e.infos || []).forEach(i => { if (i.zeile1 && !text.includes(i.zeile1)) fehlt.push('info:' + i.titel); });
  (e.werkzeuge || []).forEach(w => { if (!text.includes(w.name)) fehlt.push('werkzeug:' + w.name); });
  (e.kunden || []).forEach(k => { if (!text.includes(k)) fehlt.push('kunde:' + k); });
  if (e.profil_text && !text.includes(e.profil_text.slice(0, 40))) fehlt.push('profil_text');
  if (e.hero_intro && !text.includes(e.hero_intro.slice(0, 40))) fehlt.push('hero_intro');
  if (e.email && !text.includes(e.email)) fehlt.push('email');
  if (e.telefon && !text.includes(e.telefon)) fehlt.push('telefon');
  return JSON.stringify({ fehlt });
})()`));
pruefe('KEIN Inhalt der alten Startseite fehlt', alt.fehlt.length === 0, alt.fehlt.join(','));

/* Verweise von Projekten auf Beiträge dürfen nicht verschwinden. */
const verweise = JSON.parse(await s.werte(`(async () => {
  const ps = (await window.mmLoadProjects()).filter(p => p.status === 'published' && p.more_url);
  return JSON.stringify({ soll: ps.map(p => p.more_url),
    ist: [...document.querySelectorAll('.br-mehr a')].map(a => a.getAttribute('href')) });
})()`));
pruefe('Verweise auf Beiträge bleiben erhalten',
  verweise.soll.every(u => verweise.ist.includes(u)),
  'soll ' + verweise.soll.join(',') + ' / ist ' + verweise.ist.join(','));

/* Bilder im Fließtext laden erst, wenn man zu ihnen scrollt. Dabei wächst die
   Seite — und die Zeitleiste muss nachrechnen. Tut sie es nicht, zeigen die
   Balken dauerhaft falsche Verhältnisse und Klicks landen an der falschen
   Stelle. Genau dieser Fehler wurde einmal übersehen. */
await s.werte(`(async () => {
  const sc = document.getElementById('scroller');
  for (let y = 0; y <= sc.scrollHeight; y += 500) {
    sc.scrollTo({ top: y, behavior: 'instant' });
    await new Promise(r => setTimeout(r, 60));
  }
  sc.scrollTo({ top: 0, behavior: 'instant' });
})()`);
await s.warte(1200);                       // dem Beobachter Zeit zum Nachrechnen geben
const treue = JSON.parse(await s.werte(`(() => {
  const sc = document.getElementById('scroller');
  const oben = el => el.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop;
  const ab = [...document.querySelectorAll('#brief section')];
  const segs = [...document.querySelectorAll('.mml-seg')];
  let groesste = 0;
  ab.forEach((el, i) => {
    const soll = oben(el) / sc.scrollHeight * 100;
    const ist = parseFloat(segs[i].style.top);
    groesste = Math.max(groesste, Math.abs(soll - ist));
  });
  return JSON.stringify({ abweichung: +groesste.toFixed(2), hoehe: sc.scrollHeight });
})()`));
pruefe('Zeitleiste stimmt noch, nachdem alle Bilder geladen sind',
  treue.abweichung < 2, 'größte Abweichung ' + treue.abweichung + ' % bei ' + treue.hoehe + ' px');
pruefe('Leiste hat für jeden Abschnitt ein Segment', d.leiste === d.abschnitte, String(d.leiste));

/* Jedes Projekt braucht eine EIGENE Farbe — sonst sind Balken nicht unterscheidbar.
   Aus `accent` abgeleitet wären "The Race" und "Rockstar Selfish" beide sky. */
const farben = JSON.parse(await s.werte(`JSON.stringify(
  [...document.querySelectorAll('.mml-seg')].map(x => getComputedStyle(x).backgroundColor))`));
const beruflich = farben.slice(1, -1);   // ohne Einstieg und Kontakt
pruefe('jedes Projekt hat eine eigene Farbe',
  new Set(beruflich).size === beruflich.length, beruflich.join(' '));

/* --- Blumenformen (Rückfall aus Aufgabe 5) --- */
const blume = JSON.parse(await s.werte(`(() => {
  const def = document.querySelector('#mm-blumen #bl-a');
  const benutzt = [...document.querySelectorAll('.md-rule use')];
  const sichtbar = benutzt.filter(u => u.getBoundingClientRect().width > 4).length;
  return JSON.stringify({ def: !!def, benutzt: benutzt.length, sichtbar });
})()`));
pruefe('die Blumenform ist definiert', blume.def);
pruefe('jeder Trenner zeigt wirklich eine Blume',
  blume.benutzt > 0 && blume.sichtbar === blume.benutzt,
  blume.sichtbar + ' von ' + blume.benutzt + ' sichtbar');

/* --- Türchen --- */
const t = JSON.parse(await s.werte(`(() => {
  const d = document.createElement('div');
  d.innerHTML = window.mm.renderMarkdown(
    'Ich sitze viel in [[Blender|blender|Was ich in 3D anstelle|Eigene Welt, dunkel und orange]].');
  const a = d.querySelector('a.mm-tuer');
  return JSON.stringify({
    gefunden: !!a, ziel: a && a.getAttribute('href'),
    wort: a && a.textContent, titel: a && a.dataset.titel
  });
})()`));
pruefe('Türchen-Schreibweise wird umgesetzt', t.gefunden);
pruefe('Türchen zeigt auf /welt/…', t.ziel === '/welt/blender', String(t.ziel));
pruefe('nur das Wort steht im Text', t.wort === 'Blender', String(t.wort));
pruefe('Vorschautitel kommt mit', t.titel === 'Was ich in 3D anstelle', String(t.titel));

await s.zu(); chrome.beenden(); server.beenden();
bericht();
