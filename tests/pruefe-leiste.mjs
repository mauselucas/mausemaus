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

/* --- Pacing: 760 ms halten, dann zu --- */
await s.werte(`document.getElementById('scroller').scrollTo({top:600,behavior:'instant'})`);
await s.warte(300);
pruefe('nach 300 ms noch offen',
  !JSON.parse(await s.werte(`document.querySelector('.mml').classList.contains('mml-zu')`)));
await s.warte(900);
pruefe('nach 1200 ms zugeklappt',
  JSON.parse(await s.werte(`document.querySelector('.mml').classList.contains('mml-zu')`)));

/* --- Hochscrollen öffnet sofort --- */
await s.werte(`document.getElementById('scroller').scrollTo({top:200,behavior:'instant'})`);
await s.warte(120);
pruefe('Hochscrollen öffnet ohne Warten',
  !JSON.parse(await s.werte(`document.querySelector('.mml').classList.contains('mml-zu')`)));

/* --- DER FEHLER: Klick in der Leiste darf sie nicht zuklappen --- */
await s.werte(`document.getElementById('scroller').scrollTo({top:600,behavior:'instant'})`);
await s.warte(1100);                      // zu
await s.werte(`document.querySelector('.mml').dispatchEvent(new MouseEvent('mouseenter'))`);
await s.warte(200);                       // offen, Zeiger drin
await s.werte(`document.querySelectorAll('.mml-et')[7].click()`);
await s.warte(1600);                      // deutlich länger als 760 ms halten
pruefe('Klick in der Leiste klappt sie NICHT zu (Zeiger ist noch drin)',
  !JSON.parse(await s.werte(`document.querySelector('.mml').classList.contains('mml-zu')`)));

/* --- Maus raus: 1100 ms warten, dann zu --- */
await s.werte(`document.querySelector('.mml').dispatchEvent(new MouseEvent('mouseleave'))`);
await s.warte(400);
pruefe('nach Mausaustritt erst noch offen',
  !JSON.parse(await s.werte(`document.querySelector('.mml').classList.contains('mml-zu')`)));
await s.warte(1000);
pruefe('nach 1400 ms zugeklappt',
  JSON.parse(await s.werte(`document.querySelector('.mml').classList.contains('mml-zu')`)));

await s.zu(); chrome.beenden(); server.beenden();
bericht();
