-- Secure score submission + idempotent runs

alter table game_scores add column if not exists run_id uuid;

create unique index if not exists game_scores_run_id_uidx
  on game_scores (run_id)
  where run_id is not null;

-- Remove direct client inserts (must use RPC)
drop policy if exists "game_scores_insert" on game_scores;

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

  if p_coins < 0 or p_coins > 10000 then
    raise exception 'invalid coins';
  end if;

  insert into game_scores (player_id, score, coins, run_id)
  values (p_player_id, p_score, p_coins, p_run_id)
  on conflict (run_id) where run_id is not null do nothing;

  return json_build_object('ok', true);
end;
$$;

revoke all on function public.submit_game_score(uuid, text, integer, integer, uuid) from public;
grant execute on function public.submit_game_score(uuid, text, integer, integer, uuid) to anon;
