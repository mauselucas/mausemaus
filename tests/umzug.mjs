/* mausemaus — Umzug von projects/posts/settings nach seiten/bloecke.
   Additiv und mehrfach ausführbar: `projects`, `posts` und `settings`
   werden NUR gelesen. `seiten` wird per slug hochgeschrieben (Dublette
   ausgeschlossen), `bloecke` je Seite komplett neu erzeugt (erst löschen,
   dann frisch einfügen) -- so bleibt jeder Durchlauf ein exaktes Abbild
   der Quelle, ohne dass sich Blöcke vervielfachen.

   Die Zerlegung von Markdown-Rohtext in Blöcke läuft nicht hier im Skript,
   sondern über splitBlocks() aus assets/shared.js -- geladen in einem
   echten, kopflosen Chrome. Damit benutzt der Umzug exakt dieselbe
   Grammatik, die auch die öffentliche Seite beim Anzeigen (renderMarkdown()
   je Block) versteht; eine zweite, abweichende Implementierung in Node
   könnte sonst leise divergieren.

   Aufruf:
     node tests/umzug.mjs                 Quelle: die Sicherung (Trockenlauf,
                                           druckt idempotentes SQL nach stdout)
     node tests/umzug.mjs --quelle=api     Quelle: Supabase REST (braucht
                                           SB_SECRET, siehe unten)
     SB_SECRET=sb_secret_... node tests/umzug.mjs --schreiben
                                           schreibt wirklich, über die REST-
                                           Schnittstelle mit dem geheimen
                                           Schlüssel (niemals in einer Datei
                                           ablegen, nur als Umgebungsvariable)

   Voreinstellung ohne Argumente: liest aus der Sicherung (immer vorhanden,
   enthält -- anders als der öffentliche Schlüssel -- auch Entwürfe/Archiv)
   und druckt SQL statt zu schreiben, also niemals versehentlich live. */
import { readFile } from 'node:fs/promises';
import { starteChrome, oeffne } from './chrome.mjs';
import { starteServer } from './server.mjs';
import { symlinkSync, rmSync, existsSync } from 'node:fs';

const ARG = Object.fromEntries(process.argv.slice(2).map(a => {
  const [, k, v] = a.match(/^--([\w-]+)(?:=(.*))?$/) || [];
  return k ? [k, v ?? true] : [];
}).filter(Boolean));

const QUELLE = ARG.quelle || 'sicherung';
const SCHREIBEN = !!ARG.schreiben;
const SB_URL = 'https://mqkggwvcositmpemtqot.supabase.co';
const SB_SECRET = process.env.SB_SECRET || '';

const SICHERUNG = new URL(
  '../.superpowers/sdd/2026-08-22-blockeditor/sicherung/vor-umzug.json', import.meta.url).pathname;

/* ---------- 1. Quelle lesen ---------- */

async function ausSicherung() {
  const d = JSON.parse(await readFile(SICHERUNG, 'utf8'));
  return { projects: d.projects, posts: d.posts, settings: d.settings[0] };
}

async function ausApi() {
  if (!SB_SECRET) throw new Error('--quelle=api braucht SB_SECRET (Umgebungsvariable, sb_secret_…)');
  const kopf = { apikey: SB_SECRET, Authorization: `Bearer ${SB_SECRET}` };
  const holen = async (tabelle, frage = '') => {
    const r = await fetch(`${SB_URL}/rest/v1/${tabelle}?select=*${frage}`, { headers: kopf });
    if (!r.ok) throw new Error(`${tabelle}: HTTP ${r.status} ${await r.text()}`);
    return r.json();
  };
  const [projects, posts, settings] = await Promise.all([
    holen('projects', '&order=sort_order.asc'),
    holen('posts', '&order=sort_order.asc'),
    holen('settings', '&id=eq.1'),
  ]);
  return { projects, posts, settings: settings[0] };
}

/* ---------- 2. Markdown -> Blöcke, über echtes shared.js in Chrome ---------- */

async function mitSplitter(fn) {
  const feste = new URL('../HOCHLADEN/tests-feste', import.meta.url).pathname;
  if (existsSync(feste)) rmSync(feste, { recursive: true, force: true });
  symlinkSync(new URL('./feste', import.meta.url).pathname, feste, 'dir');
  const wurzel = new URL('../HOCHLADEN/', import.meta.url).pathname;
  const server = await starteServer({ wurzel, port: 8909 });
  const chrome = await starteChrome({ port: 9339 });
  const seite = await oeffne('http://127.0.0.1:8909/tests-feste/umzug-werkzeug.html', { port: 9339 });
  try {
    return await fn(async (roh) => JSON.parse(await seite.werte(
      `JSON.stringify(window.mm.splitBlocks(${JSON.stringify(roh)}))`)));
  } finally {
    await seite.zu(); chrome.beenden(); server.beenden();
    rmSync(feste, { recursive: true, force: true });
  }
}

/* ---------- 3. Zeilen -> Seiten/Blöcke ---------- */

/* Dieselbe Reihenfolge, mit der die alte Zeitleiste (brief.js) Projekten
   ihre Farbe gab: der Index unter den VERÖFFENTLICHTEN, nach sort_order
   sortierten Projekten -- Entwürfe/Archiv zählen nicht mit. */
const FARBEN = ['#3E5A78', '#8E4E9B', '#A8913F', '#6E6E7A', '#7F8F55',
                '#B5654A', '#4E7F7A', '#8A5A8E'];

const alsBlock = (b, sort) => ({
  typ: b.typ, inhalt: { roh: b.roh }, breite: 'normal', bewegung: 'keine', sort_order: sort,
});

async function bauePlan({ projects, posts, settings }, split) {
  const seiten = [];

  /* ---- Brief: eine Seite, drei Abschnitte (Hallo, Profil, Kontakt) ---- */
  {
    const e = settings || {};
    let n = 0; const weiter = () => (n += 10);
    const bloecke = [];

    bloecke.push({ typ: 'abschnitt', sort_order: weiter(), breite: 'normal', bewegung: 'keine', inhalt: {
      titel: e.hero_line1 || 'Hallo', art: 'persoenlich', farbe: null, rolle: 'hallo',
      kicker: e.hero_eyebrow || '', zusatz: e.hero_line2 || '',
    } });
    if (e.hero_intro) (await split(e.hero_intro)).forEach(b => bloecke.push(alsBlock(b, weiter())));
    (e.infos || []).forEach(i => bloecke.push({
      typ: 'randnotiz', breite: 'randnotiz', bewegung: 'keine', sort_order: weiter(),
      inhalt: { titel: i.titel || '', zeile1: i.zeile1 || '', zeile2: i.zeile2 || '', punkt: !!i.punkt },
    }));

    bloecke.push({ typ: 'abschnitt', sort_order: weiter(), breite: 'normal', bewegung: 'keine', inhalt: {
      titel: e.profil_titel || e.profil_kicker || 'Über mich', art: 'persoenlich', farbe: null,
      rolle: 'profil', kicker: e.profil_kicker || '',
    } });
    if (e.profil_text) (await split(e.profil_text)).forEach(b => bloecke.push(alsBlock(b, weiter())));
    if ((e.werkzeuge || []).length) bloecke.push({
      typ: 'text', breite: 'normal', bewegung: 'keine', sort_order: weiter(),
      inhalt: { roh: e.werkzeuge.map(w => `- **${w.name}** — ${w.stufe || ''}`.trim()).join('\n') },
    });
    if ((e.kunden || []).length) bloecke.push({
      typ: 'text', breite: 'normal', bewegung: 'keine', sort_order: weiter(),
      inhalt: { roh: e.kunden.map(k => `- ${k}`).join('\n') },
    });

    bloecke.push({ typ: 'abschnitt', sort_order: weiter(), breite: 'normal', bewegung: 'keine', inhalt: {
      titel: e.kontakt_titel || 'Schreib mir', art: 'kontakt', farbe: '#BFCC94', rolle: 'kontakt',
      email: e.email || '', telefon: e.telefon || '',
    } });
    if (e.kontakt_zusatz) (await split(e.kontakt_zusatz)).forEach(b => bloecke.push(alsBlock(b, weiter())));

    seiten.push({
      slug: 'brief', typ: 'brief', titel: e.hero_line1 || 'Brief', untertitel: e.hero_eyebrow || null,
      kunde: null, jahr: null, cover_url: null, cover_pos: '50% 50%', video_url: null, embed_ok: true,
      farbe: null, ist_aktuell: false, status: 'published', sort_order: 1, bloecke,
    });
  }

  /* ---- Projekte ---- */
  const veroeffentlicht = projects.filter(p => p.status === 'published')
    .slice().sort((a, b) => a.sort_order - b.sort_order);
  for (const p of projects) {
    const idx = veroeffentlicht.indexOf(p);
    let n = 0; const weiter = () => (n += 10);
    const bloecke = [];

    /* Nicht einbettbares Video: eigener Tür-Block, sonst ginge der Link
       (und sein Wortlaut, z. B. "Auf YouTube ansehen") beim Umbau verloren. */
    if (p.embed_ok === false && p.link_url) bloecke.push({
      typ: 'tuer', breite: 'normal', bewegung: 'keine', sort_order: weiter(),
      inhalt: { ziel: p.link_url, text: p.link_label || 'Ansehen' },
    });
    if (p.summary) (await split(p.summary)).forEach(b => bloecke.push(alsBlock(b, weiter())));
    if (p.body) (await split(p.body)).forEach(b => bloecke.push(alsBlock(b, weiter())));
    if ((p.tags || []).length) bloecke.push({
      typ: 'text', breite: 'normal', bewegung: 'keine', sort_order: weiter(),
      inhalt: { roh: p.tags.join(' · ') },
    });
    if (p.more_url) bloecke.push({
      typ: 'tuer', breite: 'normal', bewegung: 'keine', sort_order: weiter(),
      inhalt: { ziel: p.more_url, text: p.more_label || 'Mehr dazu' },
    });

    seiten.push({
      slug: p.slug, typ: 'projekt', titel: p.title, untertitel: p.role || null,
      kunde: null, jahr: null, cover_url: p.cover_url || null, cover_pos: p.cover_pos || '50% 50%',
      video_url: p.link_url || null, embed_ok: p.embed_ok !== false,
      farbe: idx === -1 ? null : FARBEN[idx % FARBEN.length],
      ist_aktuell: !!p.is_live, status: p.status, sort_order: p.sort_order, bloecke,
    });
  }

  /* ---- Welten ---- */
  for (const p of posts) {
    let n = 0; const weiter = () => (n += 10);
    const bloecke = [];
    if (p.body) (await split(p.body)).forEach(b => bloecke.push(alsBlock(b, weiter())));
    if ((p.tags || []).length) bloecke.push({
      typ: 'text', breite: 'normal', bewegung: 'keine', sort_order: weiter(),
      inhalt: { roh: p.tags.join(' · ') },
    });

    seiten.push({
      slug: p.slug, typ: 'welt', titel: p.title, untertitel: p.subtitle || null,
      kunde: null, jahr: null, cover_url: p.cover_url || null, cover_pos: p.cover_pos || '50% 50%',
      video_url: null, embed_ok: true, farbe: p.farbe || null, ist_aktuell: false,
      status: p.status, sort_order: p.sort_order, bloecke,
    });
  }

  return seiten;
}

/* ---------- 4a. Ausgabe: idempotentes SQL (Trockenlauf) ---------- */

const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const qn = (s) => (s === null || s === undefined ? 'null' : q(s));
const qb = (b) => (b ? 'true' : 'false');
const qj = (o) => `${q(JSON.stringify(o))}::jsonb`;

function alsSql(seiten) {
  const teile = [];
  seiten.forEach(s => {
    teile.push(
      `insert into public.seiten (slug, typ, titel, untertitel, kunde, jahr, cover_url, cover_pos, ` +
      `video_url, embed_ok, farbe, ist_aktuell, status, sort_order) values (` +
      `${q(s.slug)}, ${q(s.typ)}, ${q(s.titel)}, ${qn(s.untertitel)}, ${qn(s.kunde)}, ${qn(s.jahr)}, ` +
      `${qn(s.cover_url)}, ${q(s.cover_pos)}, ${qn(s.video_url)}, ${qb(s.embed_ok)}, ${qn(s.farbe)}, ` +
      `${qb(s.ist_aktuell)}, ${q(s.status)}, ${s.sort_order})\n` +
      `  on conflict (slug) do update set typ=excluded.typ, titel=excluded.titel, ` +
      `untertitel=excluded.untertitel, kunde=excluded.kunde, jahr=excluded.jahr, ` +
      `cover_url=excluded.cover_url, cover_pos=excluded.cover_pos, video_url=excluded.video_url, ` +
      `embed_ok=excluded.embed_ok, farbe=excluded.farbe, ist_aktuell=excluded.ist_aktuell, ` +
      `status=excluded.status, sort_order=excluded.sort_order;`);
    teile.push(`delete from public.bloecke where seite_id = (select id from public.seiten where slug = ${q(s.slug)});`);
    s.bloecke.forEach(b => {
      teile.push(
        `insert into public.bloecke (seite_id, typ, inhalt, breite, bewegung, sort_order) values (` +
        `(select id from public.seiten where slug = ${q(s.slug)}), ${q(b.typ)}, ${qj(b.inhalt)}, ` +
        `${q(b.breite)}, ${q(b.bewegung)}, ${b.sort_order});`);
    });
  });
  return teile.join('\n');
}

/* ---------- 4b. Ausgabe: echtes Schreiben über die REST-Schnittstelle ---------- */

async function schreiben(seiten) {
  const kopf = {
    apikey: SB_SECRET, Authorization: `Bearer ${SB_SECRET}`,
    'Content-Type': 'application/json',
  };
  for (const s of seiten) {
    const { bloecke, ...seiteOhneBloecke } = s;
    const r = await fetch(`${SB_URL}/rest/v1/seiten?on_conflict=slug`, {
      method: 'POST', headers: { ...kopf, Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify([seiteOhneBloecke]),
    });
    if (!r.ok) throw new Error(`seiten ${s.slug}: HTTP ${r.status} ${await r.text()}`);
    const [angelegt] = await r.json();

    const del = await fetch(`${SB_URL}/rest/v1/bloecke?seite_id=eq.${angelegt.id}`,
      { method: 'DELETE', headers: kopf });
    if (!del.ok) throw new Error(`bloecke löschen ${s.slug}: HTTP ${del.status} ${await del.text()}`);

    if (bloecke.length) {
      const ins = await fetch(`${SB_URL}/rest/v1/bloecke`, {
        method: 'POST', headers: kopf,
        body: JSON.stringify(bloecke.map(b => ({ ...b, seite_id: angelegt.id }))),
      });
      if (!ins.ok) throw new Error(`bloecke einfügen ${s.slug}: HTTP ${ins.status} ${await ins.text()}`);
    }
    console.error(`  ${s.slug} (${s.typ}) — ${bloecke.length} Blöcke`);
  }
}

/* ---------- Ablauf ---------- */

const quelle = QUELLE === 'api' ? await ausApi() : await ausSicherung();
console.error(`[umzug] Quelle: ${QUELLE} — ${quelle.projects.length} Projekte, ` +
  `${quelle.posts.length} Beiträge, Einstellungen ${quelle.settings ? 'geladen' : 'FEHLEN'}`);

const seiten = await mitSplitter(split => bauePlan(quelle, split));
console.error(`[umzug] ${seiten.length} Seiten geplant: ` +
  seiten.map(s => `${s.slug}(${s.bloecke.length})`).join(', '));

if (SCHREIBEN) {
  if (!SB_SECRET) { console.error('[umzug] --schreiben braucht SB_SECRET'); process.exit(1); }
  await schreiben(seiten);
  console.error('[umzug] fertig geschrieben.');
} else {
  console.log(alsSql(seiten));
  console.error('[umzug] Trockenlauf — SQL oben ausgegeben, nichts geschrieben. ' +
    'Für echtes Schreiben: SB_SECRET=… node tests/umzug.mjs --schreiben');
}
