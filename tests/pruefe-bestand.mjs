import { starteChrome, oeffne, pruefe, bericht } from './chrome.mjs';
import { starteServer } from './server.mjs';

const wurzel = new URL('../HOCHLADEN/', import.meta.url).pathname;
const server = await starteServer({ wurzel, port: 8901 });
const chrome = await starteChrome({});

const s = await oeffne('http://127.0.0.1:8901/');
await s.warte(2500);
const d = JSON.parse(await s.werte(`JSON.stringify({
  titel: document.title,
  /* NICHT document.fonts.check() benutzen: das findet auch Schriften, die
     auf dem Rechner installiert sind. Auf Lucas' Mac liegt eine Schrift
     namens "Tropi Land" — die Prüfung meldete deshalb auch dann Erfolg,
     wenn fonts.css gar nicht geladen war. Stattdessen nachsehen, ob die
     Schrift wirklich aus einer @font-face-Regel der Seite stammt. */
  schrift: [...document.fonts].some(f => f.family === 'Tropi'),
  schriftQuelle: [...document.fonts].length + ' Schriftschnitte aus CSS',
  css: getComputedStyle(document.body).backgroundColor,
  hoehe: document.body.scrollHeight
})`));

pruefe('Seite lädt', d.titel.includes('mausemaus'), d.titel);
pruefe('Schrift Tropi kommt aus fonts.css', d.schrift, d.schriftQuelle);
pruefe('CSS greift (Untergrund nicht weiß)', d.css !== 'rgba(0, 0, 0, 0)' && d.css !== 'rgb(255, 255, 255)', d.css);
pruefe('Seite hat Höhe', d.hoehe > 1000, d.hoehe + ' px');
const f = s.fehlerAufSeite();
pruefe('keine Fehler auf der Seite', f.length === 0, f.join(' | ').slice(0, 200));

await s.zu(); chrome.beenden(); server.beenden();
bericht();
