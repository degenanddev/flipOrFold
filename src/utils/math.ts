import type { Lane } from '../types'
import { LANE_X } from './constants'

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/** Frame-rate independent ease toward a target (exponential decay). */
export function smoothApproach(current: number, target: number, delta: number, smoothSec: number): number {
  if (smoothSec <= 0) return target
  const t = 1 - Math.exp(-delta / smoothSec)
  return current + (target - current) * t
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function laneToX(lane: Lane): number {
  return LANE_X[lane]
}

export function randomLane(): Lane {
  return Math.floor(Math.random() * 2) as Lane
}

export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

export function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

export function xpForLevel(level: number): number {
  return Math.floor(100 * Math.pow(1.5, level - 1))
}

export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

export function distance2D(x1: number, z1: number, x2: number, z2: number): number {
  const dx = x1 - x2
  const dz = z1 - z2
  return Math.sqrt(dx * dx + dz * dz)
}
