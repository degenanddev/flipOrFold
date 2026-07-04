import type { PlayerSnapshot } from '../types/playerSnapshot'
import type { UserProfile } from '../types'
import { supabase, isSupabaseConfigured } from './client'
import { getDeviceId, useAuthStore } from '../store/authStore'
import { useProgressionStore } from '../store/progressionStore'
import { useShopStore } from '../store/shopStore'
import { loadJSON, saveJSON } from '../utils/storage'

const PSEUDO_KEY = 'renaiss-pseudo'
const PLAYER_ID_KEY = 'renaiss-player-id'

function parseSnapshot(data: unknown): PlayerSnapshot | null {
  if (!data || typeof data !== 'object') return null
  const snap = data as PlayerSnapshot
  if (!snap.player?.id || !snap.progression || !snap.shop) return null
  return snap
}

function toProfile(player: PlayerSnapshot['player']): UserProfile {
  return {
    id: player.id,
    username: player.username,
    created_at: player.created_at ?? new Date().toISOString(),
    walletAddress: player.walletAddress ?? null,
  }
}

function persistAuthSession(snapshot: PlayerSnapshot): void {
  saveJSON(PSEUDO_KEY, snapshot.player.username)
  saveJSON(PLAYER_ID_KEY, snapshot.player.id)
  useAuthStore.getState().setUser(toProfile(snapshot.player))
}

export function applyPlayerSnapshot(snapshot: PlayerSnapshot): void {
  const { progression, shop } = snapshot

  persistAuthSession(snapshot)

  useProgressionStore.getState().hydrate({
    totalCoins: progression.totalCoins ?? 0,
    xp: progression.xp ?? 0,
    level: progression.level ?? 1,
    highScore: progression.highScore ?? 0,
    totalRuns: progression.totalRuns ?? 0,
    lastDailyClaim: progression.lastDailyClaim ?? null,
    unlockedItems: progression.unlockedItems ?? ['char-rookie', 'trail-neon-blue'],
  })

  useShopStore.getState().hydrate({
    ownedItems: shop.ownedItems ?? [],
    equippedCharacter: shop.equippedCharacter ?? 'char-rookie',
    equippedTrail: shop.equippedTrail ?? 'trail-neon-blue',
    equippedEmote: shop.equippedEmote ?? 'emote-fake-detected',
    upgrades: shop.upgrades ?? {
      appraisalDuration: 0,
      slowTimeDuration: 0,
      insuranceBonus: 0,
      coinGain: 0,
    },
    powerupLevels: shop.powerupLevels ?? {},
  })
}

async function fetchSnapshot(deviceId: string): Promise<PlayerSnapshot | null> {
  const { data, error } = await supabase.rpc('get_player_snapshot', { p_device_id: deviceId })
  if (error) {
    console.warn('Player snapshot fetch failed:', error.message)
    return null
  }
  return parseSnapshot(data)
}

function readLocalSavePayload() {
  const progression = loadJSON<{
    totalCoins?: number
    xp?: number
    level?: number
    totalRuns?: number
    lastDailyClaim?: string | null
    unlockedItems?: string[]
  }>('progression', {})
  const shop = loadJSON<{
    ownedItems?: string[]
    equippedCharacter?: string
    equippedTrail?: string
    equippedEmote?: string
    upgrades?: Record<string, number>
    powerupLevels?: Record<string, number>
  }>('shop', {})
  const hasProgress =
    (progression.totalRuns ?? 0) > 0 ||
    (progression.totalCoins ?? 0) > 0 ||
    (progression.xp ?? 0) > 0
  if (!hasProgress) return null

  return {
    progression: {
      totalCoins: progression.totalCoins ?? 0,
      xp: progression.xp ?? 0,
      level: progression.level ?? 1,
      totalRuns: progression.totalRuns ?? 0,
      lastDailyClaim: progression.lastDailyClaim ?? null,
      unlockedItems: progression.unlockedItems ?? ['char-rookie', 'trail-neon-blue'],
    },
    shop: {
      ownedItems: shop.ownedItems ?? ['char-rookie', 'trail-neon-blue', 'emote-fake-detected'],
      equippedCharacter: shop.equippedCharacter ?? 'char-rookie',
      equippedTrail: shop.equippedTrail ?? 'trail-neon-blue',
      equippedEmote: shop.equippedEmote ?? 'emote-fake-detected',
      upgrades: shop.upgrades ?? {},
      powerupLevels: shop.powerupLevels ?? {},
    },
  }
}

/** Single source of truth load — auth + progression + shop in one API call */
export async function syncPlayerSnapshot(deviceId?: string): Promise<PlayerSnapshot | null> {
  if (!isSupabaseConfigured()) return null

  const id = deviceId ?? getDeviceId()
  let snapshot = await fetchSnapshot(id)
  if (!snapshot) return null

  const local = readLocalSavePayload()
  if (local && snapshot.progression.totalRuns === 0 && snapshot.progression.totalCoins === 0) {
    const { data, error } = await supabase.rpc('import_local_save', {
      p_device_id: id,
      p_progression: local.progression,
      p_shop: local.shop,
    })
    if (!error) snapshot = parseSnapshot(data) ?? snapshot
  }

  applyPlayerSnapshot(snapshot)
  return snapshot
}

export async function registerAndSync(username: string): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: 'Offline mode' }

  const { data, error } = await supabase.rpc('register_player', {
    p_device_id: getDeviceId(),
    p_username: username,
  })

  if (error) {
    const msg = error.message.toLowerCase()
    if (msg.includes('username taken')) return { ok: false, error: 'That name is taken — try another!' }
    if (msg.includes('username not allowed')) return { ok: false, error: 'That name is not allowed — try another!' }
    return { ok: false, error: error.message }
  }

  const snapshot = parseSnapshot(data)
  if (!snapshot) return { ok: false, error: 'Could not create account' }

  applyPlayerSnapshot(snapshot)
  return { ok: true }
}

async function applyMutationSnapshot(data: unknown): Promise<PlayerSnapshot | null> {
  const snapshot = parseSnapshot(data)
  if (!snapshot) return null
  applyPlayerSnapshot(snapshot)
  return snapshot
}

export async function completeGameRun(
  playerId: string,
  runId: string,
  score: number,
  metaCoins: number,
  xp: number
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: 'Supabase not configured' }

  const { data, error } = await supabase.rpc('complete_game_run', {
    p_player_id: playerId,
    p_device_id: getDeviceId(),
    p_run_id: runId,
    p_score: Math.round(score),
    p_meta_coins: Math.round(metaCoins),
    p_xp: Math.round(xp),
  })

  if (error) return { ok: false, error: error.message }
  if (!(await applyMutationSnapshot(data))) return { ok: false, error: 'Invalid snapshot' }
  return { ok: true }
}

export async function purchaseShopItem(itemId: string): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: 'Offline mode' }

  const { data, error } = await supabase.rpc('shop_purchase_item', {
    p_device_id: getDeviceId(),
    p_item_id: itemId,
  })

  if (error) return { ok: false, error: error.message }
  if (!(await applyMutationSnapshot(data))) return { ok: false, error: 'Invalid snapshot' }
  return { ok: true }
}

export async function equipShopItem(itemId: string): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: 'Offline mode' }

  const { data, error } = await supabase.rpc('shop_equip_item', {
    p_device_id: getDeviceId(),
    p_item_id: itemId,
  })

  if (error) return { ok: false, error: error.message }
  if (!(await applyMutationSnapshot(data))) return { ok: false, error: 'Invalid snapshot' }
  return { ok: true }
}

export async function claimDailyRewardRemote(): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: 'Offline mode' }

  const { data, error } = await supabase.rpc('claim_daily_reward', {
    p_device_id: getDeviceId(),
  })

  if (error) return { ok: false, error: error.message }
  if (!(await applyMutationSnapshot(data))) return { ok: false, error: 'Invalid snapshot' }
  return { ok: true }
}
