-- Shrink trading_cards footprint + lightweight search for Card Dex (no new tables).

-- spark jsonb was never read by the game client (~5–15 KB per graded card).
alter table public.trading_cards drop column if exists spark;

-- Keep only recent sync audit rows.
delete from public.renaiss_sync_log
where id not in (
  select id from public.renaiss_sync_log order by created_at desc limit 30
);

-- Seed RPC: ignore spark in incoming JSON (column removed).
create or replace function public.upsert_trading_cards_seed(p_cards jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  insert into public.trading_cards (
    id, game, game_type, name, set_name, set_code, card_number, variation, language,
    image_url, image_url_thumb, grade_company, grade, grade_label,
    price_usd_cents, market_price_usd, rarity, delta_pct, confidence, last_sale_at,
    renaiss_href, source, active, fetched_at
  )
  select
    x.id,
    x.game,
    x.game_type,
    x.name,
    x.set_name,
    x.set_code,
    x.card_number,
    x.variation,
    x.language,
    x.image_url,
    x.image_url_thumb,
    x.grade_company,
    x.grade,
    x.grade_label,
    coalesce(x.price_usd_cents, 0),
    greatest(coalesce(x.market_price_usd, 1), 1),
    x.rarity,
    x.delta_pct,
    x.confidence,
    nullif(x.last_sale_at, '')::timestamptz,
    x.renaiss_href,
    coalesce(x.source, 'renaiss'),
    coalesce(x.active, true),
    coalesce(nullif(x.fetched_at, '')::timestamptz, now())
  from jsonb_to_recordset(p_cards) as x(
    id text,
    game text,
    game_type text,
    name text,
    set_name text,
    set_code text,
    card_number text,
    variation text,
    language text,
    image_url text,
    image_url_thumb text,
    grade_company text,
    grade text,
    grade_label text,
    price_usd_cents bigint,
    market_price_usd integer,
    rarity text,
    delta_pct numeric,
    confidence text,
    last_sale_at text,
    renaiss_href text,
    source text,
    active boolean,
    fetched_at text
  )
  on conflict (id) do update set
    game = excluded.game,
    name = excluded.name,
    set_name = excluded.set_name,
    image_url = excluded.image_url,
    market_price_usd = excluded.market_price_usd,
    rarity = excluded.rarity,
    price_usd_cents = excluded.price_usd_cents,
    grade_label = excluded.grade_label,
    fetched_at = excluded.fetched_at,
    active = true;

  get diagnostics n = row_count;
  return n;
end;
$$;

-- Card Dex: search cached Renaiss rows only (no TCGdex storage).
create or replace function public.search_trading_cards(p_query text, p_limit int default 20)
returns json
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    json_agg(row_to_json(t) order by t."marketPrice" desc),
    '[]'::json
  )
  from (
    select
      id,
      game,
      name,
      set_name as "set",
      rarity,
      image_url as image,
      market_price_usd as "marketPrice",
      grade_label as "gradeLabel",
      renaiss_href as "renaissHref",
      delta_pct as "deltaPct"
    from public.trading_cards
    where active = true
      and length(trim(coalesce(p_query, ''))) >= 2
      and name ilike '%' || trim(p_query) || '%'
    order by market_price_usd desc
    limit greatest(1, least(coalesce(p_limit, 20), 40))
  ) t;
$$;

revoke all on function public.search_trading_cards(text, int) from public;
grant execute on function public.search_trading_cards(text, int) to anon;
