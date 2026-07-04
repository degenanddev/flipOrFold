-- Include trainer username in wallet link signature message

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
    || E'\nTrainer: ' || v_player.username
    || E'\nDevice: ' || p_device_id
    || E'\nNonce: ' || v_nonce::text
    || E'\nChain: BSC Testnet (97)';

  return json_build_object(
    'message', v_message,
    'nonce', v_nonce,
    'username', v_player.username
  );
end;
$$;

grant execute on function public.wallet_link_prepare(text) to anon;
