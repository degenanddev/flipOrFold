-- Username ban list + character allowlist (server-side enforcement)

create or replace function public.normalize_username_key(p_username text)
returns text
language sql
immutable
as $$
  select lower(
    regexp_replace(
      translate(
        trim(p_username),
        '013457@$',
        'oieastas'
      ),
      '[^a-zA-Z0-9]',
      '',
      'g'
    )
  );
$$;

create or replace function public.is_username_banned(p_username text)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
declare
  v_key text;
  v_banned text[] := array[
    'admin', 'administrator', 'moderator', 'modteam', 'staff', 'support', 'helpdesk',
    'official', 'system', 'root', 'superuser', 'owner', 'developer', 'devteam',
    'renaiss', 'fliporfold', 'flipfold', 'null', 'undefined', 'anonymous', 'guest',
    'deleted', 'banned', 'hacked', 'hack', 'cheater', 'cheat', 'bot', 'npc', 'testuser',
    'nigger', 'nigga', 'faggot', 'fag', 'retard', 'retarded', 'kike', 'chink', 'spic', 'tranny',
    'select', 'drop table', 'script', 'javascript'
  ];
  v_word text;
begin
  v_key := public.normalize_username_key(p_username);
  if v_key is null or length(v_key) < 2 then
    return false;
  end if;

  if v_key ~ '^(admin|mod|staff|support|official|system|root|renaiss|fliporfold)' then
    return true;
  end if;

  foreach v_word in array v_banned loop
    if length(v_word) <= 3 then
      if v_key = v_word then return true; end if;
    elsif position(v_word in v_key) > 0 then
      return true;
    end if;
  end loop;

  return false;
end;
$$;

create or replace function public.is_username_allowed(p_username text)
returns boolean
language sql
immutable
as $$
  select
    length(trim(p_username)) >= 2
    and trim(p_username) !~ '[<>;"''\\]'
    and trim(p_username) !~ '^\s|\s$'
    and not public.is_username_banned(p_username);
$$;

create or replace function public.is_username_taken(p_username text, p_device_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_username_allowed(p_username) then
    return true;
  end if;

  return exists (
    select 1 from public.players
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

  if not public.is_username_allowed(v_username) then
    raise exception 'username not allowed';
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

revoke all on function public.normalize_username_key(text) from public;
revoke all on function public.is_username_banned(text) from public;
revoke all on function public.is_username_allowed(text) from public;

grant execute on function public.is_username_taken(text, text) to anon;
grant execute on function public.register_player(text, text) to anon;
