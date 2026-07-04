import type { PowerupType, PendingPowerupPick } from '../types'
import {
  POWERUP_DURATIONS,
  POWERUP_SPAWN_CHANCE,
  PENDING_POWERUP_TTL_MS,
  MAX_PENDING_POWERUPS,
} from '../utils/constants'
import { pickRandom } from '../utils/math'
import { getShopUpgradeValues } from './shopEffects'

const POWERUP_TYPES: PowerupType[] = [
  'slow_mo',
  'appraisal',
  'insurance',
  'double_profit',
  'cash_bonus',
]

export function maybeSpawnPowerup(): PowerupType | null {
  if (Math.random() > POWERUP_SPAWN_CHANCE) return null
  return pickRandom(POWERUP_TYPES)
}

export function expirePendingPowerups(
  picks: PendingPowerupPick[],
  now: number
): PendingPowerupPick[] {
  return picks.filter((p) => now - p.spawnedAt < PENDING_POWERUP_TTL_MS)
}

export function trySpawnPendingPowerup(
  picks: PendingPowerupPick[],
  now: number
): PendingPowerupPick[] {
  const active = expirePendingPowerups(picks, now)
  if (active.length >= MAX_PENDING_POWERUPS) return active

  const spawned = maybeSpawnPowerup()
  if (!spawned) return active

  const usedSlots = new Set(active.map((p) => p.slot))
  const slot: 0 | 1 = usedSlots.has(0) ? 1 : 0

  return [
    ...active,
    { id: crypto.randomUUID(), type: spawned, spawnedAt: now, slot },
  ]
}

function durationForType(type: PowerupType): number {
  const base = POWERUP_DURATIONS[type]
  const shop = getShopUpgradeValues()
  if (type === 'slow_mo') return base + shop.slowMoExtraMs
  if (type === 'appraisal') return base + shop.appraisalExtraMs
  return base
}

export function activatePowerup(type: PowerupType, now: number): { type: PowerupType; expiresAt: number } {
  const duration = durationForType(type)
  return {
    type,
    expiresAt: duration > 0 ? now + duration : Infinity,
  }
}

export function isPowerupActive(
  powerups: { type: PowerupType; expiresAt: number }[],
  type: PowerupType,
  now: number
): boolean {
  return powerups.some((p) => p.type === type && p.expiresAt > now)
}

export function upsertActivePowerup(
  powerups: { type: PowerupType; expiresAt: number }[],
  incoming: { type: PowerupType; expiresAt: number }
): { type: PowerupType; expiresAt: number }[] {
  return [...powerups.filter((p) => p.type !== incoming.type), incoming]
}

export function cleanExpiredPowerups(
  powerups: { type: PowerupType; expiresAt: number }[],
  now: number
): { type: PowerupType; expiresAt: number }[] {
  return powerups.filter((p) => p.expiresAt > now)
}

export function getPowerupLabel(type: PowerupType): string {
  const labels: Record<PowerupType, string> = {
    slow_mo: 'SLOW-MO',
    appraisal: 'APPRAISAL',
    insurance: 'INSURANCE',
    double_profit: '2X FLIP',
    cash_bonus: 'CASH BONUS',
  }
  return labels[type]
}

export function getPowerupIcon(type: PowerupType): string {
  const icons: Record<PowerupType, string> = {
    slow_mo: '⏱',
    appraisal: '🔎',
    insurance: '🛡',
    double_profit: '💎',
    cash_bonus: '💵',
  }
  return icons[type]
}

export function getPowerupColor(type: PowerupType): string {
  const colors: Record<PowerupType, string> = {
    slow_mo: '#4cc9f0',
    appraisal: '#9b5de5',
    insurance: '#7ec850',
    double_profit: '#ffd166',
    cash_bonus: '#22c55e',
  }
  return colors[type]
}

export function getPowerupDurationMs(type: PowerupType): number {
  return durationForType(type)
}

export function formatPowerupDuration(ms: number): string {
  if (ms <= 0 || !Number.isFinite(ms)) return ''
  const sec = Math.max(1, Math.round(ms / 1000))
  return `${sec}s`
}

/** Shown on the floating pickup button before the player taps it */
export function getPowerupPickupHint(type: PowerupType): string {
  const shop = getShopUpgradeValues()
  switch (type) {
    case 'slow_mo':
      return `${formatPowerupDuration(durationForType('slow_mo'))} slow-mo`
    case 'appraisal':
      return `${formatPowerupDuration(durationForType('appraisal'))} see true value`
    case 'insurance':
      return `1 flip · loss capped at $${shop.insuranceMaxLoss}`
    case 'double_profit':
      return `${formatPowerupDuration(durationForType('double_profit'))} 2× profit`
    case 'cash_bonus':
      return `+$${shop.cashBonusAmount} instant cash`
  }
}

/** Toast after the player collects a bonus */
export function getPowerupCollectFeedback(type: PowerupType): { title: string; detail: string } {
  const shop = getShopUpgradeValues()
  switch (type) {
    case 'slow_mo':
      return {
        title: 'Slow-mo active!',
        detail: `${formatPowerupDuration(durationForType('slow_mo'))} left — cards move slower`,
      }
    case 'appraisal':
      return {
        title: 'Appraisal active!',
        detail: `${formatPowerupDuration(durationForType('appraisal'))} left — true card values shown`,
      }
    case 'insurance':
      return {
        title: 'Insurance ready!',
        detail: `Covers your next bad flip (max loss $${shop.insuranceMaxLoss})`,
      }
    case 'double_profit':
      return {
        title: '2× profit active!',
        detail: `${formatPowerupDuration(durationForType('double_profit'))} left — wins pay double`,
      }
    case 'cash_bonus':
      return {
        title: 'Cash bonus!',
        detail: `+$${shop.cashBonusAmount} added to your balance`,
      }
  }
}

/** Label on the HUD badge while a timed bonus is running */
export function getPowerupActiveBadgeLabel(
  type: PowerupType,
  expiresAt: number,
  now: number
): string {
  if (type === 'insurance') return 'Insured · 1 flip'
  const msLeft = expiresAt - now
  if (msLeft <= 0 || !Number.isFinite(expiresAt)) return getPowerupLabel(type)
  const sec = Math.ceil(msLeft / 1000)
  return `${getPowerupLabel(type)} · ${sec}s`
}

export { CASH_BONUS_AMOUNT } from '../utils/constants'
