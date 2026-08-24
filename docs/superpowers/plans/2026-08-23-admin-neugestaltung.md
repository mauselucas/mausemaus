# Admin-Neugestaltung — ruhig, aufgeräumt, wie Craft oder Notion

**Entwurf und Umsetzungsplan · 23. August 2026**

---

## Warum

Der Blockeditor funktioniert, aber er sieht nicht aus wie ein Ort, an dem man gerne schreibt.
Urteil des Auftraggebers:

> *„mir gefällt das menü zum bearbeiten noch nicht so ganz … es wirkt alles so eng und nicht
> benutzerfreundlich, so überfordernd und irgendwie auch hässlich. ich hätte es viel lieber
> clean minimalistisch und übersichtlich … so ÄHNLICH wie z.B bei craft oder notion."*

Er hat recht, und der Grund ist benennbar: **Die Oberfläche zeigt alles gleichzeitig.**
Links eine Spalte mit acht Formularfeldern, in der Mitte die Blöcke, rechts eine Vorschau —
drei Bereiche, die um Aufmerksamkeit konkurrieren, während man eigentlich nur einen Satz
schreiben will. Dazu über jedem Block dauerhaft sichtbare Bedienelemente.

Craft und Notion machen das Gegenteil: **Die Seite ist das Dokument.** Eine Spalte, viel Luft,
und alles Bedienbare erscheint erst, wenn man es braucht.

## Wer das benutzt

Eine einzige Person, die **nicht programmieren kann** und auf ihrer eigenen Seite schreiben
will. Kein Team, keine Rollen, keine Schulung. Was nicht selbsterklärend ist, wird nicht
benutzt.

---

## Die vier Entscheidungen des Auftraggebers

Diese stehen fest, sie sind keine Vorschläge:

1. **Die Schreibfläche ist die Vorschau.** Die getrennte Vorschauspalte entfällt ersatzlos.
2. **Die Seitenfelder** (Titel, Untertitel, Video-Adresse, Coverbild, „läuft aktuell" …)
   liegen nicht mehr dauerhaft links, sondern hinter **einem** Knopf.
3. **Die Anleitung** ist über ein **„?"** erreichbar, immer, beim Anlegen wie beim Bearbeiten.
4. **Der Admin muss nicht aussehen wie die Website.** Er ist Werkzeug, nicht Auftritt.

---

## Was ich darüber hinaus empfehle

Der Auftraggeber hat ausdrücklich um Vorschläge gebeten. Diese sechs würde ich dazunehmen:

### 1. Der Titel ist die erste Zeile des Dokuments, kein Formularfeld

In Craft und Notion tippt man den Titel dort, wo er später steht — groß, oben, ohne Rahmen.
Das ist der halbe Unterschied im Gefühl. Der Untertitel steht direkt darunter, kleiner und
grauer. Beide brauchen keine Beschriftung; ein Platzhaltertext („Titel", „Kurz worum es geht")
genügt.

### 2. Bedienelemente erscheinen erst bei Annäherung

Der Ziehgriff und das `⋯`-Menü eines Blocks sind **unsichtbar**, bis der Zeiger in der Nähe
ist. Sie liegen in einer schmalen Spalte **links neben** dem Text, nicht darüber. Damit
verschwinden die Kästchen, die heute jeden Block einrahmen — und der Text steht frei.

Auf Berührungsgeräten gibt es kein Annähern: Dort bleibt das `⋯` sichtbar, aber blass.

### 3. Die Einstellungen eines Blocks wandern ins `⋯`-Menü

Breite, Bewegung und die **Notiz an Claude** stehen heute in einer Zeile über jedem Block und
machen einen Absatz dreimal so hoch, wie er sein müsste. Sie gehören ins `⋯`-Menü.

**Eine Ausnahme:** Blöcke *mit* Notiz bekommen ein kleines, ruhiges Zeichen am Rand. Man muss
auf einen Blick sehen können, wo man etwas hinterlassen hat — sonst findet man seine eigenen
Notizen nicht wieder.

### 4. Der Rahmen wird stumm, der Inhalt bekommt die Stimme

Heute steht die Marke in Tropi oben, es gibt gerundete Knöpfe, Schattierungen und Grün —
dieselbe Gestaltung wie auf der Website. Im Editor konkurriert das mit dem Text.

**Vorschlag:** Der Rahmen (Kopfzeile, Knöpfe, Menüs) benutzt die Systemschrift, ein
zurückhaltendes Grau und **eine** Akzentfarbe. Die Schriften und Farben der Website gelten
**nur innerhalb der Schreibfläche** — dort sind sie ja die Vorschau. So sieht man beim
Schreiben, wie es später aussieht, und der Rest tritt zurück.

**Kein dunkles Thema.** Die Inhalte sind hell; ein dunkler Rahmen darum flackert bei jedem
Blickwechsel. Ruhiges Fast-Weiß ist die richtige Antwort.

### 5. Eine Spalte, echte Ränder

Die Schreibfläche wird auf etwa 720 px begrenzt und mittig gestellt, mit großzügigem Rand.
Das ist keine Verschwendung: Zeilen über ~90 Zeichen liest niemand gern, und die Ruhe kommt
genau von diesem Weißraum.

### 6. Der Speicherzustand steht klein und unaufgeregt

Kein blinkender Hinweis. Ein kleines „gespeichert" beziehungsweise „speichert …" in der
Kopfzeile, mehr nicht. Wer speichern nicht merkt, vertraut ihm am meisten.

---

## Die eine echte Entscheidung: wie weit geht „die Fläche ist die Vorschau"?

Das ist der Kern und die einzige riskante Stelle. Es gibt zwei Auslegungen, und sie
unterscheiden sich stark im Aufwand und in der Fehleranfälligkeit.

### Weg A — „lebendiger Text" *(Empfehlung)*

Die Blöcke bleiben Textfelder, aber sie **sehen aus wie das Ergebnis**: richtige Schrift,
richtige Größe, richtige Zeilenhöhe, richtige Breite. Bilder, Videos, Trenner und die
Werkzeug-Nachbildung werden **fertig dargestellt** statt als Rohtext. Nur die
Auszeichnung *im Fließtext* (fett, kursiv, Links, Türchen) bleibt als Zeichen sichtbar —
oder wird beim Markieren über eine kleine Leiste gesetzt.

- **Dafür:** Der Rohtext bleibt die Wahrheit. Kein Datenverlust beim Hin- und Herwandeln.
  Einfügen aus anderen Programmen kann nichts zerstören. Der bestehende Beweis, dass beim
  Umzug nichts verlorenging, bleibt gültig.
- **Dagegen:** Fett sieht man beim Tippen nicht sofort fett, sondern als `**fett**`.

### Weg B — echtes WYSIWYG mit `contenteditable`

Man tippt direkt in dargestelltes HTML; fett ist fett, während man schreibt.

- **Dafür:** Fühlt sich am nächsten an Notion an.
- **Dagegen:** Der Text muss bei jeder Änderung aus HTML zurück in den Rohtext gewandelt
  werden. **Genau daran scheitern selbstgebaute Editoren.** Einfügen aus Word oder aus dem
  Browser schleppt fremdes HTML ein, der Cursor springt beim Neuzeichnen, Rückgängig wird
  unzuverlässig — und im schlimmsten Fall wandelt die Rückwandlung Text kaputt, den niemand
  mehr wiederherstellen kann.

**Empfehlung: Weg A, mit einem Zusatz.** Fett und kursiv werden im Textfeld **eingefärbt und
mitgezeichnet** (die Sterne bleiben sichtbar, aber der Text dazwischen ist wirklich fett) —
das gibt 80 % des Gefühls bei 10 % des Risikos. Craft macht es im Kern genauso.

Wer Weg B will, sollte es wissentlich tun: Dann braucht es eine deutlich strengere Absicherung
gegen Textverlust als alles, was heute existiert.

---

## Aufbau der neuen Oberfläche

**Ebene 1 — Übersicht.** Eine ruhige Liste aller Seiten. Titel, kleine Notiz zum Zustand,
Vorschaubild klein. Ein Knopf `+ Neue Seite`. Sonst nichts.

**Ebene 2 — Die Seite.** Eine Spalte:

```
┌──────────────────────────────────────────────┐
│  ←  Zurück            gespeichert   ⚙   ?  ⋮ │   ← stumme Kopfzeile
├──────────────────────────────────────────────┤
│                                              │
│         Bastian Keller & Bitbull             │   ← Titel = erste Zeile
│         Freelance Video Editor …             │   ← Untertitel
│                                              │
│    ⠿ ⋯  Schnitt, Motion Graphics und …       │   ← Griff nur bei Annäherung
│                                              │
│         Ich arbeite derzeit als freier …     │
│                                              │
│         [ Bild fertig dargestellt ]          │
│                                              │
│         ✳ ── Trenner ── ✳                    │
│                                              │
│         +  (Block einfügen)                  │
└──────────────────────────────────────────────┘
```

**Ebene 3 — Nur auf Zuruf:**

- `⚙` **Seiteneinstellungen** — schiebt von rechts herein: Video-Adresse, Coverbild,
  „läuft aktuell", „darf eingebettet werden", Kennung, Farbe der Welt, Veröffentlichen,
  Archivieren. Alles, was heute links dauerhaft steht.
- `?` **Anleitung** — schiebt ebenfalls herein. Immer erreichbar.
- `⋯` **am Block** — Breite, Bewegung, Notiz an Claude, Duplizieren, Löschen.
- `/` **im leeren Block** — Blockauswahl, wie schon heute.

---

## Was auf keinen Fall verlorengehen darf

Der Editor ist neu, die Grundlagen bleiben:

- **Automatisches Speichern** samt der Warteschlange, die verhindert, dass sich zwei
  Änderungen gegenseitig überschreiben. **Und die kürzlich behobene Falle:** Beim Verlassen
  der Seite muss eine noch nicht geschriebene Änderung zuerst gespeichert werden.
- **Bild-Upload** mit Verkleinerung, **GIFs und bewegte Bilder unverkleinert**, Bildausschnitt.
- **Die Notiz an Claude** — sie ist dem Auftraggeber wichtig und darf **niemals** öffentlich
  ausgeliefert werden. Die Datenbankspalte ist dafür gesperrt; das muss so bleiben.
- **Ziehen zum Umsortieren.**
- **Sicherung aller Tabellen.**
- **Die Anmeldung.**

---

## Absicherung

Es gibt heute **284 Prüfungen in 14 Bereichen**, davon sieben, die den Admin betreffen.
**Sie müssen weiter bestehen.** Wo eine Prüfung an einer Kennung hängt, die es nach dem Umbau
nicht mehr gibt, wird die Prüfung auf das neue Element umgezogen — **nicht gelöscht** und
nicht abgeschwächt.

Dazu die Regel, die sich in diesem Projekt bewährt hat, weil sie sechs blinde Prüfungen
aufgedeckt hat:

> **Jede Prüfung muss man einmal absichtlich brechen können.** Wer eine Absicherung baut,
> entfernt sie testweise wieder und zeigt, dass die Prüfung fällt. Ohne diesen Nachweis gilt
> eine Prüfung als nicht vorhanden.

Und für diesen Umbau besonders:

- **Nach jedem Schritt eine Seite anlegen, füllen, speichern, neu laden** — und nachsehen, dass
  alles unverändert da ist.
- **Vor dem ersten Schreibzugriff eine vollständige Sicherung ziehen.**
- Der Editor braucht eine Anmeldung. Wer kein Passwort hat, prüft die Bausteine einzeln —
  so machen es die vorhandenen Prüfdateien.

---

## Vorgehen

| Schritt | Ergebnis |
|---|---|
| 1 | Rahmen und Ebenen: stumme Kopfzeile, eine Spalte, `⚙`- und `?`-Bereiche. Blöcke noch wie bisher. |
| 2 | Titel und Untertitel als erste Zeilen des Dokuments; Seitenfelder wandern nach `⚙`. |
| 3 | Blöcke ohne Rahmen: Griff und `⋯` erst bei Annäherung, Einstellungen ins `⋯`-Menü, Notiz-Zeichen am Rand. |
| 4 | Die Schreibfläche wird zur Vorschau (Weg A): Bilder, Videos, Trenner, Nachbildung fertig dargestellt; fett und kursiv mitgezeichnet. |
| 5 | Feinschliff: Abstände, Anfasser, Tastaturwege, Handy ab 520 px. |

Abnahme durch den Auftraggeber nach Schritt 3 — dann ist die Ruhe schon spürbar, und ein
Kurswechsel kostet noch wenig.

## Offen

- **Weg A oder Weg B** — Empfehlung steht oben, die Entscheidung trifft der Auftraggeber.
- Ob die Übersicht Vorschaubilder behält oder eine reine Textliste wird.
- Ob es einen Vollbildmodus zum Schreiben geben soll.
