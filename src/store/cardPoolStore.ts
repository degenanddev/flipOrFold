import { create } from 'zustand'
import { readCardPoolMode, writeCardPoolMode, type CardPoolMode } from '../utils/cardPoolSettings'
import { reloadTradingCardPool, getCardPoolSources } from '../systems/cardLoader'

export type { CardPoolMode }

interface CardPoolState {
  mode: CardPoolMode
  counts: { renaiss: number; local: number }
  setMode: (mode: CardPoolMode) => void
  syncCounts: () => void
}

export const useCardPoolStore = create<CardPoolState>((set) => ({
  mode: readCardPoolMode(),
  counts: { renaiss: 0, local: 0 },
  setMode: (mode) => {
    writeCardPoolMode(mode)
    set({ mode })
    void reloadTradingCardPool(mode).then(() => {
      set({ counts: getCardPoolSources() })
    })
  },
  syncCounts: () => set({ counts: getCardPoolSources() }),
}))
