/* Vorschau-Server zum Anschauen und Anklicken.
   Benutzt denselben Netlify-Nachbau wie die Prüfungen, damit hier genau das
   passiert, was auch live passiert — einschließlich der Adressen /welt/… */
import { starteServer } from './server.mjs';

const wurzel = new URL('../HOCHLADEN/', import.meta.url).pathname;
const port = Number(process.env.PORT || 8899);

await starteServer({ wurzel, port });
console.log(`mausemaus-Vorschau läuft: http://localhost:${port}/`);
console.log('Beenden mit Strg+C.');

/* Offen halten. */
setInterval(() => {}, 1 << 30);
