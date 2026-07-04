-- Lock down players table + case-insensitive usernames + safer RPCs

-- Case-insensitive unique usernames (drop old case-sensitive dupes first — keep oldest per lower(name))
delete from players p1
using players p2
where lower(p1.username) = lower(p2.username)
  and p1.created_at > p2.created_at;

create unique index if not exists players_username_lower_uidx on players (lower(username));

-- ── Player RPCs (no direct table access from client) ──

create or replace function public.get_player_by_device(p_device_id text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row players%rowtype;
begin
  if p_device_id is null or length(p_device_id) < 8 then
    return null;
  end if;
  select * into v_row from players where device_id = p_device_id;
  if not found then
    return null;
  end if;
  return json_build_object(
    'id', v_row.id,
    'username', v_row.username,
    'created_at', v_row.created_at
  );
end;
$$;

create or replace function public.is_username_taken(p_username text, p_device_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  return exists (
    select 1 from players
    where lower(username) = lower(trim(p_username))
      and device_id is distinct from p_device_id
  );
end;
$$;

create or replace function public.register_player(p_device_id text, p_username text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row players%rowtype;
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

  select * into v_row from players where device_id = p_device_id;

  if found then
    update players set username = v_username where device_id = p_device_id
    returning * into v_row;
  else
    insert into players (device_id, username)
    values (p_device_id, v_username)
    returning * into v_row;
  end if;

  return json_build_object(
    'id', v_row.id,
    'username', v_row.username,
    'created_at', v_row.created_at
  );
end;
$$;

-- Leaderboard RPC (best score per player, no device_id leak)
create or replace function public.get_leaderboard(p_since timestamptz default null, p_limit int default 50)
returns table (
  id uuid,
  player_id uuid,
  username text,
  score integer,
  coins integer,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  with best as (
    select distinct on (gs.player_id)
      gs.id,
      gs.player_id,
      p.username,
      gs.score,
      gs.coins,
      gs.created_at
    from game_scores gs
    join players p on p.id = gs.player_id
    where p_since is null or gs.created_at >= p_since
    order by gs.player_id, gs.score desc, gs.created_at desc
  )
  select best.id, best.player_id, best.username, best.score, best.coins, best.created_at
  from best
  order by best.score desc, best.created_at desc
  limit greatest(1, least(p_limit, 100));
$$;

-- Harden score RPC: rate limit + tighter coin bound
create or replace function public.submit_game_score(
  p_player_id uuid,
  p_device_id text,
  p_score integer,
  p_coins integer,
  p_run_id uuid
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_device text;
  v_recent int;
begin
  if p_run_id is null then
    raise exception 'run_id required';
  end if;

  select device_id into v_device from players where id = p_player_id;
  if v_device is null or v_device <> p_device_id then
    raise exception 'invalid player';
  end if;

  if p_score < 0 or p_score > 50000 then
    raise exception 'invalid score';
  end if;

  if p_coins < 0 or p_coins > 500 then
    raise exception 'invalid coins';
  end if;

  select count(*) into v_recent
  from game_scores
  where player_id = p_player_id
    and created_at > now() - interval '1 hour';

  if v_recent >= 30 then
    raise exception 'rate limited';
  end if;

  insert into game_scores (player_id, score, coins, run_id)
  values (p_player_id, p_score, p_coins, p_run_id)
  on conflict (run_id) where run_id is not null do nothing;

  return json_build_object('ok', true);
end;
$$;

revoke all on function public.get_player_by_device(text) from public;
revoke all on function public.is_username_taken(text, text) from public;
revoke all on function public.register_player(text, text) from public;
revoke all on function public.get_leaderboard(timestamptz, int) from public;
revoke all on function public.submit_game_score(uuid, text, integer, integer, uuid) from public;

grant execute on function public.get_player_by_device(text) to anon;
grant execute on function public.is_username_taken(text, text) to anon;
grant execute on function public.register_player(text, text) to anon;
grant execute on function public.get_leaderboard(timestamptz, int) to anon;
grant execute on function public.submit_game_score(uuid, text, integer, integer, uuid) to anon;

-- Remove direct client access to players (device_id was public!)
drop policy if exists "players_select" on players;
drop policy if exists "players_insert" on players;
drop policy if exists "players_update" on players;

revoke select, insert, update, delete on public.players from anon;
revoke select, insert, update, delete on public.players from authenticated;

-- game_scores: read-only for leaderboard fallback; writes only via RPC
drop policy if exists "game_scores_select" on game_scores;
create policy "game_scores_select" on game_scores for select using (true);
