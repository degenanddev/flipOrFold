import { create } from 'zustand'
import type { ShopCategory } from '../types'
import { isSupabaseConfigured } from '../supabase/client'
import { equipShopItem, purchaseShopItem } from '../supabase/playerSnapshot'
import { loadJSON, saveJSON } from '../utils/storage'
import { useProgressionStore } from './progressionStore'

export interface ShopItemDef {
  id: string
  name: string
  description: string
  category: ShopCategory
  price: number
  unlockLevel: number
  icon: string
  meta?: Record<string, string | number>
}

export const SHOP_ITEMS: ShopItemDef[] = [
  {
    id: 'char-rookie',
    name: 'Rookie Trainer',
    description: 'Your first adventure buddy!',
    category: 'characters',
    price: 0,
    unlockLevel: 1,
    icon: '🌟',
    meta: { color: '#ff6b9d' },
  },
  {
    id: 'char-specialist',
    name: 'Sparkle Scout',
    description: 'Sharp instincts for spotting bargains!',
    category: 'characters',
    price: 500,
    unlockLevel: 2,
    icon: '🔮',
    meta: { color: '#9b5de5' },
  },
  {
    id: 'char-inspector',
    name: 'Card Captain',
    description: 'A pro collector with super instincts.',
    category: 'characters',
    price: 1500,
    unlockLevel: 5,
    icon: '⭐',
    meta: { color: '#ffd166' },
  },
  {
    id: 'char-elite',
    name: 'Legend Hunter',
    description: 'The ultimate card-flipping legend!',
    category: 'characters',
    price: 5000,
    unlockLevel: 10,
    icon: '👑',
    meta: { color: '#4cc9f0' },
  },
  {
    id: 'trail-neon-blue',
    name: 'Neon Blue Trail',
    description: 'Classic neon flip glow.',
    category: 'trails',
    price: 300,
    unlockLevel: 3,
    icon: '💠',
    meta: { trailColor: '#00d4ff' },
  },
  {
    id: 'trail-purple-scan',
    name: 'Purple Scan Trail',
    description: 'Deep scan particle trail.',
    category: 'trails',
    price: 800,
    unlockLevel: 7,
    icon: '🔮',
    meta: { trailColor: '#a855f7' },
  },
  {
    id: 'trail-gold',
    name: 'Gold Auth Trail',
    description: 'Premium verified particle stream.',
    category: 'trails',
    price: 2000,
    unlockLevel: 12,
    icon: '✨',
    meta: { trailColor: '#f59e0b' },
  },
  {
    id: 'trail-holo',
    name: 'Holographic Trail',
    description: 'Rainbow holographic authentication trail.',
    category: 'trails',
    price: 4000,
    unlockLevel: 15,
    icon: '🌈',
    meta: { trailColor: '#22d3ee' },
  },
  {
    id: 'upgrade-scanner',
    name: 'Extended Appraisal',
    description: '+4s market value reveal per level.',
    category: 'powerups',
    price: 600,
    unlockLevel: 4,
    icon: '🔍',
    meta: { upgradeKey: 'appraisalDuration', bonus: 4 },
  },
  {
    id: 'upgrade-slowtime',
    name: 'Extended Slow Time',
    description: '+4s slow time duration per level.',
    category: 'powerups',
    price: 600,
    unlockLevel: 4,
    icon: '⏱',
    meta: { upgradeKey: 'slowTimeDuration', bonus: 4 },
  },
  {
    id: 'upgrade-coins',
    name: 'Profit Amplifier',
    description: '+10% meta coin rewards per level.',
    category: 'powerups',
    price: 800,
    unlockLevel: 5,
    icon: '🪙',
    meta: { upgradeKey: 'coinGain', bonus: 1 },
  },
  {
    id: 'upgrade-shield',
    name: 'Trade Insurance+',
    description: 'Caps bad deal losses — $15 less per level.',
    category: 'powerups',
    price: 1000,
    unlockLevel: 6,
    icon: '🛡',
    meta: { upgradeKey: 'insuranceBonus', bonus: 1 },
  },
  {
    id: 'emote-fake-detected',
    name: 'Rip-off!',
    description: 'Flaunt a bad deal emote after trades.',
    category: 'emotes',
    price: 200,
    unlockLevel: 5,
    icon: '🚨',
    meta: { emote: 'Rip-off!' },
  },
  {
    id: 'emote-verified',
    name: 'Verified Flip',
    description: 'Celebrate a legit bargain.',
    category: 'emotes',
    price: 200,
    unlockLevel: 8,
    icon: '✅',
    meta: { emote: 'Legit flip!' },
  },
  {
    id: 'emote-nice-try',
    name: 'Nice Try',
    description: 'Taunt overpriced cards.',
    category: 'emotes',
    price: 200,
    unlockLevel: 12,
    icon: '😏',
    meta: { emote: 'Nice try!' },
  },
]

export const POWERUP_MAX_LEVEL = 5

const POWERUP_ITEM_IDS = new Set(
  SHOP_ITEMS.filter((i) => i.category === 'powerups').map((i) => i.id)
)

export function getPowerupUpgradePrice(item: ShopItemDef, currentLevel: number): number {
  if (item.price === 0) return 0
  return Math.round(item.price * (1 + currentLevel * 0.6))
}

interface ShopUpgrades {
  appraisalDuration: number
  slowTimeDuration: number
  insuranceBonus: number
  coinGain: number
}

export interface ShopHydrate {
  ownedItems: string[]
  equippedCharacter: string
  equippedTrail: string
  equippedEmote: string
  upgrades: ShopUpgrades
  powerupLevels: Record<string, number>
}

interface ShopState extends ShopHydrate {
  purchaseItem: (itemId: string) => Promise<boolean>
  equipItem: (itemId: string) => Promise<boolean>
  getItemsByCategory: (category: ShopCategory) => ShopItemDef[]
  isOwned: (itemId: string) => boolean
  getPowerupLevel: (itemId: string) => number
  getPowerupPrice: (itemId: string) => number
  hydrate: (data: ShopHydrate) => void
  loadLocal: () => void
  saveLocal: () => void
}

const DEFAULT_OWNED = ['char-rookie', 'trail-neon-blue', 'emote-fake-detected']

export const useShopStore = create<ShopState>((set, get) => ({
  ownedItems: DEFAULT_OWNED,
  equippedCharacter: 'char-rookie',
  equippedTrail: 'trail-neon-blue',
  equippedEmote: 'emote-fake-detected',
  upgrades: { appraisalDuration: 0, slowTimeDuration: 0, insuranceBonus: 0, coinGain: 0 },
  powerupLevels: {},

  hydrate: (data) => {
    const raw = data.upgrades ?? {
      appraisalDuration: 0,
      slowTimeDuration: 0,
      insuranceBonus: 0,
      coinGain: 0,
    }
    set({
      ownedItems: (data.ownedItems ?? DEFAULT_OWNED).filter((id) => !POWERUP_ITEM_IDS.has(id)),
      equippedCharacter: data.equippedCharacter ?? 'char-rookie',
      equippedTrail: data.equippedTrail ?? 'trail-neon-blue',
      equippedEmote: data.equippedEmote ?? 'emote-fake-detected',
      upgrades: {
        appraisalDuration: raw.appraisalDuration ?? 0,
        slowTimeDuration: raw.slowTimeDuration ?? 0,
        insuranceBonus: raw.insuranceBonus ?? 0,
        coinGain: raw.coinGain ?? 0,
      },
      powerupLevels: data.powerupLevels ?? {},
    })
  },

  loadLocal: () => {
    const data = loadJSON<Partial<ShopState> & { upgrades?: Record<string, number> }>('shop', {})
    const raw = (data.upgrades ?? {}) as Record<string, number>
    const ownedItems = (data.ownedItems ?? DEFAULT_OWNED).filter((id) => !POWERUP_ITEM_IDS.has(id))
    let powerupLevels = { ...(data.powerupLevels ?? {}) }

    for (const id of data.ownedItems ?? []) {
      if (POWERUP_ITEM_IDS.has(id) && !powerupLevels[id]) {
        powerupLevels[id] = 1
      }
    }

    set({
      ownedItems,
      equippedCharacter: data.equippedCharacter ?? 'char-rookie',
      equippedTrail: data.equippedTrail ?? 'trail-neon-blue',
      equippedEmote: data.equippedEmote ?? 'emote-fake-detected',
      upgrades: {
        appraisalDuration: raw.appraisalDuration ?? raw.scannerDuration ?? 0,
        slowTimeDuration: raw.slowTimeDuration ?? 0,
        insuranceBonus: raw.insuranceBonus ?? raw.extraShield ?? 0,
        coinGain: raw.coinGain ?? 0,
      },
      powerupLevels,
    })
  },

  saveLocal: () => {
    if (isSupabaseConfigured()) return
    const { ownedItems, equippedCharacter, equippedTrail, equippedEmote, upgrades, powerupLevels } = get()
    saveJSON('shop', { ownedItems, equippedCharacter, equippedTrail, equippedEmote, upgrades, powerupLevels })
  },

  getItemsByCategory: (category) => SHOP_ITEMS.filter((i) => i.category === category),

  isOwned: (itemId) => {
    const item = SHOP_ITEMS.find((i) => i.id === itemId)
    if (item?.category === 'powerups') {
      return get().getPowerupLevel(itemId) >= POWERUP_MAX_LEVEL
    }
    return get().ownedItems.includes(itemId)
  },

  getPowerupLevel: (itemId) => get().powerupLevels[itemId] ?? 0,

  getPowerupPrice: (itemId) => {
    const item = SHOP_ITEMS.find((i) => i.id === itemId)
    if (!item) return 0
    return getPowerupUpgradePrice(item, get().getPowerupLevel(itemId))
  },

  purchaseItem: async (itemId) => {
    if (isSupabaseConfigured()) {
      const res = await purchaseShopItem(itemId)
      return res.ok
    }

    const item = SHOP_ITEMS.find((i) => i.id === itemId)
    if (!item) return false

    const { level } = useProgressionStore.getState()
    if (level < item.unlockLevel) return false

    if (item.category === 'powerups') {
      const currentLevel = get().getPowerupLevel(itemId)
      if (currentLevel >= POWERUP_MAX_LEVEL) return false

      const price = get().getPowerupPrice(itemId)
      const spent = useProgressionStore.getState().spendCoins(price)
      if (!spent) return false

      const key = item.meta?.upgradeKey as keyof ShopUpgrades | undefined
      const bonus = (item.meta?.bonus as number) ?? 0
      const upgrades = key
        ? { ...get().upgrades, [key]: get().upgrades[key] + bonus }
        : get().upgrades

      set({
        powerupLevels: { ...get().powerupLevels, [itemId]: currentLevel + 1 },
        upgrades,
      })
      get().saveLocal()
      return true
    }

    if (get().ownedItems.includes(itemId)) return false

    const spent = useProgressionStore.getState().spendCoins(item.price)
    if (!spent) return false

    const ownedItems = [...get().ownedItems, itemId]
    const equipPatch: Partial<ShopHydrate> = { ownedItems }
    if (item.category === 'characters') equipPatch.equippedCharacter = itemId
    if (item.category === 'trails') equipPatch.equippedTrail = itemId
    if (item.category === 'emotes') equipPatch.equippedEmote = itemId

    set(equipPatch)
    get().saveLocal()
    return true
  },

  equipItem: async (itemId) => {
    if (isSupabaseConfigured()) {
      const res = await equipShopItem(itemId)
      return res.ok
    }

    const item = SHOP_ITEMS.find((i) => i.id === itemId)
    if (!item || item.category === 'powerups') return false
    if (!get().ownedItems.includes(itemId)) return false

    if (item.category === 'characters') set({ equippedCharacter: itemId })
    if (item.category === 'trails') set({ equippedTrail: itemId })
    if (item.category === 'emotes') set({ equippedEmote: itemId })
    get().saveLocal()
    return true
  },
}))
