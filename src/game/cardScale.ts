import { SPAWN_Z, PLAYER_Z } from '../utils/constants'

/** Cards start large at spawn and ease to normal size near the player */
export function getCardScale(z: number): number {
  const base = 2.8
  const spawnDist = Math.abs(SPAWN_Z - PLAYER_Z)
  const distFromPlayer = PLAYER_Z - z
  const t = clamp01(distFromPlayer / spawnDist)
  // Bigger when far (t→1), normal when close (t→0)
  const farBoost = 1 + t * 1.85
  return base * farBoost
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v))
}
