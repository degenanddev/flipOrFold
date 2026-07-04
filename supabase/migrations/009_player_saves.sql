-- Player progression + shop synced via Supabase (single snapshot load)

create table if not exists public.player_saves (
  player_id uuid primary key references public.players(id) on delete cascade,
  total_coins integer not null default 0 check (total_coins >= 0 and total_coins <= 999999),
  xp integer not null default 0 check (xp >= 0 and xp <= 999999),
  level integer not null default 1 check (level >= 1 and level <= 99),
  total_runs integer not null default 0 check (total_runs >= 0),
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

insert into public.shop_catalog (id, category, price, unlock_level, upgrade_key, bonus) values
  ('char-rookie', 'characters', 0, 1, null, null),
  ('char-specialist', 'characters', 500, 2, null, null),
  ('char-inspector', 'characters', 1500, 5, null, null),
  ('char-elite', 'characters', 5000, 10, null, null),
  ('trail-neon-blue', 'trails', 300, 3, null, null),
  ('trail-purple-scan', 'trails', 800, 7, null, null),
  ('trail-gold', 'trails', 2000, 12, null, null),
  ('trail-holo', 'trails', 4000, 15, null, null),
  ('upgrade-scanner', 'powerups', 600, 4, 'appraisalDuration', 4),
  ('upgrade-slowtime', 'powerups', 600, 4, 'slowTimeDuration', 4),
  ('upgrade-coins', 'powerups', 800, 5, 'coinGain', 1),
  ('upgrade-shield', 'powerups', 1000, 6, 'insuranceBonus', 1),
  ('emote-fake-detected', 'emotes', 200, 5, null, null),
  ('emote-verified', 'emotes', 200, 8, null, null),
  ('emote-nice-try', 'emotes', 200, 12, null, null)
on conflict (id) do nothing;

-- Auto-create save row for new players
create or replace function public.ensure_player_save(p_player_id uuid)
returns public.player_saves
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.player_saves;
begin
  select * into v_row from public.player_saves where player_id = p_player_id;
  if found then return v_row; end if;
  insert into public.player_saves (player_id) values (p_player_id)
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.xp_required_for_level(p_level integer)
returns integer
language sql
immutable
as $$
  select floor(100 * power(1.35, greatest(p_level, 1) - 1))::integer;
$$;

create or replace function public.apply_xp_to_save(p_level integer, p_xp integer, p_amount integer)
returns table(out_level integer, out_xp integer)
language plpgsql
stable
as $$
declare
  v_level integer := p_level;
  v_xp integer := p_xp;
  v_required integer;
begin
  v_xp := v_xp + p_amount;
  loop
    v_required := public.xp_required_for_level(v_level);
    exit when v_xp < v_required;
    v_xp := v_xp - v_required;
    v_level := v_level + 1;
    exit when v_level >= 99;
  end loop;
  return query select v_level, v_xp;
end;
$$;

create or replace function public.unlocks_for_level(p_level integer)
returns jsonb
language sql
immutable
as $$
  select coalesce(
    jsonb_agg(to_jsonb(x)),
    '[]'::jsonb
  )
  from unnest(array[
    case when p_level >= 1 then 'char-rookie' end,
    case when p_level >= 2 then 'char-specialist' end,
    case when p_level >= 3 then 'trail-neon-blue' end,
    case when p_level >= 5 then 'char-inspector' end,
    case when p_level >= 5 then 'emote-fake-detected' end,
    case when p_level >= 7 then 'trail-purple-scan' end,
    case when p_level >= 8 then 'emote-verified' end,
    case when p_level >= 10 then 'char-elite' end,
    case when p_level >= 12 then 'trail-gold' end,
    case when p_level >= 12 then 'emote-nice-try' end,
    case when p_level >= 15 then 'trail-holo' end
  ]) as x
  where x is not null;
$$;

create or replace function public.build_player_snapshot(p_device_id text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player public.players%rowtype;
  v_save public.player_saves%rowtype;
  v_best integer;
begin
  if p_device_id is null or length(p_device_id) < 8 then
    return null;
  end if;

  select * into v_player from public.players where device_id = p_device_id;
  if not found then return null; end if;

  v_save := public.ensure_player_save(v_player.id);

  select coalesce(max(score), 0) into v_best
  from public.game_scores where player_id = v_player.id;

  return json_build_object(
    'player', json_build_object(
      'id', v_player.id,
      'username', v_player.username,
      'created_at', v_player.created_at
    ),
    'progression', json_build_object(
      'totalCoins', v_save.total_coins,
      'xp', v_save.xp,
      'level', v_save.level,
      'totalRuns', v_save.total_runs,
      'lastDailyClaim', v_save.last_daily_claim,
      'unlockedItems', v_save.unlocked_items,
      'highScore', v_best
    ),
    'shop', json_build_object(
      'ownedItems', v_save.shop_owned,
      'equippedCharacter', v_save.equipped_character,
      'equippedTrail', v_save.equipped_trail,
      'equippedEmote', v_save.equipped_emote,
      'upgrades', v_save.shop_upgrades,
      'powerupLevels', v_save.powerup_levels
    )
  );
end;
$$;

create or replace function public.get_player_snapshot(p_device_id text)
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.build_player_snapshot(p_device_id);
end;
$$;

create or replace function public.import_local_save(
  p_device_id text,
  p_progression jsonb,
  p_shop jsonb
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player public.players%rowtype;
  v_save public.player_saves%rowtype;
  v_local_runs integer;
  v_local_coins integer;
begin
  select * into v_player from public.players where device_id = p_device_id;
  if not found then raise exception 'invalid player'; end if;

  v_save := public.ensure_player_save(v_player.id);
  v_local_runs := coalesce((p_progression->>'totalRuns')::integer, 0);
  v_local_coins := coalesce((p_progression->>'totalCoins')::integer, 0);

  if v_save.total_runs > 0 or v_save.total_coins > 0 then
    return public.build_player_snapshot(p_device_id);
  end if;
  if v_local_runs = 0 and v_local_coins = 0 then
    return public.build_player_snapshot(p_device_id);
  end if;

  update public.player_saves set
    total_coins = least(coalesce((p_progression->>'totalCoins')::integer, 0), 999999),
    xp = least(coalesce((p_progression->>'xp')::integer, 0), 999999),
    level = greatest(1, least(coalesce((p_progression->>'level')::integer, 1), 99)),
    total_runs = least(coalesce((p_progression->>'totalRuns')::integer, 0), 99999),
    last_daily_claim = (p_progression->>'lastDailyClaim')::timestamptz,
    unlocked_items = coalesce(p_progression->'unlockedItems', unlocked_items),
    shop_owned = coalesce(p_shop->'ownedItems', shop_owned),
    equipped_character = coalesce(p_shop->>'equippedCharacter', equipped_character),
    equipped_trail = coalesce(p_shop->>'equippedTrail', equipped_trail),
    equipped_emote = coalesce(p_shop->>'equippedEmote', equipped_emote),
    shop_upgrades = coalesce(p_shop->'upgrades', shop_upgrades),
    powerup_levels = coalesce(p_shop->'powerupLevels', powerup_levels),
    updated_at = now()
  where player_id = v_player.id;

  return public.build_player_snapshot(p_device_id);
end;
$$;

create or replace function public.complete_game_run(
  p_player_id uuid,
  p_device_id text,
  p_run_id uuid,
  p_score integer,
  p_meta_coins integer,
  p_xp integer
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_device text;
  v_save public.player_saves%rowtype;
  v_applied record;
  v_unlocks jsonb;
  v_score_result json;
  v_previous_best integer;
begin
  select device_id into v_device from public.players where id = p_player_id;
  if v_device is null or v_device <> p_device_id then
    raise exception 'invalid player';
  end if;

  if p_meta_coins < 0 or p_meta_coins > 500 then raise exception 'invalid coins'; end if;
  if p_xp < 0 or p_xp > 500 then raise exception 'invalid xp'; end if;

  v_save := public.ensure_player_save(p_player_id);

  select * into v_applied from public.apply_xp_to_save(v_save.level, v_save.xp, p_xp);
  v_unlocks := public.unlocks_for_level(v_applied.out_level);

  update public.player_saves set
    total_coins = least(total_coins + p_meta_coins, 999999),
    xp = v_applied.out_xp,
    level = v_applied.out_level,
    total_runs = total_runs + 1,
    unlocked_items = (
      select jsonb_agg(distinct x)
      from jsonb_array_elements(coalesce(unlocked_items, '[]'::jsonb) || v_unlocks) as t(x)
    ),
    updated_at = now()
  where player_id = p_player_id;

  select coalesce(max(score), 0) into v_previous_best
  from public.game_scores where player_id = p_player_id;

  if p_run_id is not null and p_score >= 0 and p_score <= 50000
     and (v_previous_best = 0 or p_score > v_previous_best) then
    v_score_result := public.submit_game_score(p_player_id, p_device_id, p_score, p_meta_coins, p_run_id);
  end if;

  return public.build_player_snapshot(p_device_id);
end;
$$;

create or replace function public.shop_purchase_item(p_device_id text, p_item_id text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player public.players%rowtype;
  v_save public.player_saves%rowtype;
  v_item public.shop_catalog%rowtype;
  v_level integer;
  v_price integer;
  v_current_powerup integer;
  v_upgrades jsonb;
  v_owned jsonb;
begin
  select * into v_player from public.players where device_id = p_device_id;
  if not found then raise exception 'invalid player'; end if;

  select * into v_item from public.shop_catalog where id = p_item_id;
  if not found then raise exception 'unknown item'; end if;

  v_save := public.ensure_player_save(v_player.id);
  if v_save.level < v_item.unlock_level then raise exception 'level locked'; end if;

  if v_item.category = 'powerups' then
    v_current_powerup := coalesce((v_save.powerup_levels->>p_item_id)::integer, 0);
    if v_current_powerup >= 5 then raise exception 'max level'; end if;
    v_price := round(v_item.price * (1 + v_current_powerup * 0.6))::integer;
    if v_save.total_coins < v_price then raise exception 'not enough coins'; end if;

    v_upgrades := v_save.shop_upgrades;
    if v_item.upgrade_key is not null then
      v_upgrades := jsonb_set(
        v_upgrades,
        array[v_item.upgrade_key],
        to_jsonb(coalesce((v_upgrades->>v_item.upgrade_key)::integer, 0) + coalesce(v_item.bonus, 0)),
        true
      );
    end if;

    update public.player_saves set
      total_coins = total_coins - v_price,
      powerup_levels = jsonb_set(v_save.powerup_levels, array[p_item_id], to_jsonb(v_current_powerup + 1), true),
      shop_upgrades = v_upgrades,
      updated_at = now()
    where player_id = v_player.id;
  else
    v_owned := v_save.shop_owned;
    if v_owned @> jsonb_build_array(p_item_id) then raise exception 'already owned'; end if;
    if v_save.total_coins < v_item.price then raise exception 'not enough coins'; end if;

    update public.player_saves set
      total_coins = total_coins - v_item.price,
      shop_owned = v_owned || jsonb_build_array(p_item_id),
      updated_at = now()
    where player_id = v_player.id;
  end if;

  return public.build_player_snapshot(p_device_id);
end;
$$;

create or replace function public.shop_equip_item(p_device_id text, p_item_id text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player public.players%rowtype;
  v_save public.player_saves%rowtype;
  v_item public.shop_catalog%rowtype;
begin
  select * into v_player from public.players where device_id = p_device_id;
  if not found then raise exception 'invalid player'; end if;

  select * into v_item from public.shop_catalog where id = p_item_id;
  if not found then raise exception 'unknown item'; end if;
  if v_item.category = 'powerups' then raise exception 'cannot equip'; end if;

  v_save := public.ensure_player_save(v_player.id);
  if not (v_save.shop_owned @> jsonb_build_array(p_item_id)) then raise exception 'not owned'; end if;

  if v_item.category = 'characters' then
    update public.player_saves set equipped_character = p_item_id, updated_at = now() where player_id = v_player.id;
  elsif v_item.category = 'trails' then
    update public.player_saves set equipped_trail = p_item_id, updated_at = now() where player_id = v_player.id;
  elsif v_item.category = 'emotes' then
    update public.player_saves set equipped_emote = p_item_id, updated_at = now() where player_id = v_player.id;
  end if;

  return public.build_player_snapshot(p_device_id);
end;
$$;

create or replace function public.claim_daily_reward(p_device_id text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player public.players%rowtype;
  v_save public.player_saves%rowtype;
  v_applied record;
  v_today date := (now() at time zone 'utc')::date;
  v_last date;
begin
  select * into v_player from public.players where device_id = p_device_id;
  if not found then raise exception 'invalid player'; end if;

  v_save := public.ensure_player_save(v_player.id);
  v_last := (v_save.last_daily_claim at time zone 'utc')::date;
  if v_last is not null and v_last = v_today then
    raise exception 'already claimed';
  end if;

  select * into v_applied from public.apply_xp_to_save(v_save.level, v_save.xp, 25);

  update public.player_saves set
    total_coins = least(total_coins + 50, 999999),
    xp = v_applied.out_xp,
    level = v_applied.out_level,
    last_daily_claim = now(),
    updated_at = now()
  where player_id = v_player.id;

  return public.build_player_snapshot(p_device_id);
end;
$$;

revoke all on public.player_saves from anon, authenticated;
revoke all on public.shop_catalog from anon, authenticated;

revoke all on function public.get_player_snapshot(text) from public;
revoke all on function public.import_local_save(text, jsonb, jsonb) from public;
revoke all on function public.complete_game_run(uuid, text, uuid, integer, integer, integer) from public;
revoke all on function public.shop_purchase_item(text, text) from public;
revoke all on function public.shop_equip_item(text, text) from public;
revoke all on function public.claim_daily_reward(text) from public;

grant execute on function public.get_player_snapshot(text) to anon;
grant execute on function public.import_local_save(text, jsonb, jsonb) to anon;
grant execute on function public.complete_game_run(uuid, text, uuid, integer, integer, integer) to anon;
grant execute on function public.shop_purchase_item(text, text) to anon;
grant execute on function public.shop_equip_item(text, text) to anon;
grant execute on function public.claim_daily_reward(text) to anon;

-- Backfill saves for existing players
insert into public.player_saves (player_id)
select id from public.players p
where not exists (select 1 from public.player_saves s where s.player_id = p.id);
