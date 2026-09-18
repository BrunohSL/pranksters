-- Schema do site do Team Pranksters
-- Rode este arquivo inteiro no SQL Editor do seu projeto Supabase (supabase.com).
-- Ele é seguro de rodar de novo (idempotente) SE VOCÊ NÃO SE IMPORTAR DE PERDER OS DADOS
-- DA LIGA: a seção de reset abaixo apaga e recria league_seasons/league_rounds/league_results
-- toda vez. Amistosos, torneios, fotos e jogadores não são apagados.

-- ============ RESET DA LIGA (apaga rodadas/resultados/temporadas) ============

drop view if exists public.league_standings;
drop table if exists public.league_results;
drop table if exists public.league_rounds;
drop table if exists public.league_seasons;

-- ============ TABELAS ============

create table if not exists public.league_players (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

-- Uma temporada é um período de N rodadas (ex: "Temporada 1", 8 rodadas).
-- As rodadas de uma temporada não precisam acontecer toda semana (pula quando tem
-- evento oficial da Pokémon Company, por exemplo) — round_date é livre, só a
-- sequência de round_number importa pra pontuação.
create table if not exists public.league_seasons (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  total_rounds int not null check (total_rounds > 0),
  is_active boolean not null default true,
  started_at date not null default current_date,
  created_at timestamptz not null default now()
);

create table if not exists public.league_rounds (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.league_seasons(id) on delete cascade,
  round_number int not null check (round_number > 0),
  round_date date not null,
  created_at timestamptz not null default now(),
  unique (season_id, round_number)
);

-- Pontuação: 3 pontos por vitória + 1 ponto de participação (por ter jogado a rodada).
-- Empates/derrotas não somam além disso. É calculado automaticamente pelo banco —
-- o formulário do site só pede vitórias e derrotas.
create table if not exists public.league_results (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.league_rounds(id) on delete cascade,
  player_id uuid not null references public.league_players(id) on delete cascade,
  wins int not null default 0 check (wins >= 0),
  losses int not null default 0 check (losses >= 0),
  points int generated always as (wins * 3 + 1) stored,
  created_at timestamptz not null default now(),
  unique (round_id, player_id)
);

create table if not exists public.friendlies (
  id uuid primary key default gen_random_uuid(),
  opponent_team text not null,
  played_at date not null,
  our_score int not null default 0,
  their_score int not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.tournaments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  event_date date not null,
  location text,
  format text,
  link text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.gallery_photos (
  id uuid primary key default gen_random_uuid(),
  image_path text not null,
  caption text,
  event_date date,
  created_at timestamptz not null default now()
);

-- Classificação acumulada, agrupada por temporada.
create or replace view public.league_standings as
select
  s.id as season_id,
  s.name as season_name,
  s.total_rounds,
  s.is_active as season_is_active,
  p.id as player_id,
  p.name as player_name,
  count(res.id) as rounds_played,
  coalesce(sum(res.wins), 0) as total_wins,
  coalesce(sum(res.losses), 0) as total_losses,
  coalesce(sum(res.points), 0) as total_points
from public.league_seasons s
join public.league_rounds lr on lr.season_id = s.id
join public.league_results res on res.round_id = lr.id
join public.league_players p on p.id = res.player_id
group by s.id, s.name, s.total_rounds, s.is_active, p.id, p.name
order by s.id, total_points desc, total_wins desc, p.name asc;

-- ============ PERMISSÕES ============

grant usage on schema public to anon, authenticated;

grant select on
  public.league_players,
  public.league_seasons,
  public.league_rounds,
  public.league_results,
  public.friendlies,
  public.tournaments,
  public.gallery_photos,
  public.league_standings
to anon, authenticated;

grant insert, update, delete on
  public.league_players,
  public.league_seasons,
  public.league_rounds,
  public.league_results,
  public.friendlies,
  public.tournaments,
  public.gallery_photos
to authenticated;

-- ============ ROW LEVEL SECURITY ============
-- Leitura liberada pra qualquer visitante; escrita só pra quem estiver logado
-- (as 4 contas do time, criadas manualmente em Authentication > Users).
-- Os "drop policy if exists" deixam este arquivo seguro de rodar mais de uma vez.

alter table public.league_players enable row level security;
alter table public.league_seasons enable row level security;
alter table public.league_rounds enable row level security;
alter table public.league_results enable row level security;
alter table public.friendlies enable row level security;
alter table public.tournaments enable row level security;
alter table public.gallery_photos enable row level security;

drop policy if exists "public read" on public.league_players;
drop policy if exists "public read" on public.league_seasons;
drop policy if exists "public read" on public.league_rounds;
drop policy if exists "public read" on public.league_results;
drop policy if exists "public read" on public.friendlies;
drop policy if exists "public read" on public.tournaments;
drop policy if exists "public read" on public.gallery_photos;

create policy "public read" on public.league_players for select using (true);
create policy "public read" on public.league_seasons for select using (true);
create policy "public read" on public.league_rounds for select using (true);
create policy "public read" on public.league_results for select using (true);
create policy "public read" on public.friendlies for select using (true);
create policy "public read" on public.tournaments for select using (true);
create policy "public read" on public.gallery_photos for select using (true);

drop policy if exists "team write" on public.league_players;
drop policy if exists "team write" on public.league_seasons;
drop policy if exists "team write" on public.league_rounds;
drop policy if exists "team write" on public.league_results;
drop policy if exists "team write" on public.friendlies;
drop policy if exists "team write" on public.tournaments;
drop policy if exists "team write" on public.gallery_photos;

create policy "team write" on public.league_players for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "team write" on public.league_seasons for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "team write" on public.league_rounds for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "team write" on public.league_results for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "team write" on public.friendlies for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "team write" on public.tournaments for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "team write" on public.gallery_photos for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ============ STORAGE (fotos da galeria) ============

insert into storage.buckets (id, name, public)
values ('gallery', 'gallery', true)
on conflict (id) do nothing;

drop policy if exists "public read gallery" on storage.objects;
drop policy if exists "team write gallery" on storage.objects;
drop policy if exists "team delete gallery" on storage.objects;

create policy "public read gallery" on storage.objects for select
  using (bucket_id = 'gallery');

create policy "team write gallery" on storage.objects for insert
  with check (bucket_id = 'gallery' and auth.role() = 'authenticated');

create policy "team delete gallery" on storage.objects for delete
  using (bucket_id = 'gallery' and auth.role() = 'authenticated');
