import { starteChrome, oeffne, pruefe, bericht } from './chrome.mjs';
import { starteServer } from './server.mjs';

const wurzel = new URL('../HOCHLADEN/', import.meta.url).pathname;
const server = await starteServer({ wurzel, port: 8901 });
const chrome = await starteChrome({});

const s = await oeffne('http://127.0.0.1:8901/');
await s.warte(2500);
const d = JSON.parse(await s.werte(`JSON.stringify({
  titel: document.title,
  schrift: document.fonts.check('16px Tropi'),
  css: getComputedStyle(document.body).backgroundColor,
  hoehe: document.body.scrollHeight
})`));

pruefe('Seite lädt', d.titel.includes('mausemaus'), d.titel);
pruefe('Schrift Tropi geladen', d.schrift);
pruefe('CSS greift (Untergrund nicht weiß)', d.css !== 'rgba(0, 0, 0, 0)' && d.css !== 'rgb(255, 255, 255)', d.css);
pruefe('Seite hat Höhe', d.hoehe > 1000, d.hoehe + ' px');

await s.zu(); chrome.beenden(); server.beenden();
bericht();
