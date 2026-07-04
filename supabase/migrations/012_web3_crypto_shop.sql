-- Web3 wallet link + BNB crypto bonus shop (no on-chain contract)

alter table public.players
  add column if not exists wallet_address text,
  add column if not exists wallet_link_nonce bigint not null default 0;

create unique index if not exists players_wallet_address_lower_uidx
  on public.players (lower(wallet_address))
  where wallet_address is not null;

create table if not exists public.crypto_bonus_catalog (
  id text primary key,
  name text not null,
  description text not null,
  icon text not null default '🎁',
  price_wei numeric(78, 0) not null check (price_wei > 0),
  bonus_type text not null check (bonus_type in ('coins', 'xp', 'pack')),
  bonus_payload jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0
);

insert into public.crypto_bonus_catalog (id, name, description, icon, price_wei, bonus_type, bonus_payload, sort_order) values
  (
    'crypto-coin-surge',
    'Coin Surge',
    '+750 coins instantly — funded with tBNB',
    '💎',
    100000000000000,
    'coins',
    '{"coins": 750}'::jsonb,
    1
  ),
  (
    'crypto-xp-burst',
    'XP Burst',
    '+150 XP boost for your trainer level',
    '⚡',
    200000000000000,
    'xp',
    '{"xp": 150}'::jsonb,
    2
  ),
  (
    'crypto-mega-pack',
    'Mega Pack',
    '+500 coins, +75 XP & +1 coin gain upgrade',
    '🚀',
    500000000000000,
    'pack',
    '{"coins": 500, "xp": 75, "coinGain": 1}'::jsonb,
    3
  )
on conflict (id) do nothing;

create table if not exists public.crypto_orders (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  item_id text not null references public.crypto_bonus_catalog(id),
  amount_wei numeric(78, 0) not null,
  treasury_address text not null,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'expired', 'failed')),
  tx_hash text unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  confirmed_at timestamptz
);

create index if not exists crypto_orders_player_status_idx
  on public.crypto_orders (player_id, status);

-- Include wallet in snapshot
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
      'created_at', v_player.created_at,
      'walletAddress', v_player.wallet_address
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

create or replace function public.wallet_link_prepare(p_device_id text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player public.players%rowtype;
  v_nonce bigint;
  v_message text;
begin
  if p_device_id is null or length(p_device_id) < 8 then
    raise exception 'invalid device';
  end if;

  select * into v_player from public.players where device_id = p_device_id;
  if not found then raise exception 'player not found'; end if;

  update public.players
  set wallet_link_nonce = wallet_link_nonce + 1
  where id = v_player.id
  returning wallet_link_nonce into v_nonce;

  v_message := 'Flip or Fold — link wallet to game account'
    || E'\nDevice: ' || p_device_id
    || E'\nNonce: ' || v_nonce::text
    || E'\nChain: BSC Testnet (97)';

  return json_build_object('message', v_message, 'nonce', v_nonce);
end;
$$;

create or replace function public.finalize_wallet_link(
  p_device_id text,
  p_wallet_address text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player public.players%rowtype;
  v_wallet text;
begin
  v_wallet := lower(trim(p_wallet_address));
  if v_wallet is null or v_wallet !~ '^0x[a-f0-9]{40}$' then
    raise exception 'invalid wallet';
  end if;

  if exists (
    select 1 from public.players
    where lower(wallet_address) = v_wallet
      and device_id is distinct from p_device_id
  ) then
    raise exception 'wallet already linked';
  end if;

  update public.players
  set wallet_address = v_wallet
  where device_id = p_device_id
  returning * into v_player;

  if not found then raise exception 'player not found'; end if;

  return public.build_player_snapshot(p_device_id);
end;
$$;

create or replace function public.crypto_prepare_order(
  p_device_id text,
  p_item_id text,
  p_treasury_address text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player public.players%rowtype;
  v_item public.crypto_bonus_catalog%rowtype;
  v_order public.crypto_orders%rowtype;
  v_treasury text;
begin
  if p_device_id is null or length(p_device_id) < 8 then
    raise exception 'invalid device';
  end if;

  v_treasury := lower(trim(p_treasury_address));
  if v_treasury is null or v_treasury !~ '^0x[a-f0-9]{40}$' then
    raise exception 'invalid treasury';
  end if;

  select * into v_player from public.players where device_id = p_device_id;
  if not found then raise exception 'player not found'; end if;

  if v_player.wallet_address is null then
    raise exception 'wallet not linked';
  end if;

  select * into v_item from public.crypto_bonus_catalog where id = p_item_id;
  if not found then raise exception 'unknown item'; end if;

  update public.crypto_orders
  set status = 'expired'
  where player_id = v_player.id
    and status = 'pending'
    and expires_at < now();

  if exists (
    select 1 from public.crypto_orders
    where player_id = v_player.id and status = 'pending' and expires_at > now()
  ) then
    raise exception 'pending order exists';
  end if;

  insert into public.crypto_orders (player_id, item_id, amount_wei, treasury_address, expires_at)
  values (v_player.id, v_item.id, v_item.price_wei, v_treasury, now() + interval '15 minutes')
  returning * into v_order;

  return json_build_object(
    'orderId', v_order.id,
    'itemId', v_item.id,
    'itemName', v_item.name,
    'amountWei', v_order.amount_wei::text,
    'treasuryAddress', v_treasury,
    'chainId', 97,
    'expiresAt', v_order.expires_at,
    'fromWallet', v_player.wallet_address
  );
end;
$$;

create or replace function public.apply_crypto_bonus(p_player_id uuid, p_item_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.crypto_bonus_catalog%rowtype;
  v_save public.player_saves%rowtype;
  v_applied record;
  v_coins integer;
  v_xp integer;
  v_coin_gain integer;
begin
  select * into v_item from public.crypto_bonus_catalog where id = p_item_id;
  if not found then raise exception 'unknown item'; end if;

  v_save := public.ensure_player_save(p_player_id);

  if v_item.bonus_type = 'coins' then
    v_coins := coalesce((v_item.bonus_payload->>'coins')::integer, 0);
    update public.player_saves
    set total_coins = least(total_coins + v_coins, 999999), updated_at = now()
    where player_id = p_player_id;

  elsif v_item.bonus_type = 'xp' then
    v_xp := coalesce((v_item.bonus_payload->>'xp')::integer, 0);
    select * into v_applied from public.apply_xp_to_save(v_save.level, v_save.xp, v_xp);
    update public.player_saves set
      xp = v_applied.out_xp,
      level = v_applied.out_level,
      updated_at = now()
    where player_id = p_player_id;

  elsif v_item.bonus_type = 'pack' then
    v_coins := coalesce((v_item.bonus_payload->>'coins')::integer, 0);
    v_xp := coalesce((v_item.bonus_payload->>'xp')::integer, 0);
    v_coin_gain := coalesce((v_item.bonus_payload->>'coinGain')::integer, 0);

    select * into v_applied from public.apply_xp_to_save(v_save.level, v_save.xp, v_xp);

    update public.player_saves set
      total_coins = least(total_coins + v_coins, 999999),
      xp = v_applied.out_xp,
      level = v_applied.out_level,
      shop_upgrades = jsonb_set(
        shop_upgrades,
        '{coinGain}',
        to_jsonb(least(coalesce((shop_upgrades->>'coinGain')::integer, 0) + v_coin_gain, 10)),
        true
      ),
      updated_at = now()
    where player_id = p_player_id;
  end if;
end;
$$;

create or replace function public.finalize_crypto_order(
  p_order_id uuid,
  p_tx_hash text,
  p_from_wallet text,
  p_to_wallet text,
  p_value_wei numeric
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.crypto_orders%rowtype;
  v_player public.players%rowtype;
  v_device text;
begin
  select * into v_order
  from public.crypto_orders
  where id = p_order_id
  for update;

  if not found then raise exception 'order not found'; end if;
  if v_order.status <> 'pending' then raise exception 'order not pending'; end if;
  if v_order.expires_at < now() then
    update public.crypto_orders set status = 'expired' where id = p_order_id;
    raise exception 'order expired';
  end if;

  select * into v_player from public.players where id = v_order.player_id;
  if lower(trim(p_from_wallet)) <> lower(v_player.wallet_address) then
    raise exception 'wrong sender wallet';
  end if;
  if lower(trim(p_to_wallet)) <> lower(v_order.treasury_address) then
    raise exception 'wrong treasury';
  end if;
  if p_value_wei::numeric <> v_order.amount_wei then
    raise exception 'wrong amount';
  end if;

  if exists (select 1 from public.crypto_orders where tx_hash = lower(trim(p_tx_hash))) then
    raise exception 'tx already used';
  end if;

  perform public.apply_crypto_bonus(v_order.player_id, v_order.item_id);

  update public.crypto_orders set
    status = 'confirmed',
    tx_hash = lower(trim(p_tx_hash)),
    confirmed_at = now()
  where id = p_order_id;

  select device_id into v_device from public.players where id = v_order.player_id;
  return public.build_player_snapshot(v_device);
end;
$$;

create or replace function public.get_crypto_bonus_catalog()
returns setof public.crypto_bonus_catalog
language sql
security definer
set search_path = public
as $$
  select * from public.crypto_bonus_catalog order by sort_order;
$$;

revoke all on public.crypto_bonus_catalog from anon, authenticated;
revoke all on public.crypto_orders from anon, authenticated;

revoke all on function public.wallet_link_prepare(text) from public;
revoke all on function public.crypto_prepare_order(text, text, text) from public;
revoke all on function public.get_crypto_bonus_catalog() from public;
revoke all on function public.finalize_wallet_link(text, text) from public;
revoke all on function public.finalize_crypto_order(uuid, text, text, text, numeric) from public;
revoke all on function public.apply_crypto_bonus(uuid, text) from public;

grant execute on function public.wallet_link_prepare(text) to anon;
grant execute on function public.crypto_prepare_order(text, text, text) to anon;
grant execute on function public.get_crypto_bonus_catalog() to anon;

grant execute on function public.finalize_wallet_link(text, text) to service_role;
grant execute on function public.finalize_crypto_order(uuid, text, text, text, numeric) to service_role;
grant execute on function public.apply_crypto_bonus(uuid, text) to service_role;
