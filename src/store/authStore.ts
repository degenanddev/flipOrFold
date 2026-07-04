import { create } from 'zustand'
import type { UserProfile } from '../types'
import { isSupabaseConfigured } from '../supabase/client'
import { registerAndSync } from '../supabase/playerSnapshot'
import { supabase } from '../supabase/client'
import { loadJSON, saveJSON } from '../utils/storage'
import { validateUsername } from '../utils/usernameValidation'

const PSEUDO_KEY = 'renaiss-pseudo'
const DEVICE_KEY = 'renaiss-device-id'
const PLAYER_ID_KEY = 'renaiss-player-id'

export type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken' | 'banned' | 'invalid'

interface AuthState {
  user: UserProfile | null
  loading: boolean
  error: string | null
  usernameStatus: UsernameStatus

  setUser: (user: UserProfile | null) => void
  setLoading: (loading: boolean) => void
  restoreOfflineSession: () => void
  restoreOptimisticSession: () => void
  checkUsername: (rawUsername: string) => Promise<UsernameStatus>
  signInWithPseudo: (username: string) => Promise<boolean>
  getPlayerId: () => string | null
}

export function sanitizePseudo(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').slice(0, 20)
}

function getDeviceId(): string {
  let id = loadJSON<string | null>(DEVICE_KEY, null)
  if (!id) {
    id = crypto.randomUUID()
    saveJSON(DEVICE_KEY, id)
  }
  return id
}

export { getDeviceId }

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  loading: true,
  error: null,
  usernameStatus: 'idle',

  getPlayerId: () => loadJSON<string | null>(PLAYER_ID_KEY, null),

  setUser: (user) => set({ user }),

  setLoading: (loading) => set({ loading }),

  restoreOfflineSession: () => {
    const savedPseudo = loadJSON<string | null>(PSEUDO_KEY, null)
    const savedPlayerId = loadJSON<string | null>(PLAYER_ID_KEY, null)
    if (savedPseudo) {
      set({
        user: {
          id: savedPlayerId ?? `local-${savedPseudo}`,
          username: savedPseudo,
          created_at: new Date().toISOString(),
        },
        loading: false,
      })
    } else {
      set({ loading: false })
    }
  },

  restoreOptimisticSession: () => {
    const savedPseudo = loadJSON<string | null>(PSEUDO_KEY, null)
    const savedPlayerId = loadJSON<string | null>(PLAYER_ID_KEY, null)
    if (savedPseudo && savedPlayerId) {
      set({
        user: {
          id: savedPlayerId,
          username: savedPseudo,
          created_at: new Date().toISOString(),
        },
        loading: true,
      })
    }
  },

  checkUsername: async (rawUsername) => {
    const username = sanitizePseudo(rawUsername)
    if (username.length < 2) {
      set({ usernameStatus: 'idle' })
      return 'idle'
    }

    const validation = validateUsername(username)
    if (validation === 'invalid_chars') {
      set({ usernameStatus: 'invalid' })
      return 'invalid'
    }
    if (validation === 'banned') {
      set({ usernameStatus: 'banned' })
      return 'banned'
    }

    if (!isSupabaseConfigured()) {
      set({ usernameStatus: 'available' })
      return 'available'
    }

    set({ usernameStatus: 'checking' })
    const { data, error } = await supabase.rpc('is_username_taken', {
      p_username: username,
      p_device_id: getDeviceId(),
    })
    const taken = error ? true : Boolean(data)
    const status = taken ? 'taken' : 'available'
    set({ usernameStatus: status })
    return status
  },

  signInWithPseudo: async (rawUsername) => {
    if (get().user) return true

    const username = sanitizePseudo(rawUsername)
    if (username.length < 2) {
      set({ error: 'Pick a name with at least 2 characters.' })
      return false
    }

    const validation = validateUsername(username)
    if (validation === 'invalid_chars') {
      set({ error: 'Letters, numbers, spaces, _ and - only.' })
      return false
    }
    if (validation === 'banned') {
      set({ error: 'That name is not allowed — try another.' })
      return false
    }

    set({ loading: true, error: null })

    if (!isSupabaseConfigured()) {
      const profile: UserProfile = {
        id: `local-${username}`,
        username,
        created_at: new Date().toISOString(),
      }
      saveJSON(PSEUDO_KEY, username)
      saveJSON(PLAYER_ID_KEY, profile.id)
      set({ user: profile, loading: false, usernameStatus: 'available' })
      return true
    }

    const { ok, error } = await registerAndSync(username)
    if (!ok) {
      set({ loading: false, error: error ?? 'Could not create account', usernameStatus: 'taken' })
      return false
    }

    set({ loading: false, error: null, usernameStatus: 'available' })
    return true
  },
}))
