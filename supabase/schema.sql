-- Flip or Fold — canonical Supabase schema (device-based accounts, no Supabase Auth)
-- Apply via: supabase db push

-- ── Tables ──

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  device_id text unique not null,
  created_at timestamptz default now()
);

create unique index if not exists players_username_lower_uidx on public.players (lower(username));

create table if not exists public.game_scores (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  score integer not null default 0,
  coins integer not null default 0,
  run_id uuid unique,
  created_at timestamptz default now()
);

create index if not exists game_scores_score_idx on public.game_scores(score desc);
create index if not exists game_scores_created_at_idx on public.game_scores(created_at desc);

create table if not exists public.player_saves (
  player_id uuid primary key references public.players(id) on delete cascade,
  total_coins integer not null default 0,
  xp integer not null default 0,
  level integer not null default 1,
  total_runs integer not null default 0,
  last_daily_claim timestamptz,
  unlocked_items jsonb not null default '["char-rookie","trail-neon-blue"]'::jsonb,
  shop_owned jsonb not null default '["char-rookie","trail-neon-blue","emote-fake-detected"]'::jsonb,
  equipped_character text not null default 'char-rookie',
  equipped_trail text not null default 'trail-neon-blue',
  equipped_emote text not null default 'emote-fake-detected',
  shop_upgrades jsonb not null default '{"appraisalDuration":0,"slowTimeDuration":0,"insuranceBonus":0,"coinGain":0}'::jsonb,
  powerup_levels jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.shop_catalog (
  id text primary key,
  category text not null,
  price integer not null default 0,
  unlock_level integer not null default 1,
  upgrade_key text,
  bonus integer
);

-- ── Client-facing RPCs ──
-- get_player_snapshot       — load everything (1 call at boot)
-- register_player           — create account → returns snapshot
-- is_username_taken         — name check
-- complete_game_run         — end of game (score + rewards)
-- shop_purchase_item        — buy / upgrade
-- shop_equip_item           — equip cosmetic
-- claim_daily_reward        — daily gift
-- get_leaderboard           — rankings
-- import_local_save         — one-time localStorage migration
-- wallet_recovery_lookup    — check if wallet has a linked trainer
-- wallet_recovery_prepare   — sign message to recover on new device
-- finalize_wallet_recovery  — move player to new device_id (via edge fn)

-- Direct table access is revoked for anon; all writes go through RPCs.
