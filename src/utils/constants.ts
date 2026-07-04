import type { Lane, Rarity } from '../types'

/** Global pace tuning — 2× faster lane runner feel */
export const GAME_SPEED_MULTIPLIER = 2

export const LANES: Lane[] = [0, 1]
export const LANE_X: Record<Lane, number> = { 0: -2.2, 1: 2.2 }
/** How close (world X) the player must be to a lane center to buy that card */
export const LANE_HIT_RADIUS = 1.1
/** Seconds to glide between lanes */
export const LANE_MOVE_SMOOTH_SEC = 0.08
/** Snap the last bit of travel so the buddy settles cleanly on the lane */
export const LANE_SNAP_EPSILON = 0.06

export const STARTING_BALANCE = 1000
export const GAME_DURATION_SEC = 60
export const COUNTDOWN_SECONDS = 2
export const COUNTDOWN_TICK_MS = 500

export const BASE_CARD_SPEED = 13
export const SPEED_INCREASE_INTERVAL = 4
export const SPEED_INCREASE_AMOUNT = 0.7

export const PLAYER_Z = 0
export const SPAWN_Z = -32
export const GATE_Z = -2
export const HIT_Z = -1.5
/** World Y for the bottom edge of card billboards (scales upward from here) */
export const CARD_FLOAT_Y = 2.65

export const WAVE_COOLDOWN_MS = 300

export const POWERUP_DURATIONS = {
  slow_mo: 6000,
  appraisal: 8000,
  insurance: 0,
  double_profit: 12000,
  cash_bonus: 0,
} as const

export const POWERUP_SPAWN_CHANCE = 0.22
export const PENDING_POWERUP_TTL_MS = 2500
export const MAX_PENDING_POWERUPS = 2
export const INSURANCE_MAX_LOSS = 40
export const CASH_BONUS_AMOUNT = 75

/** Leaderboard / anti-cheat bounds (must match Supabase RPC) */
export const MAX_SUBMIT_SCORE = 50000
export const MAX_SUBMIT_COINS = 500

export const RARITY_COLORS: Record<Rarity, string> = {
  common: '#94a3b8',
  rare: '#60a5fa',
  epic: '#c084fc',
  legendary: '#fbbf24',
}

export const XP_PER_DOLLAR_PROFIT = 0.05
export const XP_PER_TRADE = 3

export const DAILY_REWARD_COINS = 50
export const DAILY_REWARD_XP = 25

export const LEVEL_XP_BASE = 100
export const LEVEL_XP_MULTIPLIER = 1.35
