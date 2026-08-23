/* Beweist, dass beim Umzug nach `seiten`/`bloecke` kein Inhalt verlorenging.
   Vergleicht für JEDE Quellzeile beide Wege gegeneinander:
     alt — renderMarkdown(Rohtext aus projects/posts)
     neu — renderMarkdown(aneinandergehängte Rohteile aller Blöcke)
   Verglichen wird der SICHTBARE Text und jede Bild- und Videoadresse.
   Schlägt die Prüfung an, benennt sie den fehlenden Abschnitt wörtlich. */
import { starteChrome, oeffne, pruefe, bericht } from './chrome.mjs';
import { starteServer } from './server.mjs';

const wurzel = new URL('../HOCHLADEN/', import.meta.url).pathname;
const server = await starteServer({ wurzel, port: 8907 });
const chrome = await starteChrome({ port: 9347 });

const s = await oeffne('http://127.0.0.1:8907/', { port: 9347 });
await s.warte(3000);

const ergebnis = JSON.parse(await s.werte(`(async () => {
  const CFG = window.MM_CONFIG;
  const kopf = { apikey: CFG.key, Authorization: 'Bearer ' + CFG.key };
  const hol = async (pfad) => (await fetch(CFG.url + '/rest/v1/' + pfad, { headers: kopf })).json();

  const projekte = await hol('projects?status=eq.published&select=*&order=sort_order.asc');
  const beitraege = await hol('posts?status=eq.published&select=*');
  const seiten = await hol('seiten?select=*,bloecke(*)&order=sort_order.asc');

  /* Sichtbaren Text aus gerendertem Markdown ziehen, Leerraum vereinheitlichen. */
  const alsText = (md) => {
    const d = document.createElement('div');
    d.innerHTML = window.mm.renderMarkdown(md || '');
    return (d.innerText || d.textContent || '').replace(/\\s+/g, ' ').trim();
  };
  /* Alle Adressen aus gerendertem Markdown ziehen. */
  const adressen = (md) => {
    const d = document.createElement('div');
    d.innerHTML = window.mm.renderMarkdown(md || '');
    return [...d.querySelectorAll('img,iframe,source')].map(e => e.getAttribute('src')).filter(Boolean);
  };
  /* Die Rohteile einer Seite in ihrer Reihenfolge aneinanderhängen. */
  const rohVon = (seite) => (seite.bloecke || [])
    .slice().sort((a, b) => a.sort_order - b.sort_order)
    .map(b => (b.inhalt && b.inhalt.roh) || '')
    .filter(Boolean).join('\\n\\n');

  /* Text in Sinnabschnitte zerlegen, damit wir sagen können, WAS fehlt. */
  const stuecke = (t) => t.split(/(?<=[.!?])\\s+/).map(x => x.trim()).filter(x => x.length > 25);

  const fehlend = [], ohneSeite = [], adressFehler = [];

  const pruefeZeile = (zeile, rohFeld) => {
    const seite = seiten.find(x => x.slug === zeile.slug);
    if (!seite) { ohneSeite.push(zeile.slug); return; }
    const alt = alsText(zeile[rohFeld]);
    const neu = alsText(rohVon(seite));
    stuecke(alt).forEach(st => { if (!neu.includes(st)) fehlend.push(zeile.slug + ': ' + st.slice(0, 70)); });
    adressen(zeile[rohFeld]).forEach(a => {
      if (!adressen(rohVon(seite)).includes(a)) adressFehler.push(zeile.slug + ': ' + a);
    });
  };

  projekte.forEach(p => { pruefeZeile(p, 'body'); pruefeZeile(p, 'summary'); });
  beitraege.forEach(b => pruefeZeile(b, 'body'));

  /* Titel und Rolle dürfen ebenfalls nicht verschwinden. */
  const titelFehler = projekte.filter(p => {
    const seite = seiten.find(x => x.slug === p.slug);
    return !seite || seite.titel !== p.title;
  }).map(p => p.slug);

  /* Die private Notiz darf nirgends im ausgelieferten HTML stehen. */
  const notizen = seiten.flatMap(x => (x.bloecke || []).map(b => b.notiz)).filter(Boolean);
  const notizSichtbar = notizen.filter(n => document.documentElement.innerHTML.includes(n));

  return JSON.stringify({
    projekte: projekte.length, beitraege: beitraege.length, seiten: seiten.length,
    fehlend: fehlend.slice(0, 8), fehlendGesamt: fehlend.length,
    ohneSeite, adressFehler: adressFehler.slice(0, 8), adressGesamt: adressFehler.length,
    titelFehler, notizen: notizen.length, notizSichtbar,
  });
})()`));

pruefe('alle veröffentlichten Projekte haben eine Seite',
  ergebnis.ohneSeite.length === 0, ergebnis.ohneSeite.join(', '));
pruefe('KEIN Textabschnitt ist beim Umzug verlorengegangen',
  ergebnis.fehlendGesamt === 0,
  ergebnis.fehlendGesamt + ' fehlend' + (ergebnis.fehlend.length ? ' — ' + ergebnis.fehlend.join(' | ') : ''));
pruefe('KEINE Bild- oder Videoadresse ist verlorengegangen',
  ergebnis.adressGesamt === 0,
  ergebnis.adressGesamt + ' fehlend' + (ergebnis.adressFehler.length ? ' — ' + ergebnis.adressFehler.join(' | ') : ''));
pruefe('alle Titel stimmen überein', ergebnis.titelFehler.length === 0, ergebnis.titelFehler.join(', '));
pruefe('es gibt überhaupt Blöcke zu prüfen',
  ergebnis.seiten >= 7 && ergebnis.projekte === 5,
  ergebnis.seiten + ' Seiten, ' + ergebnis.projekte + ' Projekte, ' + ergebnis.beitraege + ' Beiträge');
pruefe('private Notizen erscheinen NICHT im ausgelieferten HTML',
  ergebnis.notizSichtbar.length === 0,
  ergebnis.notizen + ' Notizen vorhanden, ' + ergebnis.notizSichtbar.length + ' davon sichtbar');

/* Entwürfe dürfen für Fremde unsichtbar bleiben. */
const anonym = JSON.parse(await s.werte(`(async () => {
  const CFG = window.MM_CONFIG;
  const kopf = { apikey: CFG.key, Authorization: 'Bearer ' + CFG.key };
  const alle = await (await fetch(CFG.url + '/rest/v1/seiten?select=slug,status', { headers: kopf })).json();
  return JSON.stringify({ gesehen: alle.length, nichtVeroeffentlicht: alle.filter(x => x.status !== 'published').length });
})()`));
pruefe('als Fremder sind keine Entwürfe sichtbar',
  anonym.nichtVeroeffentlicht === 0,
  anonym.gesehen + ' Seiten sichtbar, davon ' + anonym.nichtVeroeffentlicht + ' unveröffentlicht');

await s.zu(); chrome.beenden(); server.beenden();
bericht();
