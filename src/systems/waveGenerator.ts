import type { Lane, Wave, WaveCard } from '../types'
import {
  BASE_CARD_SPEED,
  SPAWN_Z,
  SPEED_INCREASE_AMOUNT,
  SPEED_INCREASE_INTERVAL,
} from '../utils/constants'
import { getTwoDistinctCards } from './cardLoader'
import { generateDisplayPrice } from './tradingSystem'

export function getWaveSpeed(waveNumber: number): number {
  const tier = Math.floor((waveNumber - 1) / SPEED_INCREASE_INTERVAL)
  return BASE_CARD_SPEED + tier * SPEED_INCREASE_AMOUNT
}

export function generateWave(waveNumber: number): Wave {
  const [cardA, cardB] = getTwoDistinctCards()
  const leftFirst = Math.random() < 0.5

  const build = (card: typeof cardA, lane: Lane): WaveCard => ({
    id: `wave-${waveNumber}-${lane}`,
    lane,
    card,
    displayPrice: generateDisplayPrice(card.marketPrice),
    z: SPAWN_Z,
    hit: false,
    missed: false,
  })

  const cards: WaveCard[] = leftFirst
    ? [build(cardA, 0), build(cardB, 1)]
    : [build(cardB, 0), build(cardA, 1)]

  return { id: waveNumber, cards, resolved: false }
}

export function updateWaveCards(wave: Wave, delta: number, speed: number): Wave {
  return {
    ...wave,
    cards: wave.cards.map((c) =>
      c.hit || c.missed ? c : { ...c, z: c.z + speed * delta }
    ),
  }
}

export function finishWave(waves: Wave[], waveId: number): Wave[] {
  return waves.filter((w) => w.id !== waveId)
}

export function isWaveActive(wave: Wave): boolean {
  return wave.cards.some((c) => !c.hit && !c.missed)
}

export function hasActiveWave(waves: Wave[]): boolean {
  return waves.some(isWaveActive)
}
