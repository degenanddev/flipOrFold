-- Recover a trainer account on a new browser via a previously linked BSC wallet

create or replace function public.wallet_recovery_lookup(p_wallet_address text)
returns json
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_wallet text;
  v_player public.players%rowtype;
begin
  v_wallet := lower(trim(p_wallet_address));
  if v_wallet is null or v_wallet !~ '^0x[a-f0-9]{40}$' then
    return json_build_object('found', false);
  end if;

  select * into v_player from public.players
  where lower(wallet_address) = v_wallet;

  if not found then
    return json_build_object('found', false);
  end if;

  return json_build_object(
    'found', true,
    'username', v_player.username
  );
end;
$$;

create or replace function public.wallet_recovery_prepare(
  p_new_device_id text,
  p_wallet_address text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet text;
  v_player public.players%rowtype;
  v_nonce bigint;
  v_message text;
  v_chain json;
begin
  if p_new_device_id is null or length(p_new_device_id) < 8 then
    raise exception 'invalid device';
  end if;

  v_wallet := lower(trim(p_wallet_address));
  if v_wallet is null or v_wallet !~ '^0x[a-f0-9]{40}$' then
    raise exception 'invalid wallet';
  end if;

  select * into v_player from public.players
  where lower(wallet_address) = v_wallet;

  if not found then
    raise exception 'no linked account';
  end if;

  if v_player.device_id = p_new_device_id then
    return json_build_object(
      'alreadyOnDevice', true,
      'username', v_player.username,
      'snapshot', public.build_player_snapshot(p_new_device_id)
    );
  end if;

  v_chain := public.get_bsc_crypto_config();

  update public.players
  set wallet_link_nonce = wallet_link_nonce + 1
  where id = v_player.id
  returning wallet_link_nonce into v_nonce;

  v_message := 'Flip or Fold — recover game account'
    || E'\nTrainer: ' || v_player.username
    || E'\nWallet: ' || v_wallet
    || E'\nDevice: ' || p_new_device_id
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

create or replace function public.finalize_wallet_recovery(
  p_new_device_id text,
  p_wallet_address text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet text;
  v_player public.players%rowtype;
  v_conflict public.players%rowtype;
  v_save public.player_saves%rowtype;
begin
  if p_new_device_id is null or length(p_new_device_id) < 8 then
    raise exception 'invalid device';
  end if;

  v_wallet := lower(trim(p_wallet_address));
  if v_wallet is null or v_wallet !~ '^0x[a-f0-9]{40}$' then
    raise exception 'invalid wallet';
  end if;

  select * into v_player from public.players
  where lower(wallet_address) = v_wallet;

  if not found then
    raise exception 'no linked account';
  end if;

  if v_player.device_id = p_new_device_id then
    return public.build_player_snapshot(p_new_device_id);
  end if;

  select * into v_conflict from public.players
  where device_id = p_new_device_id;

  if found and v_conflict.id <> v_player.id then
    v_save := public.ensure_player_save(v_conflict.id);
    if v_save.total_runs > 0 or v_save.total_coins > 0 or v_save.xp > 0 then
      raise exception 'device already registered';
    end if;
    delete from public.players where id = v_conflict.id;
  end if;

  update public.players
  set device_id = p_new_device_id
  where id = v_player.id;

  return public.build_player_snapshot(p_new_device_id);
end;
$$;

revoke all on function public.wallet_recovery_lookup(text) from public;
revoke all on function public.wallet_recovery_prepare(text, text) from public;
revoke all on function public.finalize_wallet_recovery(text, text) from public;

grant execute on function public.wallet_recovery_lookup(text) to anon;
grant execute on function public.wallet_recovery_prepare(text, text) to anon;
grant execute on function public.finalize_wallet_recovery(text, text) to anon;
