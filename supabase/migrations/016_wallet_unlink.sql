-- Let players unlink a wallet (e.g. switch to a funded wallet)

create or replace function public.wallet_unlink(p_device_id text)
returns json
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

  select * into v_player from public.players where device_id = p_device_id;
  if not found then raise exception 'player not found'; end if;

  if v_player.wallet_address is null then
    raise exception 'no wallet linked';
  end if;

  update public.crypto_orders
  set status = 'expired'
  where player_id = v_player.id
    and status = 'pending';

  update public.players
  set wallet_address = null
  where id = v_player.id;

  return public.build_player_snapshot(p_device_id);
end;
$$;

revoke all on function public.wallet_unlink(text) from public;
grant execute on function public.wallet_unlink(text) to anon;
