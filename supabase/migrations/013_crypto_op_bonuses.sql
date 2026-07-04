-- OP crypto bonuses + legendary apply logic

alter table public.crypto_bonus_catalog
  drop constraint if exists crypto_bonus_catalog_bonus_type_check;

alter table public.crypto_bonus_catalog
  add constraint crypto_bonus_catalog_bonus_type_check
  check (bonus_type in ('coins', 'xp', 'pack', 'legendary'));

insert into public.crypto_bonus_catalog (id, name, description, icon, price_wei, bonus_type, bonus_payload, sort_order) values
  (
    'crypto-whale-vault',
    'Whale Vault',
    '+3,000 coins — 4× the basic surge',
    '🐋',
    1000000000000000,
    'coins',
    '{"coins": 3000}'::jsonb,
    10
  ),
  (
    'crypto-level-skip',
    'Level Skip',
    '+500 XP — skip the grind',
    '🎯',
    1500000000000000,
    'xp',
    '{"xp": 500}'::jsonb,
    11
  ),
  (
    'crypto-god-mode',
    'Ultra Mode Pack',
    '+2,000 coins, +250 XP & +2 to ALL run upgrades',
    '👑',
    2000000000000000,
    'legendary',
    '{
      "coins": 2000,
      "xp": 250,
      "upgrades": {
        "appraisalDuration": 2,
        "slowTimeDuration": 2,
        "insuranceBonus": 2,
        "coinGain": 2
      }
    }'::jsonb,
    12
  ),
  (
    'crypto-collector-unlock',
    'Collector''s Crown',
    'Unlock Legend Hunter, Holo Trail & Nice Try emote + 1,500 coins',
    '🏆',
    2500000000000000,
    'legendary',
    '{
      "coins": 1500,
      "xp": 100,
      "unlockItems": ["char-elite", "trail-holo", "emote-nice-try"]
    }'::jsonb,
    13
  ),
  (
    'crypto-max-power',
    'Max Power Surge',
    '+2 levels on every power-up (scanner, slow-mo, coins, shield)',
    '💥',
    3000000000000000,
    'legendary',
    '{
      "coins": 500,
      "powerupLevels": {
        "upgrade-scanner": 2,
        "upgrade-slowtime": 2,
        "upgrade-coins": 2,
        "upgrade-shield": 2
      }
    }'::jsonb,
    14
  )
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  icon = excluded.icon,
  price_wei = excluded.price_wei,
  bonus_type = excluded.bonus_type,
  bonus_payload = excluded.bonus_payload,
  sort_order = excluded.sort_order;

create or replace function public.apply_crypto_bonus(p_player_id uuid, p_item_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.crypto_bonus_catalog%rowtype;
  v_save public.player_saves%rowtype;
  v_applied record;
  v_coins integer;
  v_xp integer;
  v_coin_gain integer;
  v_unlocks jsonb;
  v_upgrades jsonb;
  v_key text;
  v_val integer;
  v_cur integer;
  v_owned jsonb;
  v_unlock text;
  v_puid text;
  v_plv integer;
  v_item_row public.shop_catalog%rowtype;
begin
  select * into v_item from public.crypto_bonus_catalog where id = p_item_id;
  if not found then raise exception 'unknown item'; end if;

  v_save := public.ensure_player_save(p_player_id);

  if v_item.bonus_type = 'coins' then
    v_coins := coalesce((v_item.bonus_payload->>'coins')::integer, 0);
    update public.player_saves
    set total_coins = least(total_coins + v_coins, 999999), updated_at = now()
    where player_id = p_player_id;

  elsif v_item.bonus_type = 'xp' then
    v_xp := coalesce((v_item.bonus_payload->>'xp')::integer, 0);
    select * into v_applied from public.apply_xp_to_save(v_save.level, v_save.xp, v_xp);
    v_unlocks := public.unlocks_for_level(v_applied.out_level);
    update public.player_saves set
      xp = v_applied.out_xp,
      level = v_applied.out_level,
      unlocked_items = (
        select coalesce(jsonb_agg(distinct x), '[]'::jsonb)
        from jsonb_array_elements(coalesce(unlocked_items, '[]'::jsonb) || v_unlocks) as t(x)
      ),
      updated_at = now()
    where player_id = p_player_id;

  elsif v_item.bonus_type = 'pack' then
    v_coins := coalesce((v_item.bonus_payload->>'coins')::integer, 0);
    v_xp := coalesce((v_item.bonus_payload->>'xp')::integer, 0);
    v_coin_gain := coalesce((v_item.bonus_payload->>'coinGain')::integer, 0);

    select * into v_applied from public.apply_xp_to_save(v_save.level, v_save.xp, v_xp);
    v_unlocks := public.unlocks_for_level(v_applied.out_level);

    update public.player_saves set
      total_coins = least(total_coins + v_coins, 999999),
      xp = v_applied.out_xp,
      level = v_applied.out_level,
      unlocked_items = (
        select coalesce(jsonb_agg(distinct x), '[]'::jsonb)
        from jsonb_array_elements(coalesce(unlocked_items, '[]'::jsonb) || v_unlocks) as t(x)
      ),
      shop_upgrades = jsonb_set(
        shop_upgrades,
        '{coinGain}',
        to_jsonb(least(coalesce((shop_upgrades->>'coinGain')::integer, 0) + v_coin_gain, 10)),
        true
      ),
      updated_at = now()
    where player_id = p_player_id;

  elsif v_item.bonus_type = 'legendary' then
    v_coins := coalesce((v_item.bonus_payload->>'coins')::integer, 0);
    v_xp := coalesce((v_item.bonus_payload->>'xp')::integer, 0);
    v_upgrades := coalesce(v_item.bonus_payload->'upgrades', '{}'::jsonb);

    select * into v_applied from public.apply_xp_to_save(v_save.level, v_save.xp, v_xp);
    v_unlocks := public.unlocks_for_level(v_applied.out_level);

    select * into v_save from public.player_saves where player_id = p_player_id;
    v_owned := coalesce(v_save.shop_owned, '[]'::jsonb);

    if v_item.bonus_payload ? 'unlockItems' then
      for v_unlock in select jsonb_array_elements_text(v_item.bonus_payload->'unlockItems')
      loop
        if not v_owned @> jsonb_build_array(v_unlock) then
          v_owned := v_owned || jsonb_build_array(v_unlock);
        end if;
      end loop;
    end if;

    v_upgrades := coalesce(v_save.shop_upgrades, '{}'::jsonb);
    for v_key, v_val in select * from jsonb_each_text(coalesce(v_item.bonus_payload->'upgrades', '{}'::jsonb))
    loop
      v_cur := coalesce((v_upgrades->>v_key)::integer, 0);
      v_upgrades := jsonb_set(v_upgrades, array[v_key], to_jsonb(least(v_cur + v_val::integer, 10)), true);
    end loop;

    if v_item.bonus_payload ? 'powerupLevels' then
      for v_puid, v_val in select key, value from jsonb_each_text(v_item.bonus_payload->'powerupLevels')
      loop
        v_plv := coalesce((v_save.powerup_levels->>v_puid)::integer, 0);
        v_save.powerup_levels := jsonb_set(
          coalesce(v_save.powerup_levels, '{}'::jsonb),
          array[v_puid],
          to_jsonb(least(v_plv + v_val::integer, 5)),
          true
        );

        select * into v_item_row from public.shop_catalog where id = v_puid;
        if found and v_item_row.upgrade_key is not null then
          v_cur := coalesce((v_upgrades->>v_item_row.upgrade_key)::integer, 0);
          v_upgrades := jsonb_set(
            v_upgrades,
            array[v_item_row.upgrade_key],
            to_jsonb(least(v_cur + (v_val::integer * coalesce(v_item_row.bonus, 1)), 20)),
            true
          );
        end if;
      end loop;
    end if;

    update public.player_saves set
      total_coins = least(total_coins + v_coins, 999999),
      xp = v_applied.out_xp,
      level = v_applied.out_level,
      unlocked_items = (
        select coalesce(jsonb_agg(distinct x), '[]'::jsonb)
        from jsonb_array_elements(
          coalesce(unlocked_items, '[]'::jsonb) || v_unlocks ||
          coalesce(v_item.bonus_payload->'unlockItems', '[]'::jsonb)
        ) as t(x)
      ),
      shop_owned = v_owned,
      shop_upgrades = v_upgrades,
      powerup_levels = coalesce(v_save.powerup_levels, '{}'::jsonb),
      updated_at = now()
    where player_id = p_player_id;
  end if;
end;
$$;

revoke all on function public.apply_crypto_bonus(uuid, text) from public;
grant execute on function public.apply_crypto_bonus(uuid, text) to service_role;
