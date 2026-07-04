import { loadJSON, saveJSON } from './storage'

export type CardPoolMode = 'renaiss' | 'local' | 'both'

export const CARD_POOL_STORAGE_KEY = 'card-pool-mode'

export function readCardPoolMode(): CardPoolMode {
  return loadJSON<CardPoolMode>(CARD_POOL_STORAGE_KEY, 'both')
}

export function writeCardPoolMode(mode: CardPoolMode): void {
  saveJSON(CARD_POOL_STORAGE_KEY, mode)
}
