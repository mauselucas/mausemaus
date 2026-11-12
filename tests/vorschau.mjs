/* Vorschau-Server zum Anschauen und Anklicken.
   Benutzt denselben Netlify-Nachbau wie die Prüfungen, damit hier genau das
   passiert, was auch live passiert — einschließlich der Adressen /welt/… */
import { starteServer } from './server.mjs';

/* Optional: anderer Ordner und Port, z. B. die aufgeräumte Fassung:
   node tests/vorschau.mjs _site 8898 */
const wurzel = process.argv[2] || new URL('../HOCHLADEN/', import.meta.url).pathname;
const port = Number(process.argv[3] || process.env.PORT || 8899);

await starteServer({ wurzel, port });
console.log(`mausemaus-Vorschau läuft: http://localhost:${port}/`);
console.log('Beenden mit Strg+C.');

/* Offen halten. */
setInterval(() => {}, 1 << 30);
