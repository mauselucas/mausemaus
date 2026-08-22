import { symlinkSync, rmSync, existsSync } from 'node:fs';
const feste = new URL('../HOCHLADEN/tests-feste', import.meta.url).pathname;
if (existsSync(feste)) rmSync(feste, { recursive: true, force: true });
symlinkSync(new URL('./feste', import.meta.url).pathname, feste, 'dir');
process.on('exit', () => rmSync(feste, { recursive: true, force: true }));

import { starteChrome, oeffne, pruefe, bericht } from './chrome.mjs';
import { starteServer } from './server.mjs';

const wurzel = new URL('../HOCHLADEN/', import.meta.url).pathname;
const server = await starteServer({ wurzel, port: 8902 });
const chrome = await starteChrome({ port: 9334 });
const s = await oeffne('http://127.0.0.1:8902/tests-feste/leiste-probe.html',
  { port: 9334, breite: 1280, hoehe: 900 });
await s.warte(1200);

/* --- Aufbau --- */
const a = JSON.parse(await s.werte(`(() => {
  const segs=[...document.querySelectorAll('.mml-seg')];
  const ets=[...document.querySelectorAll('.mml-et')];
  const eb=ets.map(e=>e.getBoundingClientRect());
  let ueberlappt=0;
  for(let i=1;i<eb.length;i++) if(eb[i].top-eb[i-1].bottom < 0) ueberlappt++;
  const luecken=[]; const sb=segs.map(x=>x.getBoundingClientRect());
  for(let i=1;i<sb.length;i++) luecken.push(Math.round(sb[i].top-sb[i-1].bottom));
  return JSON.stringify({
    segmente: segs.length, etiketten: ets.length, ueberlappt, luecken,
    abgeschnitten: ets.filter(e=>{const b=e.querySelector('.mml-titel');
      return b.scrollWidth > b.clientWidth + 1;}).length,
    etBreiten: [...new Set(ets.map(e=>Math.round(e.getBoundingClientRect().width)))],
    kurve: getComputedStyle(document.querySelector('.mml')).transitionTimingFunction,
    dauer: getComputedStyle(document.querySelector('.mml')).transitionDuration
  });
})()`));

pruefe('neun Segmente', a.segmente === 9, String(a.segmente));
pruefe('neun Etiketten', a.etiketten === 9, String(a.etiketten));
pruefe('keine Etiketten überlappen', a.ueberlappt === 0, a.ueberlappt + ' Überlappungen');
pruefe('kein Titel abgeschnitten', a.abgeschnitten === 0, a.abgeschnitten + ' abgeschnitten');
pruefe('Segmente haben Abstand (nicht lückenlos)', a.luecken.every(l => l >= 4 && l <= 9), a.luecken.join(','));
pruefe('Etiketten haben feste Breite', a.etBreiten.length === 1 && a.etBreiten[0] === 172, a.etBreiten.join(','));
pruefe('Kurve wie festgelegt', a.kurve.replace(/\s/g,'') === 'cubic-bezier(0.5,0,0.12,1)', a.kurve);
pruefe('Dauer 860 ms', a.dauer === '0.86s', a.dauer);

/* Das Gleis muss weitgehend belegt sein. Steht hinter dem letzten Abschnitt
   viel Leerraum, bleibt ein großer Teil der Leiste ungenutzt. */
const fuellung = JSON.parse(await s.werte(`(() => {
  const g = document.querySelector('.mml-gleis').getBoundingClientRect();
  const belegt = [...document.querySelectorAll('.mml-seg')]
    .reduce((n, x) => n + x.getBoundingClientRect().height, 0);
  return JSON.stringify({ anteil: Math.round(belegt / g.height * 100) });
})()`));
pruefe('das Gleis ist zu mindestens 85 % belegt', fuellung.anteil >= 85, fuellung.anteil + ' %');

/* --- Pacing: 760 ms halten, dann zu --- */
await s.werte(`document.getElementById('scroller').scrollTo({top:600,behavior:'instant'})`);
await s.warte(300);
pruefe('nach 300 ms noch offen',
  !JSON.parse(await s.werte(`document.querySelector('.mml').classList.contains('mml-zu')`)));
await s.warte(900);
pruefe('nach 1200 ms zugeklappt',
  JSON.parse(await s.werte(`document.querySelector('.mml').classList.contains('mml-zu')`)));

/* --- Einmal zu, bleibt zu ---
   Ausdrücklicher Wunsch des Auftraggebers: Eine Leiste, die bei jedem
   Abschnittswechsel wieder aufspringt, ist lästig. Sie zeigt sich einmal
   beim Laden, danach nur noch auf Zuruf. */
await s.werte(`document.getElementById('scroller').scrollTo({top:200,behavior:'instant'})`);
await s.warte(400);
pruefe('Hochscrollen öffnet sie NICHT wieder',
  JSON.parse(await s.werte(`document.querySelector('.mml').classList.contains('mml-zu')`)));
await s.werte(`document.getElementById('scroller').scrollTo({top:0,behavior:'instant'})`);
await s.warte(400);
pruefe('auch ganz oben bleibt sie zu',
  JSON.parse(await s.werte(`document.querySelector('.mml').classList.contains('mml-zu')`)));
await s.werte(`document.querySelector('.mml').dispatchEvent(new MouseEvent('mouseenter'))`);
await s.warte(200);
pruefe('mit der Maus lässt sie sich jederzeit wieder öffnen',
  !JSON.parse(await s.werte(`document.querySelector('.mml').classList.contains('mml-zu')`)));
await s.werte(`document.querySelector('.mml').dispatchEvent(new MouseEvent('mouseleave'))`);
await s.warte(1400);

/* ═══ Ab hier eine FRISCH geladene Seite ═══
   Die folgenden Prüfungen brauchen den Zustand "noch nie zugeklappt":
   Die Leiste öffnet sich nach dem ersten Zuklappen nicht mehr von selbst,
   und beide Sperren greifen nur, solange der Zeitgeber überhaupt läuft. */
await s.werte(`location.reload()`);
await s.warte(1400);

/* --- DER FEHLER, den der Auftraggeber gemeldet hat ---
   Der Tipp muss NACH UNTEN springen: Ein Sprung nach oben löst gar keinen
   Zuklapp-Vorgang aus und beweist über die Sperren nichts.
   KEIN mouseenter — so verhält sich ein Berührungsgerät. Damit hängt diese
   Prüfung allein an springtGerade und lässt sich einzeln widerlegen. */
const zielIndex = JSON.parse(await s.werte(`(() => {
  const sc = document.getElementById('scroller');
  const ab = [...document.querySelectorAll('#sp section')];
  for (let i = ab.length - 1; i >= 0; i--)
    if (ab[i].offsetTop > sc.scrollTop + 400) return i;
  return -1;
})()`));
pruefe('es gibt einen Abschnitt weiter unten zum Anspringen', zielIndex > 0, 'Index ' + zielIndex);

await s.werte(`document.querySelectorAll('.mml-et')[${zielIndex}].click()`);
await s.warte(1700);
const nachKlick = JSON.parse(await s.werte(`JSON.stringify({
  zu: document.querySelector('.mml').classList.contains('mml-zu'),
  stand: document.getElementById('scroller').scrollTop
})`));
pruefe('der Tipp ist wirklich nach unten gesprungen', nachKlick.stand > 400, 'bei ' + nachKlick.stand + ' px');
pruefe('Tippen auf ein Projekt klappt die Leiste nicht zu (ohne Mauszeiger)', !nachKlick.zu);

/* Dasselbe über einen Tipp auf den Balken. Wieder frisch laden, weil der
   vorige Tipp die Leiste zwar offen gelassen hat, der Zeitgeber aber
   bereits gelaufen ist. */
await s.werte(`location.reload()`);
await s.warte(1400);
await s.werte(`document.querySelectorAll('.mml-seg')[${zielIndex}].click()`);
await s.warte(1700);
pruefe('auch ein Tipp auf den Balken klappt sie nicht zu',
  !JSON.parse(await s.werte(`document.querySelector('.mml').classList.contains('mml-zu')`)));

/* --- Die zweite Sperre, für sich allein geprüft ---
   Die beiden Sperren decken verschiedene Fälle ab:
     springtGerade  — ein durch Klick ausgelöster Sprung ist kein Wegscrollen.
                      Auf Berührungsgeräten ohne Mauszeiger die einzige Sperre.
     zeigerDrin     — wer den Zeiger in der Leiste hat, will sie benutzen;
                      dann darf sie auch bei echtem Wegscrollen nicht zugehen.
   Die Klickprüfung oben trifft nur die erste: Das sanfte Scrollen ist
   innerhalb der 900-ms-Schonfrist beendet, weiter kommt der Code nie.
   Hier also OHNE Klick, mit Abstand zu jeder Schonfrist — und auf einer
   frisch geladenen Seite, weil der Zeitgeber nach dem ersten Zuklappen
   gar nicht mehr anläuft und die Sperre dann unerreichbar wäre. */
await s.werte(`location.reload()`);        // wieder "noch nie zugeklappt"
await s.warte(1400);
await s.werte(`document.querySelector('.mml').dispatchEvent(new MouseEvent('mouseenter'))`);
await s.warte(1000);                      // sicher jenseits der 900-ms-Schonfrist
await s.werte(`document.getElementById('scroller').scrollTo({top:900,behavior:'instant'})`);
await s.warte(1700);                      // deutlich länger als 760 ms Halten
pruefe('Wegscrollen bei Zeiger IN der Leiste klappt sie nicht zu',
  !JSON.parse(await s.werte(`document.querySelector('.mml').classList.contains('mml-zu')`)));

/* Die Leiste ist jetzt offen, der Zeiger drin, weit unten gescrollt.
   Genau der Zustand, den der folgende Block als Ausgangslage braucht —
   und er ist zugleich die Gegenprobe zur Zeile oben: Wenn die Leiste sich
   gleich nach Mausaustritt schließt, war „bleibt offen" eine echte Aussage. */

/* --- Maus raus: 1100 ms warten, dann zu --- */
await s.werte(`document.querySelector('.mml').dispatchEvent(new MouseEvent('mouseleave'))`);
await s.warte(400);
pruefe('nach Mausaustritt erst noch offen',
  !JSON.parse(await s.werte(`document.querySelector('.mml').classList.contains('mml-zu')`)));
await s.warte(1000);
pruefe('nach 1400 ms zugeklappt',
  JSON.parse(await s.werte(`document.querySelector('.mml').classList.contains('mml-zu')`)));

/* --- Handy: 520 px ist die schmalste Breite, die Chrome ehrlich abbildet --- */
const h = await oeffne('http://127.0.0.1:8902/tests-feste/leiste-probe.html',
  { port: 9334, breite: 520, hoehe: 900 });
await h.warte(1200);
const m = JSON.parse(await h.werte(`JSON.stringify({
  waagerecht: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  leisteBreite: Math.round(document.querySelector('.mml').getBoundingClientRect().width),
  leisteHoehe: Math.round(document.querySelector('.mml').getBoundingClientRect().height),
  textBreite: Math.round(document.querySelector('.sp').getBoundingClientRect().width)
})`));
pruefe('kein waagerechtes Scrollen auf dem Handy', !m.waagerecht);
pruefe('Leiste ist ein Streifen oben, keine Spalte', m.leisteHoehe < 90, m.leisteHoehe + ' px hoch');
pruefe('Leiste nimmt die volle Breite', m.leisteBreite >= 500, m.leisteBreite + ' px');
pruefe('Text bekommt Platz', m.textBreite > 400, m.textBreite + ' px');

/* Das Fortschrittsband muss auf dem Handy wirklich farbige Abschnitte zeigen.
   Ohne left/width wären alle Segmente 0 px breit — das Band wäre da, aber leer. */
const band = JSON.parse(await h.werte(`(() => {
  const g = document.querySelector('.mml-gleis').getBoundingClientRect();
  const b = [...document.querySelectorAll('.mml-seg')].map(x => x.getBoundingClientRect().width);
  return JSON.stringify({ belegt: Math.round(b.reduce((n, x) => n + x, 0)),
                          gleis: Math.round(g.width), schmalste: Math.round(Math.min(...b)) });
})()`));
pruefe('das Fortschrittsband zeigt farbige Abschnitte',
  band.schmalste > 2 && band.belegt > band.gleis * 0.8,
  band.belegt + ' von ' + band.gleis + ' px belegt, schmalste ' + band.schmalste + ' px');

/* Aufgeklappt darf unter der Liste keine große Leere stehen. */
await h.werte(`document.querySelector('.mml-griff').click()`);
await h.warte(1200);
const auf = JSON.parse(await h.werte(`(() => {
  const r = document.querySelector('.mml').getBoundingClientRect();
  const l = document.querySelector('.mml-etiketten').getBoundingClientRect();
  return JSON.stringify({ leiste: Math.round(r.height), liste: Math.round(l.height) });
})()`));
pruefe('die aufgeklappte Liste schmiegt sich an ihren Inhalt',
  auf.leiste - auf.liste < 90, auf.leiste + ' px hoch bei ' + auf.liste + ' px Liste');

/* Auf dem Handy darf der Griff die Leiste NICHT festklemmen. Sonst bliebe sie
   nach dem Wechsel zurück auf Spaltenbreite dauerhaft offen — und die Regel
   "einmal zu, bleibt zu" wäre still ausgehebelt. */
const klemme = JSON.parse(await h.werte(`(() => {
  const griff = document.querySelector('.mml-griff');
  const vorher = griff.textContent.trim();
  griff.click();                                   // Liste auf
  const ersterEintrag = document.querySelector('.mml-et');
  if (ersterEintrag) ersterEintrag.click();        // und wieder zu
  return JSON.stringify({ vorher, nachher: griff.textContent.trim() });
})()`));
pruefe('der Griff klemmt auf dem Handy nichts fest',
  klemme.nachher === klemme.vorher && klemme.nachher === '‹',
  klemme.vorher + ' -> ' + klemme.nachher);

await h.zu();

await s.zu(); chrome.beenden(); server.beenden();
bericht();
