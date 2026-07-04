-- Fetch a player's all-time best score (not limited to global top-N)
create or replace function public.get_player_best_score(p_player_id uuid)
returns integer
language sql
security definer
set search_path = public
as $$
  select coalesce(max(score), 0)::integer
  from game_scores
  where player_id = p_player_id;
$$;

revoke all on function public.get_player_best_score(uuid) from public;
grant execute on function public.get_player_best_score(uuid) to anon;
