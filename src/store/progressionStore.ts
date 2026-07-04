import { create } from 'zustand'
import { DAILY_REWARD_COINS, DAILY_REWARD_XP } from '../utils/constants'
import { addXP, canClaimDailyReward, getUnlocksForLevel } from '../systems/progressionSystem'
import { isSupabaseConfigured } from '../supabase/client'
import { claimDailyRewardRemote } from '../supabase/playerSnapshot'
import { loadJSON, saveJSON } from '../utils/storage'

export interface ProgressionHydrate {
  totalCoins: number
  xp: number
  level: number
  highScore: number
  totalRuns: number
  lastDailyClaim: string | null
  unlockedItems: string[]
}

interface ProgressionState extends ProgressionHydrate {
  addRunResults: (coins: number, xp: number) => void
  updateHighScore: (score: number) => void
  setHighScore: (score: number) => void
  spendCoins: (amount: number) => boolean
  claimDailyReward: () => Promise<{ coins: number; xp: number } | null>
  hydrate: (data: ProgressionHydrate) => void
  loadLocal: () => void
  saveLocal: () => void
}

const DEFAULT_UNLOCKS = ['char-rookie', 'trail-neon-blue']

export const useProgressionStore = create<ProgressionState>((set, get) => ({
  totalCoins: 0,
  xp: 0,
  level: 1,
  highScore: 0,
  totalRuns: 0,
  lastDailyClaim: null,
  unlockedItems: DEFAULT_UNLOCKS,

  hydrate: (data) => {
    set({
      totalCoins: data.totalCoins,
      xp: data.xp,
      level: data.level,
      highScore: data.highScore,
      totalRuns: data.totalRuns,
      lastDailyClaim: data.lastDailyClaim,
      unlockedItems: data.unlockedItems,
    })
  },

  loadLocal: () => {
    const data = loadJSON<Partial<ProgressionHydrate>>('progression', {})
    set({
      totalCoins: data.totalCoins ?? 0,
      xp: data.xp ?? 0,
      level: data.level ?? 1,
      highScore: data.highScore ?? 0,
      totalRuns: data.totalRuns ?? 0,
      lastDailyClaim: data.lastDailyClaim ?? null,
      unlockedItems: data.unlockedItems ?? DEFAULT_UNLOCKS,
    })
  },

  saveLocal: () => {
    if (isSupabaseConfigured()) return
    const state = get()
    saveJSON('progression', {
      totalCoins: state.totalCoins,
      xp: state.xp,
      level: state.level,
      highScore: state.highScore,
      totalRuns: state.totalRuns,
      lastDailyClaim: state.lastDailyClaim,
      unlockedItems: state.unlockedItems,
    })
  },

  addRunResults: (coins, xpAmount) => {
    if (isSupabaseConfigured()) return

    const { xp, level, leveledUp } = addXP(get().xp, get().level, xpAmount)
    const unlocks = getUnlocksForLevel(level)
    const unlockedItems = [...new Set([...get().unlockedItems, ...unlocks])]

    set((s) => ({
      totalCoins: s.totalCoins + coins,
      xp,
      level,
      totalRuns: s.totalRuns + 1,
      unlockedItems,
    }))

    if (leveledUp) {
      // unlocks merged above
    }

    get().saveLocal()
  },

  updateHighScore: (score: number) => {
    if (score > get().highScore) {
      set({ highScore: score })
      get().saveLocal()
    }
  },

  setHighScore: (score: number) => {
    if (score <= 0) return
    if (score !== get().highScore) {
      set({ highScore: score })
      get().saveLocal()
    }
  },

  spendCoins: (amount) => {
    if (isSupabaseConfigured()) return false
    if (get().totalCoins < amount) return false
    set((s) => ({ totalCoins: s.totalCoins - amount }))
    get().saveLocal()
    return true
  },

  claimDailyReward: async () => {
    if (!canClaimDailyReward(get().lastDailyClaim)) return null

    if (isSupabaseConfigured()) {
      const res = await claimDailyRewardRemote()
      return res.ok ? { coins: DAILY_REWARD_COINS, xp: DAILY_REWARD_XP } : null
    }

    const now = new Date().toISOString()
    const { xp, level } = addXP(get().xp, get().level, DAILY_REWARD_XP)

    set((s) => ({
      totalCoins: s.totalCoins + DAILY_REWARD_COINS,
      xp,
      level,
      lastDailyClaim: now,
    }))
    get().saveLocal()

    return { coins: DAILY_REWARD_COINS, xp: DAILY_REWARD_XP }
  },
}))
