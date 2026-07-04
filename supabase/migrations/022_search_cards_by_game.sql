-- Optional game filter for Card Dex (One Piece vs all cached Renaiss).

create or replace function public.search_trading_cards(
  p_query text,
  p_limit int default 20,
  p_game text default null
)
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
      and (p_game is null or game = p_game)
    order by market_price_usd desc
    limit greatest(1, least(coalesce(p_limit, 20), 40))
  ) t;
$$;
