import { create } from 'zustand'

export type WalletTxPhase = 'idle' | 'preparing' | 'signing' | 'sending' | 'confirming' | 'success' | 'error'

const ERROR_DISMISS_MS = 4000

let purchaseResetTimer: ReturnType<typeof setTimeout> | undefined
let linkResetTimer: ReturnType<typeof setTimeout> | undefined

interface WalletUiState {
  linkPhase: WalletTxPhase
  purchasePhase: WalletTxPhase
  statusMessage: string | null
  txHash: string | null
  activeItemId: string | null

  setLinkPhase: (phase: WalletTxPhase, message?: string | null) => void
  setPurchasePhase: (phase: WalletTxPhase, message?: string | null, txHash?: string | null) => void
  setActiveItem: (itemId: string | null) => void
  resetPurchase: () => void
  resetLink: () => void
}

export const useWalletUiStore = create<WalletUiState>((set, get) => ({
  linkPhase: 'idle',
  purchasePhase: 'idle',
  statusMessage: null,
  txHash: null,
  activeItemId: null,

  setLinkPhase: (linkPhase, statusMessage = null) => {
    if (linkResetTimer) {
      clearTimeout(linkResetTimer)
      linkResetTimer = undefined
    }
    set({ linkPhase, statusMessage })
    if (linkPhase === 'error') {
      linkResetTimer = setTimeout(() => {
        linkResetTimer = undefined
        if (get().linkPhase === 'error') {
          set({ linkPhase: 'idle', statusMessage: null })
        }
      }, ERROR_DISMISS_MS)
    }
  },
  setPurchasePhase: (purchasePhase, statusMessage = null, txHash = null) => {
    if (purchaseResetTimer) {
      clearTimeout(purchaseResetTimer)
      purchaseResetTimer = undefined
    }
    set({ purchasePhase, statusMessage, txHash })
    if (purchasePhase === 'error') {
      purchaseResetTimer = setTimeout(() => {
        purchaseResetTimer = undefined
        if (get().purchasePhase === 'error') {
          set({ purchasePhase: 'idle', statusMessage: null, txHash: null, activeItemId: null })
        }
      }, ERROR_DISMISS_MS)
    }
  },
  setActiveItem: (activeItemId) => set({ activeItemId }),
  resetPurchase: () => {
    if (purchaseResetTimer) {
      clearTimeout(purchaseResetTimer)
      purchaseResetTimer = undefined
    }
    set({ purchasePhase: 'idle', statusMessage: null, txHash: null, activeItemId: null })
  },
  resetLink: () => {
    if (linkResetTimer) {
      clearTimeout(linkResetTimer)
      linkResetTimer = undefined
    }
    set({ linkPhase: 'idle', statusMessage: null })
  },
}))
