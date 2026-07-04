-- BSC testnet ↔ mainnet switch (keep in sync with VITE_BSC_NETWORK + Supabase BSC_NETWORK secret)

create table if not exists public.crypto_settings (
  key text primary key,
  value text not null
);

insert into public.crypto_settings (key, value) values ('bsc_network', 'testnet')
on conflict (key) do nothing;

create or replace function public.get_bsc_crypto_config()
returns json
language sql
stable
set search_path = public
as $$
  select case coalesce((select value from public.crypto_settings where key = 'bsc_network'), 'testnet')
    when 'mainnet' then json_build_object(
      'network', 'mainnet',
      'chainId', 56,
      'chainLabel', 'BNB Smart Chain',
      'currency', 'BNB'
    )
    else json_build_object(
      'network', 'testnet',
      'chainId', 97,
      'chainLabel', 'BNB Smart Chain Testnet',
      'currency', 'tBNB'
    )
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
  v_chain json;
begin
  if p_device_id is null or length(p_device_id) < 8 then
    raise exception 'invalid device';
  end if;

  select * into v_player from public.players where device_id = p_device_id;
  if not found then raise exception 'player not found'; end if;

  v_chain := public.get_bsc_crypto_config();

  update public.players
  set wallet_link_nonce = wallet_link_nonce + 1
  where id = v_player.id
  returning wallet_link_nonce into v_nonce;

  v_message := 'Flip or Fold — link wallet to game account'
    || E'\nTrainer: ' || v_player.username
    || E'\nDevice: ' || p_device_id
    || E'\nNonce: ' || v_nonce::text
    || E'\nChain: ' || (v_chain->>'chainLabel') || ' (' || (v_chain->>'chainId') || ')';

  return json_build_object(
    'message', v_message,
    'nonce', v_nonce,
    'username', v_player.username,
    'chainId', (v_chain->>'chainId')::integer,
    'network', v_chain->>'network'
  );
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
  v_chain json;
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

  v_chain := public.get_bsc_crypto_config();

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
    'chainId', (v_chain->>'chainId')::integer,
    'network', v_chain->>'network',
    'currency', v_chain->>'currency',
    'expiresAt', v_order.expires_at,
    'fromWallet', v_player.wallet_address
  );
end;
$$;

revoke all on public.crypto_settings from anon, authenticated;

grant execute on function public.get_bsc_crypto_config() to anon;
grant execute on function public.wallet_link_prepare(text) to anon;
grant execute on function public.crypto_prepare_order(text, text, text) to anon;
