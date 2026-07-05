-- Auto-equip cosmetics when purchased (trails, buddies, emotes)

create or replace function public.shop_purchase_item(p_device_id text, p_item_id text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player public.players%rowtype;
  v_save public.player_saves%rowtype;
  v_item public.shop_catalog%rowtype;
  v_price integer;
  v_current_powerup integer;
  v_upgrades jsonb;
  v_owned jsonb;
begin
  select * into v_player from public.players where device_id = p_device_id;
  if not found then raise exception 'invalid player'; end if;

  select * into v_item from public.shop_catalog where id = p_item_id;
  if not found then raise exception 'unknown item'; end if;

  v_save := public.ensure_player_save(v_player.id);
  if v_save.level < v_item.unlock_level then raise exception 'level locked'; end if;

  if v_item.category = 'powerups' then
    v_current_powerup := coalesce((v_save.powerup_levels->>p_item_id)::integer, 0);
    if v_current_powerup >= 5 then raise exception 'max level'; end if;
    v_price := round(v_item.price * (1 + v_current_powerup * 0.6))::integer;
    if v_save.total_coins < v_price then raise exception 'not enough coins'; end if;

    v_upgrades := v_save.shop_upgrades;
    if v_item.upgrade_key is not null then
      v_upgrades := jsonb_set(
        v_upgrades,
        array[v_item.upgrade_key],
        to_jsonb(coalesce((v_upgrades->>v_item.upgrade_key)::integer, 0) + coalesce(v_item.bonus, 0)),
        true
      );
    end if;

    update public.player_saves set
      total_coins = total_coins - v_price,
      powerup_levels = jsonb_set(v_save.powerup_levels, array[p_item_id], to_jsonb(v_current_powerup + 1), true),
      shop_upgrades = v_upgrades,
      updated_at = now()
    where player_id = v_player.id;
  else
    v_owned := v_save.shop_owned;
    if v_owned @> jsonb_build_array(p_item_id) then raise exception 'already owned'; end if;
    if v_save.total_coins < v_item.price then raise exception 'not enough coins'; end if;

    update public.player_saves set
      total_coins = total_coins - v_item.price,
      shop_owned = v_owned || jsonb_build_array(p_item_id),
      equipped_character = case when v_item.category = 'characters' then p_item_id else equipped_character end,
      equipped_trail = case when v_item.category = 'trails' then p_item_id else equipped_trail end,
      equipped_emote = case when v_item.category = 'emotes' then p_item_id else equipped_emote end,
      updated_at = now()
    where player_id = v_player.id;
  end if;

  return public.build_player_snapshot(p_device_id);
end;
$$;

grant execute on function public.shop_purchase_item(text, text) to anon;
