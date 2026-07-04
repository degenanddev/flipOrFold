export type Lane = 0 | 1

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary'

export type PowerupType =
  | 'slow_mo'
  | 'appraisal'
  | 'insurance'
  | 'double_profit'
  | 'cash_bonus'

export type ShopCategory = 'characters' | 'trails' | 'powerups' | 'emotes'

export type Screen = 'menu' | 'game' | 'shop' | 'leaderboard' | 'profile' | 'gameover' | 'carddex'

export type LeaderboardPeriod = 'daily' | 'weekly' | 'alltime'

export type GameEndReason = 'bankrupt' | 'timeout'

export interface CardData {
  id: string
  image: string
  rarity: Rarity
  name: string
  set?: string
  marketPrice: number
  /** Renaiss game slug: pokemon, one-piece, etc. */
  game?: string
  gradeLabel?: string
}

export interface WaveCard {
  id: string
  lane: Lane
  card: CardData
  displayPrice: number
  z: number
  hit: boolean
  missed: boolean
}

export interface Wave {
  id: number
  cards: WaveCard[]
  resolved: boolean
}

export interface ActivePowerup {
  type: PowerupType
  expiresAt: number
}

export interface ShopItem {
  id: string
  name: string
  description: string
  category: ShopCategory
  price: number
  unlockLevel: number
  icon: string
}

export interface LeaderboardEntry {
  id: string
  username: string
  score: number
  coins: number
  created_at: string
}

export interface UserProfile {
  id: string
  username: string
  created_at: string
  walletAddress?: string | null
}

export interface GameRunStats {
  runId: string
  finalBalance: number
  startingBalance: number
  profit: number
  tradesCount: number
  bestTrade: number
  worstTrade: number
  endReason: GameEndReason
  xpEarned: number
  metaCoinsEarned: number
}

export interface CameraShake {
  intensity: number
  duration: number
  startTime: number
}

export interface PendingPowerupPick {
  id: string
  type: PowerupType
  spawnedAt: number
  slot: 0 | 1
}

export interface TradeFeedback {
  amount: number
  cardName: string
  displayPrice: number
  marketPrice: number
  shownAt: number
  emote?: string
}

export interface PowerupFeedback {
  title: string
  detail: string
  icon: string
  color: string
  shownAt: number
}
