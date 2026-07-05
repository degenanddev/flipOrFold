import { supabase, isSupabaseConfigured } from './client'
import { getDeviceId } from '../store/authStore'
import { applyPlayerSnapshot } from './playerSnapshot'
import type { PlayerSnapshot } from '../types/playerSnapshot'

export interface WalletRecoveryLookup {
  found: boolean
  username?: string
}

export async function lookupWalletRecovery(walletAddress: string): Promise<WalletRecoveryLookup> {
  if (!isSupabaseConfigured()) return { found: false }

  const { data, error } = await supabase.rpc('wallet_recovery_lookup', {
    p_wallet_address: walletAddress,
  })

  if (error || !data) return { found: false }

  const row = data as { found?: boolean; username?: string }
  return {
    found: Boolean(row.found),
    username: row.username,
  }
}

export async function prepareWalletRecovery(
  walletAddress: string
): Promise<
  | { ok: true; message: string; username: string; alreadyOnDevice?: false }
  | { ok: true; username: string; alreadyOnDevice: true }
  | { ok: false; error: string }
> {
  if (!isSupabaseConfigured()) return { ok: false, error: 'Offline mode' }

  const { data, error } = await supabase.rpc('wallet_recovery_prepare', {
    p_new_device_id: getDeviceId(),
    p_wallet_address: walletAddress,
  })

  if (error) {
    const msg = error.message.toLowerCase()
    if (msg.includes('no linked account')) {
      return { ok: false, error: 'No trainer linked to this wallet — link one in Shop → Crypto first' }
    }
    return { ok: false, error: error.message }
  }

  const row = data as {
    message?: string
    username?: string
    alreadyOnDevice?: boolean
    snapshot?: PlayerSnapshot
  }

  if (row.alreadyOnDevice && row.snapshot) {
    applyPlayerSnapshot(row.snapshot)
    return { ok: true, username: row.username ?? '', alreadyOnDevice: true }
  }

  if (!row.message || !row.username) {
    return { ok: false, error: 'Could not prepare recovery' }
  }

  return { ok: true, message: row.message, username: row.username }
}

export async function invokeWalletRecovery(
  walletAddress: string,
  signature: string,
  message: string
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: 'Offline mode' }

  const { data, error } = await supabase.functions.invoke('web3-recover-account', {
    body: {
      device_id: getDeviceId(),
      wallet_address: walletAddress,
      signature,
      message,
    },
  })

  if (error) return { ok: false, error: error.message }

  const payload = data as { ok?: boolean; error?: string; snapshot?: PlayerSnapshot }
  if (payload.error) return { ok: false, error: payload.error }
  if (payload.snapshot) applyPlayerSnapshot(payload.snapshot)
  return { ok: true }
}
