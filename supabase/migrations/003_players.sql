-- Flip or Fold — pseudo accounts (no Supabase Auth required)
-- Run in Supabase SQL Editor

create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  device_id text unique not null,
  created_at timestamptz default now()
);

create table if not exists game_scores (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  score integer not null default 0,
  coins integer not null default 0,
  created_at timestamptz default now()
);

create index if not exists game_scores_score_idx on game_scores(score desc);
create index if not exists game_scores_created_at_idx on game_scores(created_at desc);
create index if not exists players_username_idx on players(lower(username));

alter table players enable row level security;
alter table game_scores enable row level security;

drop policy if exists "players_select" on players;
drop policy if exists "players_insert" on players;
drop policy if exists "players_update" on players;
drop policy if exists "game_scores_select" on game_scores;
drop policy if exists "game_scores_insert" on game_scores;

create policy "players_select" on players for select using (true);
create policy "players_insert" on players for insert with check (true);
create policy "players_update" on players for update using (true);
create policy "game_scores_select" on game_scores for select using (true);
create policy "game_scores_insert" on game_scores for insert with check (true);
