-- Trading card pool sourced from Renaiss OS Index API (multi-game)

create table if not exists public.trading_cards (
  id text primary key,
  game text not null,
  game_type text,
  name text not null,
  set_name text,
  set_code text,
  card_number text,
  variation text,
  language text,
  image_url text not null,
  image_url_thumb text,
  grade_company text,
  grade text,
  grade_label text,
  price_usd_cents bigint,
  market_price_usd integer not null check (market_price_usd > 0),
  rarity text not null check (rarity in ('common', 'rare', 'epic', 'legendary')),
  delta_pct numeric,
  confidence text,
  last_sale_at timestamptz,
  renaiss_href text unique not null,
  spark jsonb not null default '[]'::jsonb,
  source text not null default 'renaiss',
  active boolean not null default true,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists trading_cards_active_game_idx
  on public.trading_cards (active, game)
  where active = true;

create index if not exists trading_cards_fetched_at_idx
  on public.trading_cards (fetched_at desc);

create table if not exists public.renaiss_sync_log (
  id bigserial primary key,
  endpoint text not null,
  cards_upserted integer not null default 0,
  rate_limit_remaining integer,
  rate_limit_reset timestamptz,
  created_at timestamptz not null default now()
);

create or replace function public.get_trading_card_pool()
returns json
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    json_agg(
      json_build_object(
        'id', id,
        'game', game,
        'name', name,
        'set', set_name,
        'rarity', rarity,
        'image', image_url,
        'marketPrice', market_price_usd,
        'gradeLabel', grade_label
      )
      order by random()
    ),
    '[]'::json
  )
  from trading_cards
  where active = true
    and image_url is not null
    and length(trim(image_url)) > 8;
$$;

revoke all on public.trading_cards from anon, authenticated;
revoke all on public.renaiss_sync_log from anon, authenticated;
revoke all on function public.get_trading_card_pool() from public;
grant execute on function public.get_trading_card_pool() to anon;
