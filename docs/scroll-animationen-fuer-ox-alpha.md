# Scroll-Animationen auf mausemaus.com — Übergabe an OX Alpha

Stand: 27.08.2026 · Branch `brief-umbau`, Commit `518c5ff` · Verfasst von Claude (Opus 5)

## Stand: GELÖST — Firefox kann keine Scroll-Animationen, jetzt gibt es einen Nachbau

**Ursache.** Lucas' Firefox 154 unterstützt `animation-timeline: view()` schlicht
nicht. Der `@supports`-Block in `bewegung.css` griff deshalb korrekt nicht, die
Seite blieb statisch — genau wie entworfen. Es war nie ein Fehler im Code.

Gemessen am 27.08.2026, `Mozilla/5.0 (Macintosh; …; rv:154.0) Firefox/154.0`:

```
CSS.supports('animation-timeline: view()')    =>  false
CSS.supports('animation-timeline: scroll()')  =>  false
CSS.supports('animation-range: entry 90px …') =>  false
```

Die Angabe „Firefox vor 144" im Kopfkommentar von `bewegung.css` war frei
erfunden und hat die Suche zwei Runden lang auf Safari-Hypothesen gelenkt. Sie
ist berichtigt und trägt jetzt Messdatum und Messverfahren. **Lehre:** Wer im
Code eine Behauptung über einen Browser aufschreibt, muss sie datieren und
sagen, womit er sie gemessen hat.

**Behebung.** Ein Polyfill (`flackr/scroll-timeline` 1.1.0) wird ausschließlich
in Engines ohne eigene Unterstützung nachgeladen. Chrome und Safari holen null
Byte und animieren unverändert rein in CSS auf dem Compositor.

**Ein Fallstrick dabei, der den naheliegenden Einbau unbrauchbar macht:** Der
Parser des Polyfills liest den Rohtext der Stylesheets und steigt dabei **weder
in `@supports` noch in `@media`** hinab. Regeln in einem At-Block erreichen ihn
nie. Vier Fassungen gegeneinander in Firefox gemessen (Deckkraft an festen
Scrollständen, `entry 60px entry 280px`):

| Fassung | Deckkraft davor → mitte → spät → fertig | wirkt? |
|---|---|---|
| A `@supports` + `@media` (der naheliegende Einbau) | 1 → 1 → 1 → 1 | **nein** |
| B nur `@media` | 1 → 1 → 1 → 1 | **nein** |
| C `html.mm-bewegung` **in** `@media` | 1 → 1 → 1 → 1 | **nein** |
| D flach, ohne At-Block | 0 → 0.591 → 0.909 → 1 | **ja** |
| E flach **mit** `html.mm-bewegung` davor | 0 → 0.591 → 0.909 → 1 | **ja** |

Deshalb gibt es dieselben Regeln zweimal: `bewegung.css` (At-Blöcke, nativ) und
`bewegung-nachbau.css` (flach, klassengesteuert, nur fürs Polyfill). Die zweite
Datei wird aus der ersten **erzeugt** (`tests/nachbau.mjs`) und von
`pruefe-nachbau.mjs` gegen sie gehalten — doppelte Wahrheit von Hand zu pflegen
wäre in diesem Projekt schon zweimal schiefgegangen.

**Die Sicherheitszusage bleibt unangetastet.** Der Nachbau greift nur, wenn
`<html>` die Klasse `mm-bewegung` trägt, und die setzt der Lader erst, wenn er
das Polyfill wirklich lädt. Kein JavaScript → keine Klasse → keine Regel →
Seite statisch und **vollständig sichtbar**. Nachgewiesen per Gegenbeweis: ohne
das Nachbau-Stylesheet steht in Firefox alles auf Deckkraft 1.

**Nachgewiesen in echtem Firefox** (`pruefe-nachbau.mjs`, 31 Prüfungen, drei
Gegenbeweise):

```
.br-titel      0.321 → 0.492 → 0.783 → 1     zurück exakt 0.492
.br-bild       0     → 0.517 → 0.750 → 1     zurück exakt 0.517
.br-text > p   0.273 → 0.591 → 0.909 → 1     zurück exakt 0.591
```

Damit hält Lucas' wörtliche Anforderung („mittendrin anhalten, zurückscrollen
dreht zurück") auch in Firefox.

Gesamtstand: **467 Prüfungen, alle grün.**

---

*Was folgt, ist der Bericht vom Vormittag — vor der Diagnose geschrieben. Er
bleibt stehen, weil §3 und §5c zeigen, wie die falsche Fährte entstand.*

## 1. Wo der Code steht

Alle Pfade relativ zum Projektordner
`/Users/lucas/Desktop/Ordner/Websites/mausemausportfolio/`.
Der Ordner `HOCHLADEN/` ist das, was auf Netlify liegt (Drag & Drop, kein Build).

### Der eigentliche Animationscode

| Datei | Rolle |
|---|---|
| **`HOCHLADEN/assets/bewegung.css`** | **Die ganze Animation.** 152 Zeilen, davon ~70 Zeilen Kommentar mit der Begründung jeder Zahl. Hier steht alles: `@supports`-Block, Selektoren, `animation-timeline`, `animation-range`, alle `@keyframes`. Es gibt keinen zweiten Ort. |

### Dateien, ohne die `bewegung.css` nicht wirken kann

| Datei | Warum sie mit hineingehört |
|---|---|
| `HOCHLADEN/index.html` (Zeile 21) | Bindet `bewegung.css` ein. Liefert die Klassen `.br-gruss .br-titel .br-kicker .br-rolle .br-text .br-bild .br-film .br-infos .br-marken .br-kunden .br-mehr .br-kontakt .br-formular` |
| `HOCHLADEN/welt.html` (Zeile 21) | dito, für die Unterseiten. Klassen `.welt-titel .welt-kicker .welt-text .welt-cover` |
| `HOCHLADEN/assets/brief.css` (Zeilen 2–27) | **Der Scroll-Container.** `.br-scroller { overflow-y:auto; height:100vh }` — die Seite scrollt *nicht* im Dokument, sondern in einem inneren Kasten. Davon hängt `view()` ab. Außerdem `.br-spalte { padding-bottom: 380px }` (siehe §4). |
| `HOCHLADEN/assets/welt.css` (Zeile 19) | `.welt-spalte { padding-bottom: 380px }` — dieselbe Rechnung |
| `HOCHLADEN/assets/blumen.css` | Die Deko-Blumen (`.mm-blume`) sind mit-animiert (`mm-blume-treiben`) |
| `HOCHLADEN/assets/blumen.js` | Erzeugt die `.mm-blume`-Elemente zur Laufzeit |
| **`HOCHLADEN/assets/bewegung-nachbau.css`** | **Erzeugt.** Dieselben Regeln flach und klassengesteuert, nur fürs Polyfill. Nicht von Hand ändern. |
| **`HOCHLADEN/assets/scroll-timeline.js`** | Das Polyfill, `flackr/scroll-timeline` 1.1.0, Apache-2.0, selbst gehostet |
| `HOCHLADEN/index.html`, `welt.html` (Kopf) | Der Lader: prüft Unterstützung und „Bewegung reduzieren“, lädt Polyfill + Nachbau, setzt `mm-bewegung` |
| `tests/nachbau.mjs` | Erzeugt `bewegung-nachbau.css` aus `bewegung.css` |
| `tests/firefox.mjs` | Firefox fernsteuern, ohne geckodriver |
| `tests/pruefe-nachbau.mjs` | 31 Prüfungen: Papierform, Chrome unverändert, Firefox wirklich animiert |
| `HOCHLADEN/assets/inhalt.js`, `bloecke.js`, `shared.js` | Bauen den Text der Welten auf. Nur relevant, falls die Selektoren (`.br-text > p` usw.) am Ende nicht auf die tatsächlich erzeugten Elemente passen. |

### Die Prüfungen

| Datei | Rolle |
|---|---|
| `tests/pruefe-scroll-bewegung.mjs` | 22 Prüfungen speziell für diese Animation, mit Gegenbeweisen |
| `tests/chrome.mjs` | Steuert Chrome übers DevTools-Protokoll, ohne Fremdbibliotheken |
| `tests/server.mjs` | Testserver, der die Netlify-`_redirects` nachbildet |

Ausführen: `node tests/pruefe-scroll-bewegung.mjs` (braucht Google Chrome unter `/Applications`).

---

## 2. Wie es programmiert ist — und warum genau so

### Lucas' Anforderung, wörtlich

> „aber dieses coole scrollen also wenn ich mitten in der animation aufhöre zu
> scrollen soll es auch stehen bleiben und wenn ich zurück scrolle soll es auch
> wieder so zurück animiert werden"

Das ist die Definition einer **scroll-getriebenen Animation**. Der Fortschritt
der Animation ist keine Funktion der Zeit, sondern des Scrollstands. Anhalten
friert ein, Zurückscrollen spielt rückwärts. Mit einer klassischen
`IntersectionObserver`-Lösung (Klasse setzen, Animation auf der Uhr abspielen)
ist das **prinzipiell nicht erreichbar** — die läuft nach dem Startschuss
selbständig weiter und kennt keinen Rückwärtsgang.

Deshalb: **CSS Scroll-driven Animations**, `animation-timeline: view()`.

```css
.br-titel {
  animation: mm-auf-titel linear both;   /* zuerst die Kurzschreibweise … */
  animation-timeline: view();            /* … danach, denn sie setzt beide zurück */
  animation-range: entry 90px entry 330px;
}
```

**Reihenfolge ist kritisch:** Die `animation`-Kurzschreibweise setzt
`animation-timeline` und `animation-range` auf ihre Vorgabewerte zurück. Beide
müssen deshalb *nach* ihr stehen. Hier tun sie das.

### Vier Entwurfsentscheidungen

**a) Alles steht in einem `@supports (animation-timeline: view())`-Block.**
Kann ein Browser keine Scroll-Animationen, gilt gar keine Regel und die Seite
ist ganz normal und vollständig da. Es gibt **bewusst keinen
JavaScript-Notnagel**: Inhalt darf nie davon abhängen, dass ein Skript ihn
wieder sichtbar macht. Eine Prüfung stellt sicher, dass außerhalb des Blocks
keine Animationsregel steht (mit Gegenbeweis).

**b) Zusätzlich `@media (prefers-reduced-motion: no-preference)`.**
Wer „Bewegung reduzieren" eingeschaltet hat, sieht alles sofort.

**c) Nur `transform`, `opacity`, `filter` werden verändert.**
Nichts verändert Höhe, Abstand oder Schriftgröße — sonst verschöbe sich beim
Scrollen das Layout, und die Zeitleiste rechnete mit falschen Abschnittshöhen
(Rückkopplung). Unschärfe (`filter`) bekommen nur Titel und Bilder, weil
`filter` nicht auf dem Compositor läuft und zwanzig gleichzeitig unscharfe
Absätze Bildrate kosten.

**d) Die Bereiche stehen in PIXELN, nicht in Prozent.**
Der naheliegende Bereich `entry 0% entry 100%` ist genau so lang, wie das
Element hoch ist: Eine 35px-Überschrift wäre nach 35px Scrollen fertig (das
schnappt), ein 315px-Bild bräuchte zehnmal so lang. Mit festen Pixellängen
scrollt man für jedes Element gleich weit.

### Die aktuellen Bereiche

| Was | `animation-range` |
|---|---|
| Titel, Kicker, Rollenzeilen | `entry 90px entry 330px` |
| Fließtext, Listen, Zitate, Kontakt, Formular | `entry 60px entry 280px` |
| Bilder, Videos, Cover | `entry 40px entry 340px` |
| Eckdaten-/Werkzeugzeilen (je Zeile eigene Achse ⇒ Staffelung ohne Verzögerungsrechnung) | `entry 40px entry 260px` |
| Kasten, Zitat | `entry 70px entry 300px` |
| Deko-Blumen (nur `transform`, treiben −76px nach oben) | `cover 0% cover 100%` |

---

## 3. Die Vorgeschichte — der erste Fehlversuch

Wichtig für OX Alpha, weil derselbe Fehler zweimal denkbar ist.

**Erste Fassung** (Commit `186094e`) stand auf `entry 0px entry 200px`.
Rechnerisch lief sie einwandfrei, alle Prüfungen grün — und Lucas' Rückmeldung
war trotzdem: „es ist nichts animiert."

Er hatte recht. `entry 0px` heißt: Die Oberkante des Elements berührt gerade
die Unterkante des Bildes. Der ganze Ablauf lag damit zwischen **100 % und
75 % der Bildhöhe** — im untersten Viertel, am Rand des Blickfelds. Alles, was
im Lesebereich ankam, war längst fertig.

Meine Prüfung hatte gemessen, **ob** sich etwas bewegt — nicht **wo auf dem
Bildschirm**. Genau das war die Lücke. Seit `518c5ff` misst
`pruefe-scroll-bewegung.mjs` an der Lage des Elements:

- im unteren Viertel (76 % von oben) muss die Einblendung noch **laufen** → gemessen 0.562
- bis zur Bildmitte (50 % von oben) muss sie **fertig** sein → gemessen 1.000
- Gegenbeweis stellt die alte Fassung wieder her und zeigt, dass sie im unteren Viertel schon bei 1.000 stand.

**Es ist möglich, dass diese Korrektur die Ursache nur verschoben hat.** Siehe §6.

---

## 4. Die Kopplung dreier Zahlen (nicht auseinanderreißen)

Ein Element ganz unten hat nur so viel Scrollweg vor sich, wie **hinter** ihm
Platz ist. Reicht der nicht für den ganzen Bereich, bliebe es für immer halb
durchsichtig stehen.

```
längster Bereich (340px)  <  Auslauf der Spalte (380px)  <  halbe Bildhöhe
```

- `340px` — `bewegung.css`, Bilder
- `380px` — `padding-bottom` in `brief.css:27` und `welt.css:19`
- die obere Grenze kommt aus `tests/pruefe-scrollen.mjs`: „hinter dem letzten
  Inhalt steht kein halber Bildschirm Leerlauf"

Wer eine der Zahlen ändert, muss die anderen mitziehen. Beide Enden sind
geprüft, jeweils mit Gegenbeweis.

---

## 5. Was ich gemessen habe — alles grün

Alle folgenden Messungen sind heute, 27.08.2026, gemacht worden.

### 5a. Prüflauf gegen den lokalen Testserver

`node tests/pruefe-scroll-bewegung.mjs` → **22 von 22 bestanden**, darunter:

```
ok  mitten im Scrollen steht er WIRKLICH mittendrin      — 0.607031
ok  …weiter sichtbar, Schritt für Schritt                — 0.357 → 0.607 → 0.857
ok  zurückscrollen spielt rückwärts, exakt derselbe Wert — hin 0.607 · zurück 0.607
ok  im unteren Viertel LÄUFT die Einblendung noch        — bei 76%: 0.562
ok  …und bis zur Bildmitte ist sie fertig                — bei 50%: 1
ok  die Bewegung verschiebt kein Layout
ok  ganz unten ist JEDES Element voll da
```

### 5b. Messung gegen die **live** ausgelieferte Seite

Headless Chrome 151 auf `https://mausemaus.com/`, 1280×900, 6 s Wartezeit:

```json
{ "supports": true, "reduced": false, "scroller": true,
  "scrollHeight": 9485, "clientHeight": 900,
  "bewegungGeladen": true, "regelnLesbar": 7,
  "animiert": ["br-gruss :: mm-auf-titel", "br-kicker :: mm-auf-titel",
               "br-punkt :: mm-auf-zeile", "mm-blume :: mm-blume-treiben", …] }
```

Stichprobe der `getComputedStyle().animationTimeline` / `.opacity`:

| Selektor | Animationen | `animation-timeline` | Deckkraft bei Scrollstand 0 |
|---|---|---|---|
| `.br-titel` | 1 | `view()` | 1 (bereits im Bild) |
| `.br-text > p` | 1 | `view()` | 1 (bereits im Bild) |
| `.br-bild` | 1 | `view()` | **0** (noch unterhalb) |
| `.br-kontakt` | 1 | `view()` | **0** (noch unterhalb) |
| `.mm-blume` | 1 | `view()` | 1 |

Keine JavaScript-Fehler auf der Seite. **Die Animationen sind live aktiv.**

### 5c. Ausgeschlossene Verdächtige

| Verdacht | Befund | Wie geprüft |
|---|---|---|
| Neuer Stand ist gar nicht hochgeladen | **Widerlegt.** Live-`index.html` und live-`bewegung.css` sind **byte-identisch** mit dem lokalen Stand (7000 Byte, `entry 90px`) | `curl` + `diff` |
| Alte CSS-Datei im Browser-Cache | **Widerlegt.** Die Cache-Nummer wechselt bei jedem Commit (`?v=1787777021 → 1787787113 → 1787801892`), und Netlify liefert `cache-control: public, max-age=0, must-revalidate` | `git show` + `curl -I` |
| „Bewegung reduzieren" im System an | **Widerlegt.** `AppleReduceMotion` und `com.apple.universalaccess reduceMotion` sind auf Lucas' Mac gar nicht gesetzt | `defaults read` |
| Browser zu alt | **Unwahrscheinlich.** Auf dem Rechner: macOS 27.0, Chrome 151, Safari 27, Firefox 154 — alle weit über den Schwellen (Chrome 115, Safari 26, Firefox 144) | `--version` / `Info.plist` |
| `bewegung.css` wird nicht geladen | **Widerlegt.** `bewegungGeladen: true`, 7 lesbare Regeln | live gemessen |
| Kurzschreibweise setzt `animation-timeline` zurück | **Widerlegt.** Reihenfolge ist korrekt; live gemessen `animationTimeline: "view()"` | live gemessen |
| JavaScript-Fehler verhindert den Seitenaufbau | **Widerlegt.** `Runtime.exceptionThrown` und `Log.entryAdded` leer | live gemessen |

---

## 6. Meine offenen Hypothesen — hier sollte OX Alpha ansetzen

Ich konnte den Fehler nicht reproduzieren. Diese vier halte ich für die
aussichtsreichsten Erklärungen, in absteigender Reihenfolge:

### H1 — Beim Laden ist korrekterweise nichts animiert

Lucas schreibt: „wenn ich die seite lade oder CMD+R drücke passiert nichts".
**Das ist Absicht und richtig so.** Alle Elemente, die beim Laden schon im
Bild stehen, haben ihren `entry`-Bereich bereits hinter sich und stehen sofort
auf Deckkraft 1 (siehe Tabelle in §5b: `.br-titel` und `.br-text > p` stehen
bei Scrollstand 0 auf 1). Eine „Einblendung beim Laden" gibt es nicht — die
war nie Teil des Auftrags, aber sie ist das Erste, was ein Nutzer erwartet.
**Möglicherweise ist genau das die ganze Beschwerde.**

### H2 — Der Bereich ist zu kurz, um bei normalem Scrolltempo wahrgenommen zu werden

Die Einblendung erstreckt sich über **280px Scrollweg** auf einer **9485px**
langen Seite. Ein einziger Trackpad-Wisch legt leicht 600–1000px zurück. Ein
Element durchläuft den gesamten Bereich damit in wenigen hundert
Millisekunden — und wer in Sprüngen scrollt (Wisch, Leertaste, Rollbalken
ziehen), sieht jedes Element bereits fertig. Der von Lucas gewünschte Effekt
(„mittendrin anhalten") setzt langsames, bewusstes Scrollen voraus.
**Prüfen: Bereiche auf 500–700px verlängern und den Auslauf (§4) mitziehen.**
Das ist meine wahrscheinlichste Ursache für „beim Scrollen kommt auch keine
Animation".

### H3 — Safari und der innere Scroll-Container

Die Seite scrollt nicht im Dokument, sondern in `.br-scroller`
(`overflow-y:auto; height:100vh`, `brief.css:3`). `view()` löst gegen den
nächsten Scrollport auf — das ist hier dieser innere Kasten, nicht das
Dokument. Ich konnte **nur Chrome** fernsteuern; Safari und Firefox habe ich
nicht messen können. Scroll-getriebene Animationen in einem *verschachtelten*
Scroll-Container sind der wahrscheinlichste Ort für einen
Browser-Unterschied. **Wenn Lucas nicht Chrome benutzt, ist das mein
Hauptverdacht.** Erste Frage an ihn: *welcher Browser?*

### H4 — `.br-rand { overflow-x: clip }` zwischen Scroller und Inhalt

`brief.css:21`. Die Paarung (`clip`, `visible`) ist bewusst gewählt, damit
kein zweiter Scrollbereich entsteht (die Begründung steht im Kommentar). Sie
liegt aber genau zwischen dem Scrollport und den animierten Elementen. In
Chrome nachweislich harmlos; in anderen Engines nicht geprüft.

### Was ich als Erstes tun würde

1. **Lucas fragen: welcher Browser, welche Version?** Das entscheidet zwischen H3 und H2.
2. Auf seinem echten Gerät in der Konsole ausführen:
   ```js
   CSS.supports('animation-timeline: view()')
   matchMedia('(prefers-reduced-motion: reduce)').matches
   document.querySelector('.br-kontakt').getAnimations().length
   getComputedStyle(document.querySelector('.br-kontakt')).animationTimeline
   ```
   Vier Zeilen, die H3/H4 sofort entscheiden.
3. Erst dann an den Zahlen drehen (H2).

---

## 7. Prüfkultur in diesem Projekt (bitte einhalten)

Jede Prüfung wird **einmal absichtlich gebrochen**, um zu zeigen, dass sie den
Fehler auch wirklich fängt („Gegenbeweis"). In
`pruefe-scroll-bewegung.mjs` gibt es vier davon:

- eine Einblendung auf der Uhr geht beim Zurückscrollen *nicht* zurück
- die erste Fassung war im unteren Viertel schon fertig
- ein zu langer Bereich lässt das Seitenende halb durchsichtig stehen
- eine Animationsregel außerhalb des `@supports`-Blocks würde erkannt

Das ist kein Zierrat: Der Fehler aus §3 kam durch, weil eine grüne Prüfung das
Falsche gemessen hat. Eine Prüfung, die man nie hat scheitern sehen, ist kein
Beweis.

Gesamtstand: **436 Prüfungen, alle grün.**
