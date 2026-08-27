/* Prueft die Trennung von Bildunterschrift und Beschreibung.

   Bis hierher trug eine Bild-Zeile nur EINEN Text, und der landete
   gleichzeitig sichtbar als Bildunterschrift UND im alt-Attribut. Wer ein
   Bild fuer Blinde beschreiben wollte, musste diese Beschreibung also allen
   sichtbar unter das Bild schreiben. Genau deshalb tat es niemand, und
   saemtliche Bilder der Seite standen ohne alt-Text da.

   Die wichtigste Pruefung hier ist die LETZTE: jede Bild-Zeile, die heute
   schon in der Datenbank steht, muss haargenau dasselbe HTML ergeben wie
   vorher. Eine Aenderung an der Auszeichnungssprache, die bestehende
   Inhalte anders darstellt, waere keine Verbesserung, sondern ein Schaden --
   und niemandem faellt das auf, bevor Lucas die Seite ansieht. */

import { readFile } from 'node:fs/promises';
import { pruefe, bericht } from './chrome.mjs';
import { bildZeileBauen, bildZeilenLesen } from '../HOCHLADEN/assets/block-modell.js';

const HOCH = new URL('../HOCHLADEN/', import.meta.url);

/* shared.js ist eine Browser-Datei. renderMarkdown() selbst ist reine
   Zeichenkettenlogik, aber ganz unten legt die Datei beim Laden die
   Blumenformen fuer den Trenner ins Dokument -- dafuer braucht sie ein
   document. Deshalb hier die kleinstmoegliche Attrappe: sie meldet, die
   Blumen seien schon da, womit dieser Teil sofort aussteigt. Bewusst KEIN
   ausgewachsener DOM-Nachbau -- was hier geprueft wird, ist Text, und ein
   halbherziger Nachbau taeuschte nur eine Genauigkeit vor, die er nicht hat. */
const fenster = { mm: null };
const attrappe = { getElementById: () => ({}), addEventListener: () => {}, body: null };
new Function('window', 'document',
  await readFile(new URL('./assets/shared.js', HOCH), 'utf8'))(fenster, attrappe);
const { renderMarkdown } = fenster.mm;

const bildTag = (html) => (html.match(/<img[^>]*>/) || [''])[0];
const altVon = (html) => (bildTag(html).match(/alt="([^"]*)"/) || [, ''])[1];
const untVon = (html) => (html.match(/<figcaption>([\s\S]*?)<\/figcaption>/) || [, null])[1];

/* ---------- 1. Die vier Faelle ---------- */

{
  const h = renderMarkdown('![](/a.webp)');
  pruefe('ohne alles: kein alt-Text, keine Unterschrift', altVon(h) === '' && untVon(h) === null);
}
{
  const h = renderMarkdown('![Eine Unterschrift](/a.webp)');
  pruefe('nur Unterschrift: sichtbar UND als alt (besser als nichts)',
    untVon(h) === 'Eine Unterschrift' && altVon(h) === 'Eine Unterschrift');
}
{
  const h = renderMarkdown('![](/a.webp){gross}{Ein Hund im Schnee}');
  pruefe('nur Beschreibung: landet im alt-Text', altVon(h) === 'Ein Hund im Schnee');
  pruefe('nur Beschreibung: erscheint NICHT sichtbar unter dem Bild', untVon(h) === null);
}
{
  const h = renderMarkdown('![Bello, 2019](/a.webp){klein}{Ein Hund im Schnee}');
  pruefe('beides: Unterschrift sichtbar, Beschreibung im alt',
    untVon(h) === 'Bello, 2019' && altVon(h) === 'Ein Hund im Schnee');
  pruefe('beides: die Größenangabe wirkt weiter', h.includes('md-small') || h.includes('klein'),
    (h.match(/<figure class="([^"]*)"/) || [, ''])[1]);
}

/* ---------- 2. Hin und zurück ---------- */

{
  const roh = bildZeileBauen({ unterschrift: 'U', url: '/a.webp', groesse: 'gross', beschreibung: 'B' });
  pruefe('Beschreibung erzwingt die Größenangabe davor', roh === '![U](/a.webp){gross}{B}', roh);
  const [z] = bildZeilenLesen(roh);
  pruefe('Zeile mit beidem liest sich verlustfrei zurück',
    !!z && z.unterschrift === 'U' && z.beschreibung === 'B' && z.groesse === 'gross' && z.url === '/a.webp',
    z ? JSON.stringify(z) : 'gar nichts gelesen — die Regel passt nicht mehr');
}
{
  const roh = bildZeileBauen({ unterschrift: 'Nur U', url: '/a.webp' });
  pruefe('ohne Beschreibung bleibt die Zeile so kurz wie bisher',
    roh === '![Nur U](/a.webp)', roh);
}
{
  const [z] = bildZeilenLesen('![Alt](/a.webp){klein}');
  pruefe('eine ALTE Zeile liest sich als Unterschrift ohne Beschreibung',
    !!z && z.unterschrift === 'Alt' && z.beschreibung === '' && z.groesse === 'klein',
    z ? JSON.stringify(z) : 'gar nichts gelesen');
}

/* ---------- 3. GEGENBEWEIS ----------
   Ein Umsetzer, der beide Texte weiter in einen Topf wirft, muss hier
   auffallen -- sonst prueft der Rest oben nichts. */
{
  const h = renderMarkdown('![](/a.webp){gross}{Ein Hund im Schnee}');
  pruefe('GEGENBEWEIS: die Beschreibung steht nirgends im sichtbaren Text',
    !h.replace(/<img[^>]*>/g, '').includes('Ein Hund im Schnee'));
}

/* ---------- 4. Der Bestand darf sich NICHT ändern ---------- */

const seedRoh = await readFile(new URL('./assets/seed.js', HOCH), 'utf8');
const f2 = {}; new Function('window', seedRoh)(f2);
const s = f2.SEED_SEITEN || {};
const alleSeiten = [s.brief, ...(s.projekte || []), ...(s.welten || [])].filter(Boolean);

const bildZeilen = [];
for (const seite of alleSeiten) {
  for (const b of seite.bloecke || []) {
    const roh = (b.inhalt && b.inhalt.roh) || '';
    for (const z of roh.split('\n')) {
      if (/^!\[[^\]]*\]\([^)\s]+\)/.test(z.trim())) bildZeilen.push(z.trim());
    }
  }
}
pruefe('im Bestand stehen überhaupt Bild-Zeilen zum Vergleichen',
  bildZeilen.length > 0, bildZeilen.length + ' Zeilen');

/* Der Vergleichsmaßstab: So verhielt sich der ALTE Umsetzer -- ein Text,
   der gleichzeitig alt und Unterschrift war. Bewusst hier von Hand
   nachgebaut statt aus dem Code geholt, damit die Prüfung nicht dieselbe
   Änderung mitmacht, die sie überwachen soll. */
const wieVorher = (zeile) => {
  const m = zeile.match(/^!\[([^\]]*)\]\(([^)\s]+)\)(?:\{(klein|mittel|gross)\})?$/);
  if (!m) return null;
  return { alt: m[1] || '', unterschrift: m[1] || '' };
};

const abweichungen = bildZeilen.filter(z => {
  const soll = wieVorher(z);
  if (!soll) return false;
  const h = renderMarkdown(z);
  return altVon(h) !== soll.alt || (untVon(h) || '') !== soll.unterschrift;
});
pruefe('JEDE bestehende Bild-Zeile ergibt haargenau dasselbe wie vorher',
  abweichungen.length === 0, abweichungen.slice(0, 3).join(' | ') || 'keine Abweichung');

bericht();
