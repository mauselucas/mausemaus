-- ============================================================
--  mausemaus.com — Einrichtung der Datenbank
--  Einmal komplett markieren, in den Supabase SQL Editor
--  einfügen und auf "Run" klicken. Fertig.
--  Mehrfaches Ausführen ist ungefährlich.
-- ============================================================

-- ---------- 1. Tabelle für die Projekte ----------
create table if not exists public.projects (
  id           uuid primary key default gen_random_uuid(),
  slug         text unique not null,          -- für die URL, z.B. bastian-keller
  title        text not null,
  role         text    default '',            -- "Editor & Motion · Joyn"
  summary      text    default '',            -- Kurztext auf der Kachel
  body         text    default '',            -- Langtext im Fenster (Markdown)
  cover_url    text,
  cover_pos    text    default '50% 50%',     -- Bildausschnitt im Rahmen
  tags         text[]  default '{}',
  link_url     text,
  link_label   text    default 'Ansehen',
  embed_ok     boolean default true,          -- aus, wenn der Rechteinhaber das Einbetten sperrt
  ig_handle    text,                          -- gesetzt = Instagram-Panel statt Coverbild
  ig_followers text,
  is_live      boolean default false,         -- zeigt "Läuft aktuell"
  accent       text    default 'sky',         -- sky | sage | navy | ink
  status       text    not null default 'draft'
               check (status in ('draft','published','archived')),
  sort_order   double precision default 1000, -- Kommazahl: Einsortieren ohne Neu-Nummerieren
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

create index if not exists projects_status_sort_idx
  on public.projects (status, sort_order);

-- updated_at automatisch mitpflegen
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists projects_touch on public.projects;
create trigger projects_touch before update on public.projects
  for each row execute function public.touch_updated_at();

-- ---------- 2. Zugriffsregeln ----------
-- Fremde dürfen NUR veröffentlichte Projekte lesen.
-- Entwürfe, Archiviertes und jedes Schreiben: nur eingeloggt.
alter table public.projects enable row level security;

drop policy if exists "oeffentlich liest veroeffentlichte" on public.projects;
create policy "oeffentlich liest veroeffentlichte" on public.projects
  for select to anon
  using (status = 'published');

drop policy if exists "eingeloggt darf alles" on public.projects;
create policy "eingeloggt darf alles" on public.projects
  for all to authenticated
  using (true) with check (true);

-- ---------- 3. Datei-Speicher für Bilder und Videos ----------
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do update set public = true;

drop policy if exists "medien oeffentlich lesbar" on storage.objects;
create policy "medien oeffentlich lesbar" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'media');

drop policy if exists "medien schreiben nur eingeloggt" on storage.objects;
create policy "medien schreiben nur eingeloggt" on storage.objects
  for all to authenticated
  using (bucket_id = 'media') with check (bucket_id = 'media');

-- ---------- 4. Deine 5 bestehenden Projekte übernehmen ----------
insert into public.projects
  (slug, title, role, summary, body, cover_url, cover_pos, tags,
   link_url, link_label, embed_ok, ig_handle, ig_followers,
   is_live, accent, status, sort_order)
values
  ('bastian-keller', 'Bastian Keller — Bitbull Trading', 'Social Media Management · Instagram', 'Verantwortlich für den kompletten Instagram-Auftritt: Planung, Schnitt, Motion, Grafik und Posting.', 'Ich verantworte den kompletten Instagram-Auftritt von Bastian Keller (Bitbull Trading) — von der Content-Planung über Schnitt und Motion der Reels bis zu Grafiken und dem Posting. Vom Konzept bis zum fertigen Beitrag läuft alles über mich.

Das ist eine **laufende Zusammenarbeit**, der Feed wächst also weiter.', 'bastian.jpg', '50% 50%', array['Social Media','Schnitt','Motion Design','Grafik']::text[], 'https://www.instagram.com/bastiankeller.bitbull/', 'Zum Profil', true, 'bastiankeller.bitbull', '35,8 Tsd. Follower', true, 'ink', 'published', 1),
  ('the-race-staffel-3', 'The Race — Staffel 3', 'Editor & Motion · 33minutes / Joyn', 'Roh- und Feinschnitt der Hauptserie und der Wildcard Challenge, dazu die Motion Graphics.', 'Roh- und Feinschnitt der Hauptserie und der Wildcard Challenge in DaVinci Resolve, dazu die Motion Graphics in After Effects. Ausgestrahlt auf Joyn und YouTube.

---

https://youtu.be/9heEm1CBVgs?si=-0u4Uqfum7vmd4cS', 'therace.jpg', '50% 50%', array['Schnitt','Motion Design']::text[], 'https://youtu.be/9heEm1CBVgs?si=-0u4Uqfum7vmd4cS', 'Auf YouTube ansehen', false, null, null, false, 'sky', 'published', 2),
  ('jules', 'Jules', 'Editor · YouTube', 'Mitarbeit am Schnitt reichweitenstarker Videos auf Haupt- und Zweitkanal (1,1 Mio+ Abos).', 'Mitarbeit am Schnitt reichweitenstarker Videos auf Haupt- und Zweitkanal (1,1 Mio+ Abos) — unter anderem mit 2,4 Mio und 1,5 Mio Aufrufen, bei engen Upload-Zyklen.

---

https://youtu.be/uWkpyFr9e9Y?si=spBmWQ5Scv4UxpQ2', 'walmart.jpg', '50% 30%', array['Schnitt']::text[], 'https://youtu.be/uWkpyFr9e9Y?si=spBmWQ5Scv4UxpQ2', 'Auf YouTube ansehen', true, null, null, false, 'navy', 'published', 3),
  ('simplicissimus-fern', 'Simplicissimus & fern', 'Cutter · YouTube', 'Journalistisch-dokumentarische Formate für zwei der reichweitenstärksten deutschen Doku-Kanäle.', 'Schnitt journalistisch-dokumentarischer YouTube-Formate für zwei der reichweitenstärksten deutschsprachigen Doku-Kanäle — nach redaktionellen Vorgaben, mit festen Release-Terminen.

---

https://youtu.be/igv1DNkw1PA?si=_o59xHra9ksv0Sjn', 'fern.jpg', '50% 50%', array['Schnitt','Dokumentation']::text[], 'https://youtu.be/igv1DNkw1PA?si=_o59xHra9ksv0Sjn', 'Auf YouTube ansehen', true, null, null, false, 'sage', 'published', 4),
  ('absent-musikvideo', 'absent — Musikvideo', 'Editor · Musikvideo', 'Schnittfolge auf den Beat, Tempo und Rhythmus passend zum Track.', 'Schnitt eines Musikvideos für den Rapper absent — Schnittfolge auf den Beat, Tempo und Rhythmus passend zum Track.

---

https://youtu.be/KBixb-ReNcI?si=2RnTxmi5nIOBPSPD', 'absent.jpg', '50% 50%', array['Schnitt','Musikvideo']::text[], 'https://youtu.be/KBixb-ReNcI?si=2RnTxmi5nIOBPSPD', 'Auf YouTube ansehen', true, null, null, false, 'sky', 'published', 5)
on conflict (slug) do nothing;

-- ---------- Fertig. Kontrolle: ----------
select sort_order, slug, status, is_live, array_length(tags,1) as anzahl_tags
from public.projects order by sort_order;
