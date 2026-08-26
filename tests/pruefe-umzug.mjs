/* Beweist, dass beim Umzug nach `seiten`/`bloecke` kein Inhalt verlorenging.
   Vergleicht für JEDE Quellzeile beide Wege gegeneinander:
     alt — renderMarkdown(Rohtext aus projects/posts)
     neu — renderMarkdown(aneinandergehängte Rohteile aller Blöcke)
   Verglichen wird der SICHTBARE Text und jede Bild- und Videoadresse.
   Schlägt die Prüfung an, benennt sie den fehlenden Abschnitt wörtlich. */
import { readFile } from 'node:fs/promises';
import { starteChrome, oeffne, pruefe, bericht } from './chrome.mjs';
import { starteServer } from './server.mjs';

/* Der Umzugs-Nachweis läuft gegen einen EINGEFRORENEN Stand, nicht gegen die
   laufende Datenbank. Grund: Lucas bearbeitet seine Seite täglich im Admin --
   neues Titelbild, Projekt archiviert, Platzhaltertext durch echten ersetzt.
   Gegen die lebende Datenbank verglichen wurde diese Prüfung dadurch rot,
   obwohl nichts kaputt war. Eine Prüfung, die bei normaler Benutzung Alarm
   schlägt, wird ignoriert und ist damit wertlos.
   Die Frage "ging beim Umzug etwas verloren?" hat ohnehin genau eine
   richtige Antwort, und die ändert sich nie mehr. */
const nachweis = JSON.parse(
  await readFile(new URL('./feste/umzug-nachweis.json', import.meta.url), 'utf8'));

const wurzel = new URL('../HOCHLADEN/', import.meta.url).pathname;
const server = await starteServer({ wurzel, port: 8907 });
const chrome = await starteChrome({ port: 9347 });

const s = await oeffne('http://127.0.0.1:8907/', { port: 9347 });
await s.warte(3000);

const ergebnis = JSON.parse(await s.werte(`(async () => {
  const N = ${JSON.stringify(nachweis)};
  const projekte  = N.projects.filter(p => p.status === 'published');
  const beitraege = N.posts.filter(p => p.status === 'published');
  /* Die Seiten samt Blöcken kommen aus demselben eingefrorenen Stand.
     "notiz" ist dort gar nicht erst enthalten (die Datei wird versioniert,
     private Notizen gehören nicht hinein) -- der Vergleich braucht sie auch
     nicht. */
  const seiten = N.seiten.map(x => ({ ...x,
    bloecke: N.bloecke.filter(b => b.seite_id === x.id) }));

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
    .map(b => {
      const i = b.inhalt || {};
      if (i.roh) return i.roh;
      /* Randnotiz, Abschnitt und Tuerchen tragen ihren Text NICHT in "roh",
         sondern in eigenen Feldern. Wer nur "roh" einsammelt, uebersieht
         genau die Eckdaten aus der alten Startseite (Status, Schwerpunkt)
         und meldet sie faelschlich als verloren. */
      return [i.titel, i.zusatz, i.zeile1, i.zeile2, i.text, i.ziel]
        .filter(Boolean).join(' ');
    })
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

  /* Hier stand einmal "die Notiz darf nicht im HTML stehen". Gegen den
     eingefrorenen Stand ist das ein Blindgaenger: Dort gibt es gar keine
     Notizen, die Pruefung meldete "0 vorhanden, 0 sichtbar" und konnte
     niemals fehlschlagen. Der wirksame Nachweis ist der gezielte Abruf
     weiter unten -- der laeuft LIVE gegen die echte Datenbank und
     verlangt HTTP 401. */
  /* Der gesamte Text ALLER Bloecke, wie ihn ein Besucher lesen wuerde. */
  const allerText = seiten.map(x => alsText(rohVon(x))).join(' ');
  const e = (N.settings && N.settings[0]) || {};
  const startseiteFehlt = [];
  const dabei = (wert, name) => { if (wert && !allerText.includes(String(wert).trim())) startseiteFehlt.push(name); };
  (e.infos || []).forEach(i => dabei(i.zeile1, 'info:' + i.titel));
  (e.werkzeuge || []).forEach(w => dabei(w.name, 'werkzeug:' + w.name));
  (e.kunden || []).forEach(k => dabei(k, 'kunde:' + k));
  if (e.profil_text) dabei(String(e.profil_text).slice(0, 40), 'profil_text');
  if (e.hero_intro) dabei(String(e.hero_intro).slice(0, 40), 'hero_intro');

  return JSON.stringify({
    startseiteFehlt,
    projekte: projekte.length, beitraege: beitraege.length, seiten: seiten.length,
    fehlend: fehlend.slice(0, 8), fehlendGesamt: fehlend.length,
    ohneSeite, adressFehler: adressFehler.slice(0, 8), adressGesamt: adressFehler.length,
    titelFehler,
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
/* Alles, was auf der alten Startseite stand (Eckdaten, Werkzeuge, Kunden),
   musste beim Umzug in Bloecke wandern -- es hing an den Einstellungen,
   nicht an den Projekten, und waere sonst still verschwunden. Frueher lief
   diese Pruefung in pruefe-brief.mjs gegen die LEBENDE Seite; seit Lucas
   den Werkzeug-Abschnitt bewusst entfernt hat, schlug sie dort falschen
   Alarm. Hier gilt sie gegen den eingefrorenen Stand und bleibt wahr. */
pruefe('KEIN Inhalt der alten Startseite ging beim Umzug verloren',
  ergebnis.startseiteFehlt.length === 0, ergebnis.startseiteFehlt.join(', '));

/* Der eigentliche Gewinn: nicht nur, dass die Notiz nicht ANGEZEIGT wird,
   sondern dass ein Fremder sie über die Datenbank-Schnittstelle gar nicht
   erst ERREICHEN kann -- unabhängig davon, was diese oder irgendeine
   andere Seite überhaupt abfragt. Direkter, gezielter Versuch mit dem
   öffentlichen Schlüssel, genau die Spalte zu lesen. */
const notizZugriff = JSON.parse(await s.werte(`(async () => {
  const CFG = window.MM_CONFIG;
  const kopf = { apikey: CFG.key, Authorization: 'Bearer ' + CFG.key };
  const r = await fetch(CFG.url + '/rest/v1/bloecke?select=notiz&limit=5', { headers: kopf });
  const daten = await r.json().catch(() => null);
  return JSON.stringify({
    status: r.status,
    /* Erfolgreich UND mit echten Werten wäre der Ernstfall: Zeilen, in
       denen "notiz" tatsächlich als Schlüssel auftaucht. */
    spalteGeliefert: Array.isArray(daten) && daten.some(z => z && Object.prototype.hasOwnProperty.call(z, 'notiz')),
  });
})()`));
pruefe('private Notizen sind für Fremde nicht abfragbar (auch nicht gezielt per select=notiz)',
  notizZugriff.status === 401 || notizZugriff.status === 403 || notizZugriff.spalteGeliefert === false,
  'HTTP ' + notizZugriff.status + ', Spalte geliefert: ' + notizZugriff.spalteGeliefert);

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
