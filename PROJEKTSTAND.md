# mausemaus.com — Projektstand

Stand: 21.08.2026 · Diese Datei ist die Übergabe. Sie gehört **nicht** in den Upload-Ordner.

## Was die Seite ist

Portfolio von Lucas Schönwald (Video Editor & Motion Designer, Köln).
Statische Seiten auf **Netlify**, Inhalte aus **Supabase**. Kein Bauwerkzeug, kein Git —
Änderungen gehen per Drag & Drop des Ordners `HOCHLADEN` auf die Deploys-Seite von Netlify.

**Wichtig:** Lucas kann nicht programmieren. Alles Inhaltliche muss über `/admin.html`
selbst änderbar sein. Wenn etwas nur im Code änderbar wäre, ist das ein Konstruktionsfehler.

## Adressen

| Adresse | Datei | Inhalt |
|---|---|---|
| `/` | index.html | Startseite |
| `/blog` | blog.html | Übersicht der Seiten |
| `/blog/<slug>` | beitrag.html | Einzelne Seite |
| `/admin.html` | admin.html | Verwaltung (Login nötig) |

Umgeschrieben über `_redirects`. **Alle Dateiverweise müssen absolut sein** (`/assets/…`) —
relative Pfade brechen unter `/blog/…`.

## Supabase

Projekt `mqkggwvcositmpemtqot`, Zugangsdaten in `assets/config.js` (öffentlicher Schlüssel,
das ist so vorgesehen). Zugriffsschutz über RLS: Fremde lesen nur `status = 'published'`,
Schreiben nur eingeloggt.

- **`projects`** — Kacheln/Zeilen der Startseite. Felder u.a. `role, title, summary, body,
  cover_url, cover_pos, tags[], link_url, embed_ok, more_url, is_live, status, sort_order`
- **`posts`** — eigenständige Seiten. `slug, title, subtitle, body, published_at, status`
- **`settings`** — eine Zeile mit den Inhalten der Startseite (Schlagzeile, Infozeile,
  Kundenliste, Profil, Werkzeuge, Kontakt)

## Dateien

```
index.html  blog.html  beitrag.html  admin.html  404.html  _redirects  robots.txt
favicon.svg  apple-touch-icon.png  og-bild.jpg
assets/
  fonts.css    Schriften (Tropi, Space Grotesk, Space Mono) — 171 kB
  site.css     Farben, Blumen, Detail-Fenster
  start.css    Startseite (Kopf, Laufband, Projektzeilen, Profil, Kontakt)
  blog.css     Lesetypografie, Code-Blöcke, Werkzeug-Nachbildung
  admin.css
  config.js    Supabase-Adresse und öffentlicher Schlüssel
  db.js        Laden mit Zwischenspeicher + Rückfall auf seed.js
  seed.js      Notfall-Daten (aus der Datenbank erzeugt)
  shared.js    Markdown-Renderer — von Seite UND Admin genutzt
  site.js      Detail-Fenster
  start.js     Aufbau der Startseite
  blog.js      Blogseiten
  demo-race.js Werkzeug-Nachbildung (macOS-Stil)
  admin.js     Verwaltung
```

## Markdown-Dialekt (in `shared.js`)

`## Überschrift` · `---` (Trennstrich mit Blume) · `**fett**` · `*kursiv*` · `- Liste` ·
`> Zitat` · `[Text](adresse)` · `![Text](bild.jpg){klein|mittel}` ·
YouTube-Link allein auf einer Zeile → eingebettetes Video ·
` ```sprache ` → Code-Block · `::demo kennung` → interaktive Einlage ·
`::: … :::` → Textblock mit Bildern daneben

## Offene Punkte

- **Nicht hochgeladen:** Der aktuelle Stand (Neugestaltung) liegt nur lokal.
- **Netlify-Formular:** Nach dem ersten Hochladen einmalig unter Forms die
  E-Mail-Benachrichtigung einschalten.
- **Porträtfoto und Showreel-Link** fehlen — im Admin unter „Startseite" nachtragbar.
- **Beide Seiten unter `/blog`** enthalten Platzhaltertexte, die Lucas selbst schreibt.

## Gelernte Fallstricke (nicht wiederholen)

1. **`[hidden]` wird von eigenen `display`-Regeln ausgehebelt.** Global gelöst in `site.css`.
   Trat zweimal auf (Login-Formular, Showreel-Knopf).
2. **Relative Pfade brechen unter `/blog/…`** — der Browser löst gegen `/blog/` auf.
   Immer absolut schreiben. Der Renderer korrigiert Bildpfade inzwischen selbst.
3. **Immer an den echten Adressen testen**, nicht die Datei im Wurzelverzeichnis.
   Dafür gibt es einen Netlify-Nachbau-Server (siehe unten).
4. **Chrome im Kopflos-Betrieb erzwingt ~500 px Mindestbreite** — schmalere Screenshots
   zeigen nur einen Ausschnitt und sehen nach Fehler aus.
5. **View Transitions laufen kopflos nicht** (kein Compositor). Das Detail-Fenster
   scheint dort kaputt, ist es aber nicht — mit `--force-prefers-reduced-motion` gegenprüfen.
6. **CSS-Grid: Rasterfelder schrumpfen nicht unter ihre Inhaltsbreite.** Ohne `min-width: 0`
   sprengen Eingabefelder das Raster. Trat zweimal auf.
7. **Pythons `str.replace` ersetzt ALLE Vorkommen** — beim Patchen immer mit Trefferzählung
   arbeiten, sonst werden ungewollt weitere Stellen mitgeändert.
8. **GIFs nicht durchs Canvas schicken** — sonst bleibt nur das erste Einzelbild.

## Testserver, der Netlify nachahmt

```python
# /tmp/netlify_test.py — Port 8901, bildet die _redirects-Regeln nach
import http.server, socketserver, re
WURZEL = '/Users/lucas/Desktop/Ordner/Websites/mausemausportfolio/HOCHLADEN'
class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k): super().__init__(*a, directory=WURZEL, **k)
    def translate_path(self, path):
        p = path.split('?')[0]
        if p == '/blog': p = '/blog.html'
        elif re.match(r'^/blog/[\w-]+/?$', p): p = '/beitrag.html'
        return super().translate_path(p)
    def log_message(self, *a): pass
socketserver.TCPServer.allow_reuse_address = True
socketserver.TCPServer(("", 8901), H).serve_forever()
```

Screenshots über Chrome im Kopflos-Betrieb (das Vorschau-Panel ist unzuverlässig):

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --disable-gpu --hide-scrollbars --virtual-time-budget=25000 \
  --window-size=1280,4900 --screenshot=bild.png "http://localhost:8901/"
```
