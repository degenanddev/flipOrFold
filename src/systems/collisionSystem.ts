import type { Lane, WaveCard } from '../types'
import { GATE_Z, HIT_Z, LANE_X } from '../utils/constants'

/** Locked onto a lane center — use physical position. */
const LANE_SETTLED_THRESHOLD = 0.85

/**
 * Which lane counts for buying: position when settled, committed target while gliding.
 * Fixes the "ghost" dead zone in the middle without instant teleport on input.
 */
export function resolveActiveLane(playerX: number, targetLane: Lane): Lane {
  const dLeft = Math.abs(playerX - LANE_X[0])
  const dRight = Math.abs(playerX - LANE_X[1])
  if (dLeft < LANE_SETTLED_THRESHOLD) return 0
  if (dRight < LANE_SETTLED_THRESHOLD) return 1
  return targetLane
}

export function checkCardCollision(playerX: number, targetLane: Lane, card: WaveCard): boolean {
  if (card.hit || card.missed) return false
  const zMatch = card.z >= HIT_Z - 0.5 && card.z <= GATE_Z + 1
  if (!zMatch) return false
  return resolveActiveLane(playerX, targetLane) === card.lane
}

export function checkMissedCards(cards: WaveCard[]): WaveCard[] {
  return cards.filter((c) => !c.hit && !c.missed && c.z > GATE_Z + 0.5)
}

export function findFakeInWave(_cards: WaveCard[]): WaveCard | undefined {
  return undefined
}
