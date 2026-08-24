# Die lebendige Seite — Umsetzungsplan (Plan 3, der letzte)

> **Für ausführende Agenten:** ERFORDERLICHE UNTERFÄHIGKEIT: `superpowers:subagent-driven-development`.
> Schritte benutzen Kästchen (`- [ ]`) zur Nachverfolgung.

**Ziel:** Die Seite bekommt das, was sie von einer ordentlichen Seite zu *seiner* Seite macht —
die Spielereien, die Lucas sich gewünscht hat. Danach ist am Code nichts mehr offen.

**Was schon steht:** Plan 1 (der Brief, die Zeitleiste, die Türchen, die Welten, das Handy)
und Plan 2 (das Datenmodell, der Blockeditor, die Anleitung). 245 Prüfungen über 13 Bereiche.

**Werkzeuge:** unverändert — HTML, CSS, JavaScript ohne Bibliotheken, Supabase, Netlify,
Node 25 nur für die Prüfungen.

---

## Wie dieser Plan geschrieben ist

Wie Plan 2: **Verträge und Abnahmekriterien, kein fertiger Code.** Der Umsetzer schreibt
Umsetzung und Prüfungen selbst. Das hat sich bewährt — in Plan 1 stammten fast alle
Verzögerungen aus Fehlern in meinem vorgeschriebenen Code, darunter sechs Prüfungen, die
gar nicht fehlschlagen konnten.

Was aus beiden Plänen bleibt:

- **Jede Prüfung muss man einmal absichtlich brechen können.** Ohne diesen Nachweis gilt sie
  als nicht vorhanden.
- **Anhalten und fragen ist erwünscht**, sobald etwas widersprüchlich wirkt.
- **Code, den nichts erreichen kann, wird entfernt, nicht kommentiert.**

---

## Die eine Regel, die über allem steht

> **Keine Bewegung darf jemals Inhalt verstecken.**

Jedes bewegte Element **beginnt sichtbar** und wird erst dann kurz ausgeblendet, wenn die
Bewegung nachweislich eingerichtet ist. Bricht ein Skript ab, lädt eine Datei nicht, ist
JavaScript aus — dann steht der Text eben still da, aber er steht da.

Das ist keine Vorsichtsmaßnahme auf Verdacht: Bei einer Portfolio-Seite entscheidet ein
Auftraggeber in Sekunden. Eine Seite, die wegen einer Animation leer bleibt, kostet einen Job.

Dieselbe Regel gilt für `prefers-reduced-motion`: **doppelt absichern**, einmal im
JavaScript und einmal als Sicherheitsnetz im CSS.

---

## Globale Vorgaben

Es gelten die Vorgaben aus `2026-08-22-blockeditor.md` unverändert weiter. Kurz die
wichtigsten:

- Kein `sb_secret_…` unter `HOCHLADEN/`. Nichts aus `tests/` in `HOCHLADEN/`.
- Alle Pfade absolut. Farben, Schriften und die Bewegungskurve aus `site.css`
  (`--mm-kurve`), nirgends erneut fest hingeschrieben.
- **Die 13 bestehenden Prüfbereiche müssen durchgehend bestehen. Ändere sie nicht** —
  wenn eine fällt, ist etwas kaputt.
- Handy ab 520 px prüfen. Kommentare und Bezeichner auf Deutsch.
- Nach jeder Aufgabe festschreiben.

---

## Aufgabe 1: Der erste Eindruck

**Vertrag — der Brief wird geschrieben, nicht eingeblendet**

Beim allerersten Besuch baut sich der Einstieg auf, als würde jemand ihn gerade schreiben:
erst der Name in Tropi, dann setzt der Text ein. Danach läuft alles normal.

**Nur beim ersten Besuch.** Beim vierten Mal ist genau das die Animation, die man hasst —
der Browser merkt sich das. Ein Besucher, der zurückkommt, sieht die Seite sofort.

**Vertrag — der erste Satz kennt die Tageszeit**

Drei bis fünf Varianten, **von Lucas im Editor pflegbar**, nicht im Code. Nachts um zwei
steht etwas anderes da als Dienstag früh. Fehlt eine passende Variante, steht der normale
Einstieg da — kein leerer Platz.

**Vertrag — beim zweiten Besuch ein anderer Einstieg**

„Schön, dass du nochmal da bist." Ebenfalls im Editor pflegbar.

**Abnahme**

- Erster Besuch: Animation läuft. Zweiter Besuch: läuft nicht, Seite steht sofort.
- Mit `prefers-reduced-motion` läuft sie nie.
- **Mit abgeschaltetem JavaScript ist der Text trotzdem da.** Nachzuweisen.
- Ohne gepflegte Varianten verhält sich die Seite wie heute.

---

## Aufgabe 2: Kleine Freuden

**Vertrag — der Dackel läuft durchs Bild**

Selten und zufällig, unten durch, nicht bei jedem Besuch. Er darf nichts überdecken, nichts
anklickbar machen und den Lesefluss nicht stören. Bei `prefers-reduced-motion` bleibt er weg.

Warum selten: Ein Dackel, der jedes Mal kommt, ist Deko. Einer, der manchmal kommt, ist eine
Überraschung — und genau das war der Wunsch.

**Vertrag — der Farbwechsel schwappt herein**

Der Übergang vom Brief in eine Welt ist kein harter Seitenwechsel, sondern die Farbe der Welt
läuft herein. Man merkt: Ich betrete eine andere Welt, nicht eine andere Seite.

**Vertrag — besuchte Türchen nachschärfen**

Das gibt es schon; hier nur prüfen, ob es sich im Alltag richtig anfühlt, und die Merkung
robust machen (privater Modus, gesperrte Cookies → dann eben ohne Merkung, aber ohne Fehler).

**Abnahme**

- Der Dackel erscheint nicht bei jedem Laden, aber nachweislich manchmal.
- Er überdeckt keinen Text und fängt keine Klicks ab.
- Der Farbübergang funktioniert in beide Richtungen und auch bei dunklen Welten.

---

## Aufgabe 3: Bewegung abschaltbar, dann aufräumen

**Vertrag — ein sichtbarer Schalter**

Die Systemeinstellung „Bewegung reduzieren" wird längst respektiert. Dazu kommt ein
**sichtbarer Schalter** auf der Seite, unaufdringlich platziert, dessen Wahl gemerkt wird.

Das ist kein Kürprogramm. Bei einer Seite mit so viel Bewegung ist es Anstand: Manchen
Menschen wird davon schlecht, und nicht jeder kennt die Systemeinstellung.

**Vertrag — Aufräumen, aber erst auf Zuruf**

Die alten Tabellen `projects`, `posts` und `settings` stehen noch. Sie sind der einzige
Rückweg, und **das Löschen ist der einzige unumkehrbare Schritt im ganzen Vorhaben.**

**Dieser Schritt wird erst ausgeführt, wenn Lucas ausdrücklich zustimmt** — nachdem er den
Editor eine Weile benutzt hat und zufrieden ist. Vorher: nur eine Sicherung ziehen und
vorbereiten.

Dazu gehört dann auch: `mmLoadSettings` und `SEED_SETTINGS` entfernen, sofern wirklich
nichts mehr liest, und `tests/pruefe-umzug.mjs` auf die eingefrorene Sicherung umstellen,
statt gegen die dann gelöschten Tabellen zu vergleichen — damit der Beweis erhalten bleibt.

**Abnahme**

- Der Schalter wirkt sofort und überlebt das Neuladen.
- Bei abgeschalteter Bewegung ist **alles** still: Startanimation, Dackel, Farbwechsel,
  Zeitleiste, Blockbewegungen.
- Alle 13 Prüfbereiche bestehen weiter.

---

## Vorgehen

| Aufgabe | Prüfung |
|---|---|
| 1 — Erster Eindruck | Selbstprüfung, danach prüfe ich selbst nach |
| 2 — Kleine Freuden | Selbstprüfung, danach prüfe ich selbst nach |
| 3 — Schalter, Aufräumen | Selbstprüfung; das Aufräumen erst nach Lucas' Zustimmung |

Kein eigener Prüfer: Hier stehen keine Inhalte auf dem Spiel, nur Bewegung. Sichtprüfung
zählt mehr als Messwerte — **Bilder ansehen, nicht nur Zahlen abhaken.**

Abnahme durch Lucas nach Aufgabe 2, weil dann alles Sichtbare steht.

## Offene Punkte, die nicht Code sind

- Die verbindende Erzählung im Brief schreibt Lucas selbst.
- Die beiden Welt-Texte ebenso.
- Porträtfoto und Showreel fehlen weiterhin.
- Die Tageszeit- und Wiederkehr-Varianten schreibt Lucas im Editor.
