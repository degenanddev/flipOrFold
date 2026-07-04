export interface PlayerSnapshotProgression {
  totalCoins: number
  xp: number
  level: number
  totalRuns: number
  lastDailyClaim: string | null
  unlockedItems: string[]
  highScore: number
}

export interface PlayerSnapshotShop {
  ownedItems: string[]
  equippedCharacter: string
  equippedTrail: string
  equippedEmote: string
  upgrades: {
    appraisalDuration: number
    slowTimeDuration: number
    insuranceBonus: number
    coinGain: number
  }
  powerupLevels: Record<string, number>
}

export interface PlayerSnapshot {
  player: {
    id: string
    username: string
    created_at: string
    walletAddress?: string | null
  }
  progression: PlayerSnapshotProgression
  shop: PlayerSnapshotShop
}
