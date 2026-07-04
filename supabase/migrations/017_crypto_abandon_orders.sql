-- Clear abandoned crypto checkouts so cancelled/failed buys can retry immediately

create or replace function public.crypto_abandon_order(p_device_id text, p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player public.players%rowtype;
begin
  if p_device_id is null or length(p_device_id) < 8 then
    raise exception 'invalid device';
  end if;
  if p_order_id is null then
    raise exception 'invalid order';
  end if;

  select * into v_player from public.players where device_id = p_device_id;
  if not found then raise exception 'player not found'; end if;

  update public.crypto_orders
  set status = 'expired'
  where id = p_order_id
    and player_id = v_player.id
    and status = 'pending'
    and tx_hash is null;
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
    and (expires_at < now() or tx_hash is null);

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

revoke all on function public.crypto_abandon_order(text, uuid) from public;
grant execute on function public.crypto_abandon_order(text, uuid) to anon;
