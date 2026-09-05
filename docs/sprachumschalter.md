# Der Sprachumschalter von mausemaus.com — Übergabe zum Aufhübschen

**Für:** ein Modell, das die Gestaltung und die Bewegung dieses Knopfes
besser hinbekommen soll.
**Von:** Claude (Opus 5), Stand 05.09.2026.
**Auftraggeber:** Lucas Schönwald, Video Editor & Motion Designer, Köln.

---

## 0. Worum es geht, in drei Sätzen

mausemaus.com ist Lucas' Portfolio. Es lädt standardmäßig auf Deutsch;
unten rechts sitzt ein Knopf, mit dem man auf Englisch umstellt — für
Kunden, die kein Deutsch sprechen.

Der Knopf funktioniert, und das Verhalten ist so gewollt wie unten
beschrieben. **Was fehlt, ist der letzte Schliff an der Bewegung und an der
Gestaltung.** Genau dafür ist dieses Dokument da.

Eine Warnung vorweg, damit du nicht in dieselbe Grube fällst: Die Vorlage
war ein Video auf collectui.com, von dem nur **Standbilder** vorlagen. Die
Bewegung darin — wie die Buchstaben umschlagen, wie die Unschärfe genau
läuft, welche Kurve, welche Dauer — ist meine **Interpretation aus
Einzelbildern**, nicht abgemessen. Genau da ist am meisten zu holen.

---

## 1. Wie er sich benimmt (das ist abgestimmt, bitte erhalten)

| Wann | Was passiert |
|---|---|
| beim Laden | volle Breite: Flagge + „Deutsch" |
| ~4,2 s **nach dem ersten Scrollen** | zieht sich auf die Flagge zusammen (nur noch ein Kreis) |
| Maus fährt drüber | kurzes Wackeln. **Kein** Aufklappen, **kein** Aufgehen |
| Klick | wird wieder groß **und** klappt auf |
| Auswahl offen, Klick daneben oder `Esc` | klappt zu, Uhr für das Zusammenziehen läuft neu |
| Sprache gewählt | Buchstaben im Knopf drehen sich um, ~330 ms später lädt die Seite neu |
| Klick auf „Nederlands" | Wackeln + „nog niet mogelijk :(" für 1,9 s, sonst passiert **nichts** |

Warum die lange Wartezeit: Die Zeitleiste links auf der Seite zieht sich
schon 760 ms nach Scrollbeginn zusammen. Der Sprachknopf ist aber für
jemanden da, der die Seite gar nicht lesen kann — der braucht länger, um
ihn überhaupt zu bemerken. Deshalb bewusst deutlich später.

**Niederländisch gibt es nicht.** Es steht nur im Knopf, sichtbar
zurückgenommen. Keine Spalte in der Datenbank, kein Adressparameter, nichts
im Admin. Das ist Absicht und soll so bleiben.

---

## 2. Wo das lebt

Statische Seiten auf GitHub Pages, **kein Bauwerkzeug**, kein npm, kein
Bundler. Was im Ordner liegt, wird ausgeliefert. Also: kein Sass, kein
PostCSS, kein Tailwind, keine Bibliothek von außen.

```
HOCHLADEN/
  index.html   welt.html   404.html     ← das Markup steht in allen dreien gleich
  assets/
    site.css        ← der Abschnitt "Sprachumschalter" ganz am Ende
    sprache.js      ← Abschnitt 6, "Der Umschalter"
    texte.js        ← feste Texte in beiden Sprachen
    flaggen/de.png  en.png  nl.png      ← Apple-Emoji als PNG, 160x160
```

**Alle Pfade müssen absolut sein** (`/assets/…`). Die Seite antwortet auch
unter `/welt/<slug>`, relative Pfade brechen dort.

---

## 3. Die Gestaltungsmittel der Seite

Damit der Knopf weiter dazugehört und nicht wie ein Fremdkörper wirkt:

```css
--ink:   #0D1821   /* fast schwarz, alle Schrift          */
--paper: #F0F4EF   /* der Seitengrund                     */
--sage:  #BFCC94   /* Salbeigrün, DIE Akzentfarbe         */
--muted: #6E7873   /* zurückgenommene Schrift             */
--line:  #D5D9D2   /* Konturen                            */
#FBFAF6            /* die etwas hellere Fläche für Karten */
#DCD8CC            /* Kontur der Pille                    */
--mm-kurve: cubic-bezier(.50, 0, .12, 1)   /* vom Auftraggeber festgelegt */
```

Schriften: **Tropi** (nur Überschriften, handgeschrieben),
**Manrope** (Fließtext und dieser Knopf), **Space Mono** (kleine
Großbuchstaben-Etiketten). Die Formensprache der Seite ist rund — es gibt
**nirgends** eine scharfe Ecke. Deko sind handgezeichnete Blumen in Salbei.

Der Ton der Seite ist locker und persönlich, nicht korporativ.

---

## 4. Der Code

### 4.1 Markup

Steht wörtlich so in `index.html`, `welt.html` und `404.html`.

```html
<!-- Sprachumschalter, unten rechts. Bewusst als fertiges HTML und nicht per
     Skript erzeugt: So steht er schon da, waehrend der Brief noch laedt --
     genau fuer den Besucher, der kein Deutsch liest.

     <details> statt Knopf-und-Skript: Das Auf- und Zuklappen kann der
     Browser von sich aus, und die Auswahl sind echte <a>-Links. Ohne
     JavaScript funktioniert der Umschalter also vollstaendig -- nur die
     Feinheiten (Verkleinern nach dem Scrollen, Unschaerfe, Buchstaben)
     kommen aus sprache.js dazu.

     Die beiden nicht gewaehlten Flaggen tragen loading="lazy": solange
     niemand aufklappt, holt der Browser sie gar nicht erst. -->
<details class="mm-sprache" id="mm-sprache">
  <!-- aria-label statt eines versteckten Textes: .versteckt steht in
       brief.css, und 404.html laedt die Datei nicht -- der Hinweis staende
       dort sichtbar mitten im Knopf. -->
  <summary class="mms-knopf" title="Sprache / Language" aria-label="Sprache wählen · Choose language">
    <img class="mms-flagge" id="mms-flagge" src="/assets/flaggen/de.png" alt="" width="20" height="20" decoding="async">
    <span class="mms-name" id="mms-name">Deutsch</span>
    <svg class="mms-pfeil" viewBox="0 0 12 8" aria-hidden="true" focusable="false"><path d="M1 1.6 6 6.4 11 1.6"/></svg>
  </summary>
  <div class="mms-blase">
    <div class="mms-liste">
      <a class="mms-wahl" href="/?lang=de" hreflang="de" lang="de" data-sprache="de">
        <img src="/assets/flaggen/de.png" alt="" width="20" height="20" loading="lazy" decoding="async"><span>Deutsch</span></a>
      <a class="mms-wahl" href="/?lang=en" hreflang="en" lang="en" data-sprache="en">
        <img src="/assets/flaggen/en.png" alt="" width="20" height="20" loading="lazy" decoding="async"><span>English</span></a>
      <!-- Niederlaendisch gibt es noch nicht. Bewusst trotzdem sichtbar,
           aber als <button disabled>-Ersatz: ein <a> ohne Ziel waere fuer
           die Tastatur und fuers Vorlesen eine Luege. -->
      <button class="mms-wahl mms-bald" type="button" lang="nl" data-sprache="nl" aria-disabled="true">
        <img src="/assets/flaggen/nl.png" alt="" width="20" height="20" loading="lazy" decoding="async"><span>Nederlands</span></button>
    </div>
    <p class="mms-hinweis" id="mms-hinweis" role="status" lang="nl"></p>
  </div>
</details>
<!-- Flagge und Name SOFORT auf die gewaehlte Sprache setzen, nicht erst,
     wenn das Dokument fertig geladen ist. Sonst blitzt bei einem
     englischen Aufruf kurz "Deutsch" auf -- ausgerechnet bei dem
     Besucher, fuer den der Umschalter da ist. -->
<script>window.mmUmschalterStand && window.mmUmschalterStand();</script>
```

### 4.2 CSS

Am Ende von `assets/site.css`.

```css
/* ---- Sprachumschalter ------------------------------------------------
   Sitzt fest unten rechts und bleibt beim Scrollen stehen.

   Der Ablauf, den er erzaehlt: Beim Laden steht er in voller Breite da
   (Flagge + "Deutsch"), damit ihn auch jemand bemerkt, der ihn nicht
   sucht. Erst ein paar Sekunden NACH dem ersten Scrollen zieht er sich
   auf die Flagge zusammen -- bewusst deutlich spaeter als die Zeitleiste
   links, die schon nach 760 ms zugeht. Beim Klick wird er wieder gross
   UND klappt auf; beim blossen Ueberfahren wackelt er nur kurz.

   Das Ganze ist ein <details>: Auf- und Zuklappen kann der Browser
   selbst, die Auswahl sind echte Links. Faellt sprache.js aus, bleibt ein
   vollstaendig bedienbarer Umschalter uebrig -- nur eben ohne die
   Feinheiten. */
.mm-sprache {
  position: fixed; right: 26px; bottom: 26px; z-index: 300;
  font-family: 'Manrope', system-ui, sans-serif;
}
/* Das Dreieck, das der Browser vor eine <summary> setzt, muss in BEIDEN
   Schreibweisen weg -- ohne die zweite Zeile bleibt es in Safari stehen. */
.mm-sprache > summary { list-style: none; }
.mm-sprache > summary::-webkit-details-marker { display: none; }

.mms-knopf {
  display: flex; align-items: center; gap: 9px;
  height: 42px; padding: 0 15px 0 13px;
  border-radius: 99px; cursor: pointer;
  background: rgba(251,250,246,0.94);
  -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px);
  border: 1px solid #DCD8CC;
  /* Der Schatten ist nicht Zierde: der Knopf liegt an manchen
     Scrollstaenden ueber einer Deko-Blume und braucht eine Kante. */
  box-shadow: 0 2px 10px rgba(13,24,33,.08);
  color: #0D1821; font-size: 13.5px; font-weight: 500; line-height: 1;
  white-space: nowrap; user-select: none;
  transition: padding .42s var(--mm-kurve), box-shadow .25s var(--mm-kurve),
              background .25s var(--mm-kurve), transform .25s var(--mm-kurve);
}
.mms-knopf:hover { box-shadow: 0 3px 14px rgba(13,24,33,.12); }
.mm-sprache > summary:focus-visible { outline: 2px solid #0D1821; outline-offset: 3px; border-radius: 99px; }

.mms-flagge { width: 20px; height: 20px; display: block; flex: none; }

/* Der Name faehrt seitlich ein und aus. max-width statt display:none,
   damit es eine Bewegung gibt und nicht ein Sprung. */
.mms-name {
  overflow: hidden; max-width: 9em;
  transition: max-width .42s var(--mm-kurve), opacity .26s var(--mm-kurve);
}
.mms-pfeil {
  width: 11px; height: 8px; flex: none;
  fill: none; stroke: #6E7873; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round;
  transition: transform .34s var(--mm-kurve), opacity .26s var(--mm-kurve), max-width .42s var(--mm-kurve);
  max-width: 11px;
}
.mm-sprache[open] .mms-pfeil { transform: rotate(180deg); }

/* ---- zusammengezogen: nur noch die Flagge ---- */
/* gap mit auf 0: sonst bleibt rechts von der Flagge Luft stehen, wo eben
   noch der Name war. */
.mm-sprache.mms-klein .mms-knopf { padding: 0 11px; gap: 0; }
.mm-sprache.mms-klein .mms-name,
.mm-sprache.mms-klein .mms-pfeil { max-width: 0; opacity: 0; }

/* ---- Ueberfahren: ein kurzes Wackeln, mehr nicht ----
   Ausdruecklich KEIN Aufklappen beim Hovern: wer mit der Maus nur
   vorbeifaehrt, soll nichts ausloesen. Und nicht im offenen Zustand --
   dann waere es Unruhe unter einem Menue. */
@keyframes mms-wackeln {
  0%   { transform: rotate(0deg); }
  22%  { transform: rotate(-2.6deg) translateY(-1px); }
  48%  { transform: rotate(2deg); }
  72%  { transform: rotate(-1.1deg); }
  100% { transform: rotate(0deg); }
}
.mm-sprache:not([open]) > .mms-knopf:hover { animation: mms-wackeln .62s var(--mm-kurve); }
/* Dasselbe Wackeln auf Zuruf -- fuer den Klick auf eine Sprache, die es
   noch nicht gibt. */
.mm-sprache.mms-nein > .mms-knopf { animation: mms-wackeln .62s var(--mm-kurve); }

/* ---- Die aufgeklappte Blase ---- */
.mms-blase {
  position: absolute; right: 0; bottom: calc(100% + 12px);
  /* column-REVERSE: In der Datei steht erst die Liste, dann der Hinweis --
     angezeigt gehoert der Hinweis aber DARUEBER. Unter der Liste sitzt die
     Spitze zum Knopf, da waere er im Weg. */
  display: flex; flex-direction: column-reverse; align-items: flex-end; gap: 8px;
}
/* Die kleine Spitze, die zum Knopf zeigt. Ein gedrehtes Quadrat mit
   derselben Kontur. Sie haengt an der Blase, NICHT an der Liste: die
   schneidet mit overflow:hidden ab, was ueber ihre runden Ecken
   hinausragt -- die Spitze waere dort unsichtbar. */
.mms-blase::after {
  content: ''; position: absolute; right: 24px; bottom: -5px;
  width: 9px; height: 9px; transform: rotate(45deg);
  background: rgba(251,250,246,0.97);
  border-right: 1px solid #DCD8CC; border-bottom: 1px solid #DCD8CC;
}
.mms-liste {
  display: flex; align-items: stretch;
  background: rgba(251,250,246,0.97);
  -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px);
  border: 1px solid #DCD8CC; border-radius: 99px;
  box-shadow: 0 8px 26px rgba(13,24,33,.11);
  overflow: hidden;
}
.mms-wahl {
  display: flex; align-items: center; gap: 8px;
  padding: 11px 16px; border: 0; background: transparent;
  font-family: inherit; font-size: 13.5px; line-height: 1;
  color: #6E7873; text-decoration: none; white-space: nowrap; cursor: pointer;
  transition: background .2s var(--mm-kurve), color .2s var(--mm-kurve);
}
.mms-wahl + .mms-wahl { border-left: 1px solid #EDEAE1; }
.mms-wahl img { width: 20px; height: 20px; display: block; flex: none;
  transition: filter .2s var(--mm-kurve), opacity .2s var(--mm-kurve); }
.mms-wahl:hover { background: rgba(191,204,148,.22); color: #0D1821; }
.mms-wahl:focus-visible { outline: 2px solid #0D1821; outline-offset: -2px; }
/* Die gewaehlte Sprache: kraeftiger als die uebrigen, aber nicht laut. */
.mms-wahl[aria-current="true"] {
  background: rgba(191,204,148,.34); color: #0D1821; font-weight: 600;
}
/* Noch nicht verfuegbar: sichtbar, aber erkennbar zurueckgenommen --
   auch die Flagge selbst wird blass, sonst leuchtet sie kraeftiger als
   die Sprache daneben, die es wirklich gibt. */
.mms-bald { color: #B4B3AA; }
.mms-bald img { filter: grayscale(.75); opacity: .55; }
.mms-bald:hover { background: rgba(13,24,33,.035); color: #B4B3AA; }

/* Der kurze Satz, wenn jemand Niederlaendisch antippt. */
.mms-hinweis {
  margin: 0; padding: 6px 12px; border-radius: 99px;
  background: rgba(13,24,33,.86); color: #F0F4EF;
  font-size: 12px; line-height: 1.3; white-space: nowrap;
  opacity: 0; transform: translateY(-4px);
  transition: opacity .3s var(--mm-kurve), transform .3s var(--mm-kurve);
  pointer-events: none;
}
.mms-hinweis:empty { display: none; }
.mms-hinweis.da { opacity: 1; transform: none; }

/* ---- Die Bewegung beim Auf- und Zuklappen ----
   Die Unschaerfe ist das, was die Bewegung weich macht: die Blase kommt
   nicht einfach eingeblendet, sondern faehrt scharfstellend heran. */
@keyframes mms-auf {
  from { opacity: 0; transform: translateY(10px) scale(.93); filter: blur(9px); }
  60%  { opacity: 1; }
  to   { opacity: 1; transform: none; filter: blur(0); }
}
@keyframes mms-zu {
  from { opacity: 1; transform: none; filter: blur(0); }
  to   { opacity: 0; transform: translateY(8px) scale(.95); filter: blur(7px); }
}
.mm-sprache[open] .mms-blase { animation: mms-auf .34s var(--mm-kurve) both; }
.mm-sprache.mms-schliesst .mms-blase { animation: mms-zu .22s var(--mm-kurve) both; }

/* ---- Der Namenswechsel im Knopf ----
   Beim Wechsel drehen sich die Buchstaben einzeln heraus und die neuen
   herein, leicht versetzt. sprache.js zerlegt den Namen dafuer in
   <span>s und setzt --i je Buchstabe. */
.mms-buchstabe { display: inline-block; }
@keyframes mms-buchstabe-rein {
  from { opacity: 0; transform: translateY(7px) rotate(-16deg); filter: blur(3px); }
  to   { opacity: 1; transform: none; filter: blur(0); }
}
@keyframes mms-buchstabe-raus {
  from { opacity: 1; transform: none; filter: blur(0); }
  to   { opacity: 0; transform: translateY(-7px) rotate(14deg); filter: blur(3px); }
}
.mms-rein .mms-buchstabe {
  animation: mms-buchstabe-rein .30s var(--mm-kurve) both;
  animation-delay: calc(var(--i) * 22ms);
}
.mms-raus .mms-buchstabe {
  animation: mms-buchstabe-raus .22s var(--mm-kurve) both;
  animation-delay: calc(var(--i) * 16ms);
}

/* ---- Handy ----
   Schmaler Bildschirm: die drei Sprachen untereinander statt nebeneinander.
   Nebeneinander waeren es rund 330 px -- auf einem 375-px-Geraet stiesse
   die Blase an beide Raender. */
@media (max-width: 560px) {
  .mm-sprache { right: 16px; bottom: 16px; }
  .mms-liste { flex-direction: column; border-radius: 20px; }
  .mms-wahl { padding: 12px 18px; }
  .mms-wahl + .mms-wahl { border-left: 0; border-top: 1px solid #EDEAE1; }
  .mms-blase::after { right: 22px; }
}

/* ---- "Bewegung reduzieren" ----
   Alles Zappelnde faellt weg. Was bleibt, ist ein Umschalter, der
   auf- und zugeht -- die Aussage der Bewegung, ohne die Bewegung. */
@media (prefers-reduced-motion: reduce) {
  .mms-knopf, .mms-name, .mms-pfeil, .mms-wahl, .mms-wahl img, .mms-hinweis { transition: none; }
  .mm-sprache:not([open]) > .mms-knopf:hover,
  .mm-sprache.mms-nein > .mms-knopf { animation: none; }
  .mm-sprache[open] .mms-blase,
  .mm-sprache.mms-schliesst .mms-blase { animation: none; }
  .mms-rein .mms-buchstabe, .mms-raus .mms-buchstabe { animation: none; }
}
```

### 4.3 Die Flaggen

`assets/flaggen/de.png`, `en.png`, `nl.png` — Apple-Emoji-Flaggen als PNG
mit Transparenz, 160×160, zusammen rund 16 kB. Angezeigt bei 20×20. Sie
liegen als Binärdateien im Ordner und stehen hier nicht im Text.

### 4.4 JavaScript

Abschnitt 6 aus `assets/sprache.js`. Der Ausschnitt steht **innerhalb einer
IIFE** — daher die Einrückung und das `})();` am Ende. Davor stehen in
derselben Datei Dinge, die du nicht anfassen musst, aber kennen solltest,
weil der Ausschnitt sie benutzt:

| Name | Was es ist |
|---|---|
| `sprache` | `'de'` oder `'en'`, aus `?lang=` → gemerkter Wahl → Deutsch |
| `window.mmText(schluessel)` | ein fester Text in der aktuellen Sprache, aus `assets/texte.js` |
| `scrollMerken(y)` | legt den Scrollstand für nach dem Neuladen in `sessionStorage` |
| `anwenden()` | ruft `umschalterEinrichten()` auf und tauscht die festen Texte |

`window.mmInhaltVon()` und `window.mmFeldVon()` gehören zur Übersetzung der
Inhalte aus der Datenbank und haben mit dem Knopf nichts zu tun.

```js
  /* ---------- 6. Der Umschalter ----------

     Im HTML steht ein vollstaendiges <details>: aufklappen kann der
     Browser selbst, die Auswahl sind echte Links. Alles hier ist
     Zugabe -- faellt diese Datei aus, bleibt ein bedienbarer Umschalter
     stehen, nur ohne Feinheiten. */

  const NAMEN = { de: 'Deutsch', en: 'English', nl: 'Nederlands' };

  /* Wie lange der Knopf nach dem ersten Scrollen noch in voller Breite
     stehen bleibt. Bewusst viel laenger als die Zeitleiste links (die geht
     nach 760 ms zu): Der Umschalter ist fuer jemanden da, der die Seite
     nicht lesen kann -- der braucht Zeit, ihn ueberhaupt zu bemerken. */
  const BLEIBT = 4200;
  const BLEIBT_NACH_KLICK = 2600;   // nach dem Zuklappen kuerzer
  const SCHWELLE = 100;             // ab so viel Scrollen faengt die Uhr an

  /* Flagge und Name im Knopf auf die gewaehlte Sprache setzen.

     Das ist eigene Funktion und laeuft ZWEIMAL: einmal sofort, aufgerufen
     von einer Zeile direkt hinter dem Umschalter im HTML, und noch einmal
     spaeter mit allem Uebrigen. Grund: Im HTML steht Deutsch. Wartete man
     bis DOMContentLoaded, saehe ein englischer Besucher fuer den Bruchteil
     einer Sekunde "Deutsch" aufblitzen -- ausgerechnet er. */
  let standGesetzt = false;
  window.mmUmschalterStand = function () {
    const kasten = document.querySelector('.mm-sprache');
    if (!kasten || standGesetzt) return;
    const flagge = kasten.querySelector('.mms-flagge');
    const name = kasten.querySelector('.mms-name');
    if (!flagge || !name) return;
    if (sprache !== 'de') {
      flagge.src = '/assets/flaggen/' + sprache + '.png';
      name.textContent = NAMEN[sprache];
    }
    standGesetzt = true;
  };

  function umschalterEinrichten() {
    const kasten = document.querySelector('.mm-sprache');
    if (!kasten) return;
    const knopf   = kasten.querySelector('.mms-knopf');
    const flagge  = kasten.querySelector('.mms-flagge');
    const name    = kasten.querySelector('.mms-name');
    const hinweis = kasten.querySelector('.mms-hinweis');

    const sanft = !matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ---- Stand: welche Sprache steht gerade im Knopf ----
       Normalerweise hat das die Zeile im HTML schon erledigt; hier steht
       es fuer den Fall, dass sie fehlt (z.B. eine aeltere Seite). ---- */
    window.mmUmschalterStand();
    const wahlText = window.mmText('sprache-waehlen');
    knopf?.setAttribute('title', wahlText);
    knopf?.setAttribute('aria-label', wahlText);

    /* ---- Die Auswahl: Adressen und Markierung ---- */
    kasten.querySelectorAll('.mms-wahl[href]').forEach(a => {
      const ziel = a.dataset.sprache;
      const adresse = new URL(location.href);
      adresse.searchParams.set('lang', ziel);
      a.href = adresse.pathname + adresse.search + adresse.hash;
      if (ziel === sprache) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    });

    /* ---- Zusammenziehen, aber erst spaet ---- */
    let uhr = null;
    const klein = () => { if (!kasten.open) kasten.classList.add('mms-klein'); };
    const gross = () => { clearTimeout(uhr); uhr = null; kasten.classList.remove('mms-klein'); };
    const uhrStellen = (ms) => { clearTimeout(uhr); uhr = setTimeout(klein, ms); };

    /* Auf dem Brief scrollt ein Kasten, auf einer Welt das Fenster --
       beide beobachten, statt zu raten, welcher es ist. */
    const scroller = document.getElementById('scroller');
    const stand = () => Math.max(window.scrollY,
      scroller ? scroller.scrollTop : 0);
    let gestartet = false;
    function beimScrollen() {
      if (gestartet || stand() < SCHWELLE) return;
      gestartet = true;
      uhrStellen(BLEIBT);
    }
    window.addEventListener('scroll', beimScrollen, { passive: true });
    scroller?.addEventListener('scroll', beimScrollen, { passive: true });

    /* ---- Auf- und Zuklappen ----
       <details> schaltet `open` von sich aus um. Beim SCHLIESSEN muss das
       aber warten, bis die Blase ausgeblendet ist -- sonst ist sie
       schlagartig weg und die Bewegung findet gar nicht statt. */
    let schliesstGerade = false;
    knopf?.addEventListener('click', (e) => {
      if (!kasten.open) { gross(); return; }        // Aufklappen: Browser macht es
      if (schliesstGerade) return;
      e.preventDefault();
      zuklappen();
    });

    function zuklappen() {
      if (!kasten.open || schliesstGerade) return;
      schliesstGerade = true;
      const fertig = () => {
        kasten.classList.remove('mms-schliesst');
        kasten.open = false;
        schliesstGerade = false;
        if (gestartet) uhrStellen(BLEIBT_NACH_KLICK);
      };
      if (!sanft) return fertig();
      kasten.classList.add('mms-schliesst');
      setTimeout(fertig, 220);
    }

    /* Woanders hinklicken oder Esc: zu. Ohne das bliebe die Blase offen
       stehen, waehrend man laengst weiterliest. */
    document.addEventListener('click', (e) => {
      if (kasten.open && !kasten.contains(e.target)) zuklappen();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && kasten.open) { zuklappen(); knopf?.focus(); }
    });

    /* ---- Sprache waehlen ----
       Der Wechsel laedt die Seite neu. Vorher noch kurz den Namen im Knopf
       umschreiben: die Buchstaben drehen sich heraus und die neuen herein.
       Das dauert bewusst nur einen Wimpernschlag -- laenger waere keine
       Bewegung mehr, sondern Warten. Ohne JavaScript oder mit "Bewegung
       reduzieren" fuehrt derselbe Link ohne Umweg zum Ziel. */
    kasten.querySelectorAll('.mms-wahl[href]').forEach(a => {
      a.addEventListener('click', (e) => {
        const ziel = a.dataset.sprache;
        scrollMerken(scroller && getComputedStyle(scroller).overflowY === 'auto'
          ? scroller.scrollTop : window.scrollY);
        if (!sanft || ziel === sprache || e.metaKey || e.ctrlKey || e.shiftKey) return;
        e.preventDefault();
        gross();
        if (flagge) flagge.src = '/assets/flaggen/' + ziel + '.png';
        namenWechseln(NAMEN[ziel]);
        setTimeout(() => { location.href = a.href; }, 330);
      });
    });

    function buchstaben(text) {
      return [...text].map((z, i) =>
        '<span class="mms-buchstabe" style="--i:' + i + '">' +
        (z === ' ' ? '&nbsp;' : z.replace('&', '&amp;').replace('<', '&lt;')) +
        '</span>').join('');
    }
    function namenWechseln(neu) {
      if (!name) return;
      name.innerHTML = buchstaben(name.textContent);
      name.classList.add('mms-raus');
      setTimeout(() => {
        name.classList.remove('mms-raus');
        name.innerHTML = buchstaben(neu);
        name.classList.add('mms-rein');
      }, 150);
    }

    /* ---- Niederlaendisch: noch nicht ----
       Ein kurzes Wackeln und ein Satz, der von selbst wieder geht. Kein
       Fenster, kein Wegklicken -- die Antwort auf einen Tipp, mehr nicht. */
    let hinweisUhr = null;
    kasten.querySelector('.mms-bald')?.addEventListener('click', () => {
      kasten.classList.remove('mms-nein');
      void kasten.offsetWidth;              // Neustart der Bewegung erzwingen
      kasten.classList.add('mms-nein');
      if (!hinweis) return;
      hinweis.textContent = 'nog niet mogelijk :(';
      requestAnimationFrame(() => hinweis.classList.add('da'));
      clearTimeout(hinweisUhr);
      hinweisUhr = setTimeout(() => {
        hinweis.classList.remove('da');
        setTimeout(() => { hinweis.textContent = ''; }, 320);
      }, 1900);
    });
    kasten.addEventListener('animationend', (e) => {
      if (e.animationName === 'mms-wackeln') kasten.classList.remove('mms-nein');
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', anwenden);
  else anwenden();
})();
```

---

## 5. Was NICHT kaputtgehen darf

Das sind keine Vorlieben, das sind Zusagen, die anderswo geprüft werden.

1. **Ohne JavaScript muss der Umschalter vollständig bedienbar bleiben.**
   Deshalb ist er ein `<details>` mit echten `<a>`-Links und keine
   Knopf-und-Skript-Konstruktion. Wenn du auf ein Popover-Element oder auf
   `hidden` umbaust: Der Weg ohne JS muss erhalten bleiben.
2. **`prefers-reduced-motion: reduce`** schaltet alles Zappelnde ab —
   Wackeln, Unschärfe, Buchstabenwechsel. Übrig bleibt ein Umschalter, der
   auf- und zugeht. Bitte für jede neue Bewegung mitdenken.
3. **Kein Aufklappen beim Hovern.** Ausdrücklicher Wunsch: Wer mit der Maus
   nur vorbeifährt, soll nichts auslösen.
4. **Deutsch ist der Standard.** Die Browsersprache wird bewusst nicht
   ausgewertet.
5. **Diese Namen hängen an Prüfungen** (`tests/pruefe-sprache.mjs`, 65
   Stück). Umbenennen ist erlaubt, dann aber die Prüfdatei mitziehen:
   `.mm-sprache` · `.mms-knopf` · `.mms-flagge` · `.mms-name` ·
   `.mms-blase` · `.mms-wahl` · `.mms-bald` · `.mms-hinweis` ·
   die Klasse `mms-klein`
6. **Keine externen Abhängigkeiten**, kein Bauschritt, keine Web-Schriften
   zusätzlich. Was du schreibst, muss so im Browser laufen.
7. **Flaggen bleiben PNG.** Echte Flaggen-Emoji zeigt Windows gar nicht an,
   dort stünde nur „DE".
8. Die Pille darf auf dem Handy **den Sendeknopf des Anfrageformulars nicht
   verdecken** — wird gemessen.

---

## 6. Wo ich das Potenzial sehe (ehrlich)

Der Reihe nach, wie sehr es mich stört:

1. **Der Buchstabenwechsel ist der schwächste Teil.** Aktuell: alte
   Buchstaben raus (220 ms, 16 ms Versatz), dann alle neuen rein (300 ms,
   22 ms Versatz), dazwischen ein hartes `setTimeout(150)`. Das ist ein
   Schnitt, kein Übergang. In der Vorlage sieht es aus, als würden alte und
   neue Buchstaben einander **überlappen** und dabei um die eigene Achse
   kippen — deutlich flüssiger. Zwei übereinanderliegende Ebenen statt
   eines Austauschs wären vermutlich der richtige Weg.
2. **Die Pille wechselt ihre Breite beim Sprachwechsel** („Deutsch" 133 px,
   „English" ~127 px). Das springt gerade unbewegt mit. Sollte
   mitanimieren.
3. **Das Zusammenziehen** ist eine reine `max-width`-Blende. Funktioniert,
   ist aber unelegant — der Name wird abgeschnitten statt zu weichen.
4. **Das Wackeln beim Hovern** ist eine simple Rotation. Es könnte
   physischer sein (federnd, mit leichtem Überschwingen), und vielleicht
   sollte die Flagge etwas anderes tun als die Pille.
5. **Der Aufklapp-Vorgang** ist eine einzige Keyframe-Animation auf der
   ganzen Blase. In der Vorlage wirkt es, als kämen die drei Einträge
   leicht versetzt — ein Staffeln der Kinder wäre glaubwürdiger.
6. **Die Spitze zum Knopf** ist ein gedrehtes Quadrat mit Kontur. Solide,
   aber sie animiert nicht mit.
7. **Der markierte Eintrag** ist ein Salbei-Hintergrund. In der Vorlage ist
   die Auswahl eine **weiße Karte, die in einer grauen Schiene liegt** —
   und die Karte könnte beim Wechsel von einem Eintrag zum anderen
   **gleiten**. Das wäre der auffälligste Gewinn.
8. **Der Knopf im zusammengezogenen Zustand** ist ein Kreis mit Flagge.
   Vielleicht darf er mehr Persönlichkeit haben — die Seite hat
   handgezeichnete Blumen, davon ist im Knopf nichts zu sehen.

---

## 7. Wie du prüfst, ob noch alles stimmt

Es gibt einen Server, der GitHub Pages nachbaut, und eine kopflose
Chrome-Steuerung. Kein npm install nötig.

```bash
node tests/pruefe-sprache.mjs      # 65 Prüfungen, müssen alle grün sein
```

Was dort am Knopf gemessen wird: Breite beim Laden, Abstand zu den Rändern,
Höhe (mind. 40 px Trefferfläche), das Zusammenziehen nach dem Scrollen,
das Wiedergroßwerden beim Klick, dass die Auswahl vollständig im Bild und
**über** dem Knopf steht, dass Niederländisch nichts umschaltet, und auf
520 px Breite, dass nichts das Formular verdeckt.

**Hausregel in diesem Projekt:** Jede neue Prüfung wird einmal absichtlich
gebrochen, um zu belegen, dass sie überhaupt anschlägt. Wenn du eine
hinzufügst, mach das bitte auch.

Zum Ansehen im Browser:

```bash
node tests/vorschau.mjs            # dann http://localhost:8899
```

---

## 8. Kleingedrucktes, das sonst Zeit kostet

- `<summary>` braucht `list-style: none` **und**
  `::-webkit-details-marker { display: none }` — sonst bleibt in Safari ein
  Dreieck stehen.
- Die Blase kann nicht per `overflow: hidden` an der Liste hängen und
  gleichzeitig eine Spitze nach außen zeigen. Die Spitze hängt deshalb an
  `.mms-blase`, nicht an `.mms-liste`.
- `.mms-blase` ist `column-reverse`: Im Markup steht erst die Liste, dann
  der Hinweis — angezeigt gehört der Hinweis darüber, weil unter der Liste
  die Spitze sitzt.
- Beim **Zuklappen** muss JavaScript warten, bis die Animation durch ist,
  bevor `open = false` gesetzt wird — sonst ist die Blase schlagartig weg.
- `window.mmUmschalterStand()` wird von einer Zeile **direkt hinter dem
  Markup** aufgerufen, nicht erst bei `DOMContentLoaded`. Sonst blitzt bei
  einem englischen Aufruf kurz „Deutsch" auf — ausgerechnet bei dem
  Besucher, für den der Knopf da ist.
- Die zwei nicht gewählten Flaggen tragen `loading="lazy"`: Wer nie
  aufklappt, holt sie nicht.
- Lucas kann nicht programmieren. Alles Inhaltliche muss über
  `/admin.html` änderbar bleiben; Gestaltung im Code ist in Ordnung,
  Texte gehören nicht hart hineingeschrieben (dafür `assets/texte.js`).
