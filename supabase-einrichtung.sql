-- ============================================================
--  mausemaus.com — Einrichtung der Datenbank
--
--  Einmal komplett markieren, in den Supabase SQL Editor einfuegen
--  und auf "Run" klicken. Mehrfaches Ausfuehren ist ungefaehrlich.
--
--  ACHTUNG: Diese Datei beschreibt den Stand SEIT dem Umbau auf den
--  Brief -- zwei Tabellen, `seiten` und `bloecke`. Die fruehere Fassung
--  legte `projects`, `posts` und `settings` an; die gibt es in der
--  laufenden Datenbank zwar noch, aber die Seite liest sie nicht mehr.
--  Sie sind hier bewusst NICHT aufgefuehrt, damit ein Neuaufbau nicht
--  aus Versehen das alte Modell mitschleppt.
-- ============================================================

-- ---------- 1. Eine Seite ----------
-- typ='brief'   die eine Startseite (slug='brief')
-- typ='projekt' ein Abschnitt in der Zeitleiste des Briefs
-- typ='welt'    eine eigene Seite hinter einem Tuerchen (/welt/<slug>)
create table if not exists public.seiten (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  typ         text not null check (typ in ('brief','projekt','welt')),
  titel       text not null default '',
  untertitel  text,
  kunde       text,
  jahr        text,
  cover_url   text,
  cover_pos   text default '50% 50%',
  video_url   text,
  embed_ok    boolean default true,
  farbe       text,
  ist_aktuell boolean default false,
  status      text not null default 'draft'
              check (status in ('draft','published','archived')),
  -- FLIESSKOMMA, nicht integer: beim Umsortieren wird der neue Wert als
  -- Mittelwert der beiden Nachbarn berechnet (zwischen 100 und 200 liegt
  -- 150, dann 125, dann 112.5). So ist immer genau EINE Zeile zu
  -- schreiben statt die ganze Liste neu durchzunummerieren. Mit einem
  -- Integer geht das nach wenigen Verschiebungen nicht mehr auf.
  sort_order  double precision default 1000,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ---------- 2. Die Bloecke einer Seite ----------
create table if not exists public.bloecke (
  id         uuid primary key default gen_random_uuid(),
  seite_id   uuid not null references public.seiten(id) on delete cascade,
  typ        text not null check (typ in (
               'text','ueberschrift','randnotiz','bild','gif','video',
               'text_mit_bild','code','werkzeug','trenner','tuer','abschnitt',
               'kasten','zitat')),
  inhalt     jsonb not null default '{}',
  breite     text not null default 'normal'
             check (breite in ('schmal','normal','randnotiz','voll')),
  -- Vestigial: Das Auswahlfeld dazu gibt es nicht mehr. Es war eine
  -- Fehlkonstruktion -- Lucas haette an JEDEM Block einstellen sollen, wie
  -- er sich einblendet, und wollte das natuerlich nie tun. Ersetzt durch
  -- eine Regel fuer die ganze Seite (assets/bewegung.css). Die Spalte bleibt
  -- unangetastet: alte Werte wirken einfach nicht mehr, es gab nichts
  -- nachzupflegen. Die Lehre: Eine Einstellung, die man bei jedem Element
  -- treffen muesste, ist keine Einstellung, sondern eine Entscheidung, die
  -- der Bauende treffen sollte.
  bewegung   text not null default 'keine',
  notiz      text,                          -- PRIVAT, siehe Abschnitt 4
  sort_order double precision default 1000,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists bloecke_seite_idx on public.bloecke (seite_id, sort_order);
create index if not exists seiten_typ_idx    on public.seiten  (typ, status, sort_order);

-- ---------- 3. Zugriffsregeln ----------
alter table public.seiten  enable row level security;
alter table public.bloecke enable row level security;

drop policy if exists "eingeloggt darf alles" on public.seiten;
create policy "eingeloggt darf alles" on public.seiten
  for all to authenticated using (true) with check (true);

drop policy if exists "oeffentlich liest veroeffentlichte" on public.seiten;
create policy "oeffentlich liest veroeffentlichte" on public.seiten
  for select to anon using (status = 'published');

drop policy if exists "eingeloggt darf alles" on public.bloecke;
create policy "eingeloggt darf alles" on public.bloecke
  for all to authenticated using (true) with check (true);

drop policy if exists "oeffentlich liest bloecke veroeffentlichter seiten" on public.bloecke;
create policy "oeffentlich liest bloecke veroeffentlichter seiten" on public.bloecke
  for select to anon
  using (exists (select 1 from public.seiten s
                 where s.id = bloecke.seite_id and s.status = 'published'));

-- ---------- 4. Die private Spalte `notiz` ----------
--
-- HIER LAG EIN ECHTES LECK, und der Irrtum ist lehrreich genug, um ihn
-- aufzuschreiben:
--
--     Ein REVOKE auf eine EINZELNE Spalte hebt ein tabellenweites GRANT
--     nicht auf.
--
-- Es geht nur andersherum: das Recht komplett entziehen, dann die
-- erlaubten Spalten einzeln vergeben. `notiz` fehlt in der Liste -- das
-- ist Absicht, nicht Vergesslichkeit.
revoke select on public.bloecke from anon;
grant select (id, seite_id, typ, inhalt, breite, bewegung, sort_order,
              created_at, updated_at) on public.bloecke to anon;

-- Fremde brauchen ueberhaupt kein Schreibrecht. Ohne diese Zeile ist es
-- zwar wirkungslos (RLS und GRANT muessen BEIDE zustimmen), aber es ist
-- unnoetiger Sprengstoff fuer den Tag, an dem jemand eine grosszuegige
-- Regel ergaenzt.
revoke insert, update, delete on public.seiten, public.bloecke from anon;

-- NACHWEISEN, NICHT GLAUBEN. Aus dem Browser, mit dem oeffentlichen
-- Schluessel -- das muss 401 oder 403 liefern, nicht etwa Daten:
--
--   fetch(URL + '/rest/v1/bloecke?select=notiz&limit=5',
--         { headers: { apikey: OEFFENTLICHER_SCHLUESSEL } })
--
-- Genau darauf verlaesst sich auch assets/db.js: die Spaltenliste dort
-- ist Teil des Vertrags, nicht Zierde. Ein select=* auf den eingebetteten
-- Bloecken wuerde mit einem Rechtefehler scheitern.

-- ---------- 5. Dateiablage ----------
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

drop policy if exists "media oeffentlich lesbar" on storage.objects;
create policy "media oeffentlich lesbar" on storage.objects
  for select to anon using (bucket_id = 'media');

drop policy if exists "media schreiben nur angemeldet" on storage.objects;
create policy "media schreiben nur angemeldet" on storage.objects
  for insert to authenticated with check (bucket_id = 'media');
