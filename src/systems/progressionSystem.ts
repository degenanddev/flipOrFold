import { LEVEL_XP_BASE, LEVEL_XP_MULTIPLIER } from '../utils/constants'

export function xpRequiredForLevel(level: number): number {
  return Math.floor(LEVEL_XP_BASE * Math.pow(LEVEL_XP_MULTIPLIER, level - 1))
}

export function addXP(currentXP: number, currentLevel: number, amount: number): {
  xp: number
  level: number
  leveledUp: boolean
} {
  let xp = currentXP + amount
  let level = currentLevel
  let leveledUp = false

  while (xp >= xpRequiredForLevel(level)) {
    xp -= xpRequiredForLevel(level)
    level++
    leveledUp = true
  }

  return { xp, level, leveledUp }
}

export function getLevelProgress(xp: number, level: number): number {
  const required = xpRequiredForLevel(level)
  return required > 0 ? xp / required : 0
}

export function getUnlocksForLevel(level: number): string[] {
  const unlocks: string[] = []
  if (level >= 2) unlocks.push('char-specialist')
  if (level >= 3) unlocks.push('trail-neon-blue')
  if (level >= 5) unlocks.push('char-inspector')
  if (level >= 7) unlocks.push('trail-purple-scan')
  if (level >= 10) unlocks.push('char-elite')
  if (level >= 12) unlocks.push('trail-gold')
  if (level >= 15) unlocks.push('trail-holo')
  if (level >= 5) unlocks.push('emote-fake-detected')
  if (level >= 8) unlocks.push('emote-verified')
  if (level >= 12) unlocks.push('emote-nice-try')
  return unlocks
}

export function canClaimDailyReward(lastClaim: string | null): boolean {
  if (!lastClaim) return true
  const last = new Date(lastClaim)
  const now = new Date()
  return (
    last.getFullYear() !== now.getFullYear() ||
    last.getMonth() !== now.getMonth() ||
    last.getDate() !== now.getDate()
  )
}
