import { create } from 'zustand'
import { isSupabaseConfigured } from '../supabase/client'
import { syncPlayerSnapshot, registerAndSync } from '../supabase/playerSnapshot'
import { useAuthStore, getDeviceId } from './authStore'
import { useProgressionStore } from './progressionStore'
import { useShopStore } from './shopStore'
import { loadJSON } from '../utils/storage'

interface SessionState {
  ready: boolean
  bootstrapping: boolean
  bootstrap: () => Promise<void>
  refreshPlayerData: () => Promise<void>
}

export const useSessionStore = create<SessionState>((set, get) => ({
  ready: false,
  bootstrapping: false,

  bootstrap: async () => {
    if (get().bootstrapping) return
    set({ bootstrapping: true, ready: false })

    useProgressionStore.getState().loadLocal()
    useShopStore.getState().loadLocal()

    if (!isSupabaseConfigured()) {
      useAuthStore.getState().restoreOfflineSession()
      set({ ready: true, bootstrapping: false })
      return
    }

    useAuthStore.getState().restoreOptimisticSession()

    const deviceId = getDeviceId()
    let snapshot = await syncPlayerSnapshot(deviceId)

    if (!snapshot) {
      const savedPseudo = loadJSON<string | null>('renaiss-pseudo', null)
      if (savedPseudo && sanitize(savedPseudo).length >= 2) {
        await registerAndSync(sanitize(savedPseudo))
      } else {
        useAuthStore.getState().setUser(null)
      }
    }

    useAuthStore.getState().setLoading(false)
    set({ ready: true, bootstrapping: false })
  },

  refreshPlayerData: async () => {
    if (!isSupabaseConfigured()) return
    await syncPlayerSnapshot()
  },
}))

function sanitize(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').slice(0, 20)
}
