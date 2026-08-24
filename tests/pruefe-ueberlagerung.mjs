/* Misst die Überlagerung im ECHTEN Browser -- das, was Node nicht kann.

   Im Editor liegt ein durchscheinendes Textfeld über einer eingefärbten
   Schicht. Damit die Schrift nicht versetzt zum Cursor steht, muss die
   Schicht den Text GENAUSO setzen wie das Feld darunter. Zwei Wege, wie
   das schiefgehen kann -- beide gab es in diesem Projekt schon:

     1. ZEICHEN fehlen (die Sterne wurden entfernt)
        -> prüft tests/pruefe-auszeichnung.mjs in Node.
     2. GLYPHEN werden breiter (font-weight:bold in .hz-fett)
        -> sieht Node NICHT. Alle Zeichen sind da, trotzdem wandert der
           Zeilenumbruch, weil fette Buchstaben mehr Platz brauchen.

   Diese Prüfung deckt Fall 2 ab, und zwar messend statt behauptend:
   Dieselbe Zeichenkette wird einmal MIT Auszeichnungs-Spans und einmal als
   nackter Text in dasselbe Element gesetzt. Fallen Breite und Höhe des
   gesetzten Textes auseinander, verändert eine der Klassen die Metrik. */
import { existsSync, rmSync, symlinkSync } from 'node:fs';
import { starteChrome, oeffne, pruefe, bericht } from './chrome.mjs';
import { starteServer } from './server.mjs';

const feste = new URL('../HOCHLADEN/tests-feste', import.meta.url).pathname;
if (existsSync(feste)) rmSync(feste, { recursive: true, force: true });
symlinkSync(new URL('./feste', import.meta.url).pathname, feste, 'dir');
process.on('exit', () => rmSync(feste, { recursive: true, force: true }));

const wurzel = new URL('../HOCHLADEN/', import.meta.url).pathname;
const server = await starteServer({ wurzel, port: 8909 });
const chrome = await starteChrome({ port: 9349 });
const URL_PROBE = 'http://127.0.0.1:8909/tests-feste/blockeditor-probe.html';

const s = await oeffne(URL_PROBE, { port: 9349, breite: 1280, hoehe: 1000 });
await s.warte(400);

/* ---------- Zuerst die Grundbedingung: setzen beide Schichten überhaupt
   nach denselben Regeln? ----------

   Diese Prüfung fehlte, und ihr Fehlen hat einen Fehler durchgelassen: Die
   Regel `.admin textarea { font-family: inherit; font-size: 14px }` ist
   spezifischer als `.be-text` und gewann. Das Schreibfeld lief mit
   Systemschrift in 14px, die Schicht darunter mit Space Grotesk in 17px.
   Alle folgenden Messungen vergleichen die Schicht nur mit SICH SELBST --
   sie blieben deshalb grün, obwohl die beiden Schichten überhaupt nicht
   mehr zueinander passten. Erst der Blick in die berechneten Stile im
   Browser hat es gezeigt. */
{
  const EIGENSCHAFTEN = ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle',
    'fontVariant', 'lineHeight', 'letterSpacing', 'wordSpacing', 'textIndent',
    'textTransform', 'whiteSpace', 'overflowWrap', 'wordBreak', 'tabSize',
    'paddingLeft', 'paddingRight', 'paddingTop', 'borderLeftWidth', 'borderTopWidth'];
  const unterschiede = JSON.parse(await s.werte(`(() => {
    const F = ${JSON.stringify(EIGENSCHAFTEN)};
    const wrap = document.querySelector('.be-zeile[data-typ="text"] .be-text-wrap');
    const a = getComputedStyle(wrap.querySelector('.be-text'));
    const b = getComputedStyle(wrap.querySelector('.be-highlight'));
    return JSON.stringify(F.filter(f => a[f] !== b[f])
      .map(f => f + ': Feld=' + a[f] + ' / Schicht=' + b[f]));
  })()`));
  pruefe('GRUNDBEDINGUNG: Schreibfeld und eingefärbte Schicht setzen Text nach IDENTISCHEN Regeln',
    unterschiede.length === 0, unterschiede.join(' | '));

  /* GEGENBEWEIS: eine einzige abweichende Eigenschaft muss auffallen. */
  await s.werte(`(() => {
    const st = document.createElement('style');
    st.id = 'gegenbeweis-schrift';
    st.textContent = '.be-highlight { letter-spacing: .4px !important; }';
    document.head.appendChild(st);
  })()`);
  const mitAbweichung = JSON.parse(await s.werte(`(() => {
    const wrap = document.querySelector('.be-zeile[data-typ="text"] .be-text-wrap');
    const a = getComputedStyle(wrap.querySelector('.be-text'));
    const b = getComputedStyle(wrap.querySelector('.be-highlight'));
    return JSON.stringify(a.letterSpacing !== b.letterSpacing);
  })()`));
  await s.werte(`document.getElementById('gegenbeweis-schrift').remove()`);
  pruefe('GEGENBEWEIS: schon ein abweichender Buchstabenabstand würde erkannt', mitAbweichung === true);
}

/* Setzt den Text des ersten Textblocks und misst, wie die eingefärbte
   Schicht ihn setzt -- einmal mit Spans, einmal als nackter Text im
   GLEICHEN Element (gleiche Box, gleiche Schriftregeln, kein Nachbau). */
async function messen(text) {
  return JSON.parse(await s.werte(`(() => {
    const wrap = document.querySelector('.be-zeile[data-typ="text"] .be-text-wrap');
    const ta = wrap.querySelector('.be-text');
    const hl = wrap.querySelector('.be-highlight');

    ta.value = ${JSON.stringify(text)};
    ta.dispatchEvent(new Event('input', { bubbles: true }));

    const kasten = () => {
      const r = document.createRange();
      r.selectNodeContents(hl);
      const b = r.getBoundingClientRect();
      return { breite: Math.round(b.width * 100) / 100, hoehe: Math.round(b.height * 100) / 100 };
    };

    const mitSpans = kasten();
    const html = hl.innerHTML;
    hl.textContent = ${JSON.stringify(text)} + '\\n';   // derselbe Rohtext, ganz ohne Auszeichnung
    const nackt = kasten();
    hl.innerHTML = html;                                 // sofort zurück

    /* Zusätzlich: das Textfeld selbst. Weicht seine Satzhöhe von der
       Schicht ab, sieht man beim Tippen den Versatz unmittelbar. */
    return JSON.stringify({ mitSpans, nackt, feldHoehe: ta.scrollHeight, spanHtml: html.slice(0, 120) });
  })()`));
}

/* Einzeilig -> die Breite ist die exakte Textbreite.
   Mehrzeilig -> die Höhe verrät, ob der Zeilenumbruch gewandert ist. */
const EINZEILIG = [
  'ganz **fett** und *kursiv* zusammen',
  'ein [Link](https://example.com) im Satz',
  'ein [[Tuerchen|welt|Titel|Text]] im Satz',
  'geheim ((Wort|welt)) im Satz',
  'A **b** C [l](https://u.de) D [[t|s]] E *k* F ((g|z))',
];
const MEHRZEILIG = [
  ('Ein langer Absatz, der ganz sicher umbricht, mit **fetten Stellen** darin und '
   + '*kursiven Stellen* und noch mehr Text, damit mehrere Zeilen entstehen und der '
   + 'Umbruch wirklich auf die Probe gestellt wird. **Noch eine fette Stelle** am Ende.'),
  ('Kurz vor der Kante: aaaa bbbb cccc dddd eeee ffff gggg hhhh iiii jjjj kkkk llll '
   + '**mmmm** nnnn oooo pppp qqqq rrrr ssss tttt uuuu vvvv wwww xxxx yyyy zzzz.'),
];

const breitenFehler = [], hoehenFehler = [];
for (const text of EINZEILIG) {
  const m = await messen(text);
  if (Math.abs(m.mitSpans.breite - m.nackt.breite) > 0.5)
    breitenFehler.push(`${JSON.stringify(text.slice(0, 34))}: ${m.mitSpans.breite} statt ${m.nackt.breite}`);
}
pruefe(`METRIK: ausgezeichneter Text ist exakt so breit wie nackter Text (${EINZEILIG.length} Fälle)`,
  breitenFehler.length === 0, breitenFehler.join(' | '));

for (const text of MEHRZEILIG) {
  const m = await messen(text);
  if (Math.abs(m.mitSpans.hoehe - m.nackt.hoehe) > 0.5)
    hoehenFehler.push(`${JSON.stringify(text.slice(0, 34))}: ${m.mitSpans.hoehe} statt ${m.nackt.hoehe}`);
}
pruefe(`METRIK: der Zeilenumbruch wandert durch die Auszeichnung nicht (${MEHRZEILIG.length} Fälle)`,
  hoehenFehler.length === 0, hoehenFehler.join(' | '));

/* Und die Schicht muss zum Feld darunter passen, nicht nur zu sich selbst.
   Beide auf DIESELBE Weise messen: die Schicht kurz aus der absoluten
   Lage nehmen, damit sie sich wie das Textfeld an ihrem Inhalt bemisst.
   (Ein Vergleich "Textkasten der Schicht gegen scrollHeight des Feldes"
   wäre Äpfel gegen Birnen -- der eine Wert zählt Schriftkästen, der
   andere Zeilenkästen samt Polsterung.) */
{
  const h = JSON.parse(await s.werte(`(() => {
    const wrap = document.querySelector('.be-zeile[data-typ="text"] .be-text-wrap');
    const ta = wrap.querySelector('.be-text');
    const hl = wrap.querySelector('.be-highlight');
    ta.value = ${JSON.stringify(MEHRZEILIG[0])};
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    const vorher = hl.style.position;
    hl.style.position = 'static';
    void hl.offsetHeight;                     // Umbruch erzwingen
    const schicht = hl.scrollHeight;
    hl.style.position = vorher || '';
    return JSON.stringify({ schicht, feld: ta.scrollHeight });
  })()`));
  /* Ein Zeilensprung wären ~28px -- alles darunter ist Rundung, alles
     darüber heißt: die beiden Schichten brechen an anderen Stellen um. */
  pruefe('METRIK: die eingefärbte Schicht ist genauso hoch wie das Textfeld darunter (gleiche Zeilenzahl)',
    Math.abs(h.schicht - h.feld) < 14, `Schicht ${h.schicht}, Feld ${h.feld}`);
}

/* Die Auszeichnung muss überhaupt sichtbar SEIN -- sonst wäre die
   Metrik-Prüfung trivial erfüllt (nichts tun ist immer metrikneutral). */
{
  const sichtbar = JSON.parse(await s.werte(`(() => {
    const hl = document.querySelector('.be-zeile[data-typ="text"] .be-highlight');
    const fett = hl.querySelector('.hz-fett'), kursiv = hl.querySelector('.hz-kursiv');
    const st = (el) => el ? getComputedStyle(el) : null;
    const f = st(fett), k = st(kursiv);
    return JSON.stringify({
      hatFett: !!fett, hatKursiv: !!kursiv,
      fettSchatten: f ? f.textShadow : '', fettGewicht: f ? f.fontWeight : '',
      kursivHintergrund: k ? k.backgroundColor : '', kursivNeigung: k ? k.fontStyle : '',
    });
  })()`));
  pruefe('die Auszeichnung ist überhaupt vorhanden (sonst wäre die Metrik-Prüfung trivial)',
    sichtbar.hatFett && sichtbar.hatKursiv, JSON.stringify(sichtbar));
  pruefe('„fett" wird durch einen Schatten gemalt, NICHT durch font-weight',
    sichtbar.fettSchatten !== 'none' && sichtbar.fettSchatten !== ''
      && !['700', '800', '900', 'bold'].includes(sichtbar.fettGewicht),
    `Schatten: ${sichtbar.fettSchatten} · Gewicht: ${sichtbar.fettGewicht}`);
  pruefe('„kursiv" wird durch einen Hintergrund gemalt, NICHT durch font-style',
    sichtbar.kursivNeigung === 'normal'
      && sichtbar.kursivHintergrund !== 'rgba(0, 0, 0, 0)',
    `Neigung: ${sichtbar.kursivNeigung} · Hintergrund: ${sichtbar.kursivHintergrund}`);
}

/* ================= GEGENBEWEIS =================
   Genau der Fehler, den diese Prüfung verhindern soll: echtes Fett in der
   Schicht. Alle Zeichen bleiben erhalten (Node bliebe still) -- die
   Messung hier MUSS trotzdem anschlagen. */
await s.werte(`(() => {
  const st = document.createElement('style');
  st.id = 'gegenbeweis-fett';
  st.textContent = '.hz-fett { font-weight: 800 !important; text-shadow: none !important; }';
  document.head.appendChild(st);
})()`);
{
  const m = await messen(EINZEILIG[0]);
  pruefe('GEGENBEWEIS: mit echtem font-weight:800 wird der ausgezeichnete Text messbar BREITER',
    Math.abs(m.mitSpans.breite - m.nackt.breite) > 0.5,
    `${m.mitSpans.breite} statt ${m.nackt.breite}`);
  const lang = await messen(MEHRZEILIG[1]);
  pruefe('GEGENBEWEIS: …und der Zeilenumbruch wandert dadurch nachweislich',
    Math.abs(lang.mitSpans.hoehe - lang.nackt.hoehe) > 0.5
      || Math.abs(lang.mitSpans.breite - lang.nackt.breite) > 0.5,
    `Höhe ${lang.mitSpans.hoehe} statt ${lang.nackt.hoehe}, Breite ${lang.mitSpans.breite} statt ${lang.nackt.breite}`);
}
await s.werte(`document.getElementById('gegenbeweis-fett').remove()`);

/* Nach dem Aufräumen muss wieder alles stimmen -- sonst hätte der
   Gegenbeweis den Zustand beschädigt. */
{
  const m = await messen(EINZEILIG[0]);
  pruefe('nach dem Gegenbeweis ist die Metrik wieder in Ordnung',
    Math.abs(m.mitSpans.breite - m.nackt.breite) <= 0.5,
    `${m.mitSpans.breite} vs ${m.nackt.breite}`);
}

/* ---------- Bild für die Sichtprüfung ---------- */
await s.werte(`(() => {
  const ta = document.querySelector('.be-zeile[data-typ="text"] .be-text');
  ta.value = 'Ein Absatz mit **fett**, *kursiv*, einem [Link](https://mausemaus.com), '
    + 'einem [[Tuerchen|the-race|Titel|Vorschautext]] und einem geheimen ((Wort|welt)).';
  ta.dispatchEvent(new Event('input', { bubbles: true }));
  ta.focus();
  ta.setSelectionRange(ta.value.length, ta.value.length);
  window.scrollTo(0, 0);
})()`);
await s.warte(250);
await s.bild(new URL('./bilder/ueberlagerung-1280.png', import.meta.url).pathname);

const jsFehler = s.fehlerAufSeite();
pruefe('keine JavaScript-Fehler', jsFehler.length === 0, jsFehler.join(' | '));

await s.zu(); chrome.beenden(); server.beenden();
bericht();
