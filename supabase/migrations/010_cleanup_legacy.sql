-- Cleanup legacy auth schema + redundant RPCs

-- Old Supabase Auth schema (never used by this app)
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

drop table if exists public.inventory cascade;
drop table if exists public.scores cascade;
drop table if exists public.profiles cascade;

-- Redundant: highScore is included in get_player_snapshot
drop function if exists public.get_player_best_score(uuid);

-- Client uses get_player_snapshot instead
revoke all on function public.get_player_by_device(text) from anon;
revoke all on function public.get_player_by_device(text) from authenticated;

-- register_player returns full snapshot (one round-trip after signup)
create or replace function public.register_player(p_device_id text, p_username text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.players%rowtype;
  v_username text;
begin
  if p_device_id is null or length(p_device_id) < 8 then
    raise exception 'invalid device';
  end if;

  v_username := left(trim(regexp_replace(p_username, '\s+', ' ', 'g')), 20);
  if length(v_username) < 2 then
    raise exception 'username too short';
  end if;

  if public.is_username_taken(v_username, p_device_id) then
    raise exception 'username taken';
  end if;

  select * into v_row from public.players where device_id = p_device_id;

  if found then
    update public.players set username = v_username where device_id = p_device_id
    returning * into v_row;
  else
    insert into public.players (device_id, username)
    values (p_device_id, v_username)
    returning * into v_row;
  end if;

  perform public.ensure_player_save(v_row.id);

  return public.build_player_snapshot(p_device_id);
end;
$$;

revoke all on function public.register_player(text, text) from public;
grant execute on function public.register_player(text, text) to anon;
