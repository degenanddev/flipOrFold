import { supabase, isSupabaseConfigured } from './client'
import { getDeviceId } from '../store/authStore'
import { applyPlayerSnapshot } from './playerSnapshot'
import type { PlayerSnapshot } from '../types/playerSnapshot'
import { CRYPTO_TREASURY_ADDRESS } from '../web3/config'

export interface CryptoBonusItem {
  id: string
  name: string
  description: string
  icon: string
  price_wei: string
  bonus_type: string
}

export interface CryptoOrderIntent {
  orderId: string
  itemId: string
  itemName: string
  amountWei: string
  treasuryAddress: string
  chainId: number
  expiresAt: string
  fromWallet: string
}

export async function fetchCryptoBonusCatalog(): Promise<CryptoBonusItem[]> {
  if (!isSupabaseConfigured()) return []

  const { data, error } = await supabase.rpc('get_crypto_bonus_catalog')
  if (error) {
    if (import.meta.env.DEV) {
      console.warn('[crypto shop] DB not ready — apply migration 012 on Supabase:', error.message)
    }
    return []
  }

  return (data ?? []) as CryptoBonusItem[]
}

export async function prepareWalletLinkMessage(): Promise<{ message: string; nonce: number; username: string } | null> {
  if (!isSupabaseConfigured()) return null

  const { data, error } = await supabase.rpc('wallet_link_prepare', {
    p_device_id: getDeviceId(),
  })

  if (error || !data) return null
  const row = data as { message: string; nonce: number; username: string }
  return { message: row.message, nonce: row.nonce, username: row.username }
}

export async function invokeLinkWallet(
  walletAddress: string,
  signature: string,
  message: string
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: 'Offline mode' }

  const { data, error } = await supabase.functions.invoke('web3-link-wallet', {
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

export async function unlinkWallet(): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: 'Offline mode' }

  const { data, error } = await supabase.rpc('wallet_unlink', {
    p_device_id: getDeviceId(),
  })

  if (error) return { ok: false, error: error.message }

  const snapshot = data as PlayerSnapshot
  if (snapshot?.player?.id) applyPlayerSnapshot(snapshot)
  return { ok: true }
}

export async function abandonCryptoOrder(orderId: string): Promise<void> {
  if (!isSupabaseConfigured() || !orderId) return

  await supabase.rpc('crypto_abandon_order', {
    p_device_id: getDeviceId(),
    p_order_id: orderId,
  })
}

function humanizeCryptoError(message: string): string {
  if (message.includes('pending order exists')) {
    return 'Previous checkout still open — try again in a moment'
  }
  return message
}

export async function prepareCryptoOrder(itemId: string): Promise<{ ok: boolean; order?: CryptoOrderIntent; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: 'Offline mode' }
  if (!CRYPTO_TREASURY_ADDRESS) return { ok: false, error: 'Treasury not configured' }

  const { data, error } = await supabase.rpc('crypto_prepare_order', {
    p_device_id: getDeviceId(),
    p_item_id: itemId,
    p_treasury_address: CRYPTO_TREASURY_ADDRESS,
  })

  if (error) return { ok: false, error: humanizeCryptoError(error.message) }

  const row = data as {
    orderId: string
    itemId: string
    itemName: string
    amountWei: string
    treasuryAddress: string
    chainId: number
    expiresAt: string
    fromWallet: string
  }

  return {
    ok: true,
    order: {
      orderId: row.orderId,
      itemId: row.itemId,
      itemName: row.itemName,
      amountWei: row.amountWei,
      treasuryAddress: row.treasuryAddress,
      chainId: row.chainId,
      expiresAt: row.expiresAt,
      fromWallet: row.fromWallet,
    },
  }
}

export async function confirmCryptoPurchase(
  orderId: string,
  txHash: string
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: 'Offline mode' }

  const { data, error } = await supabase.functions.invoke('web3-confirm-purchase', {
    body: {
      device_id: getDeviceId(),
      order_id: orderId,
      tx_hash: txHash,
    },
  })

  if (error) return { ok: false, error: error.message }

  const payload = data as { ok?: boolean; error?: string; snapshot?: PlayerSnapshot }
  if (payload.error) return { ok: false, error: payload.error }
  if (payload.snapshot) applyPlayerSnapshot(payload.snapshot)
  return { ok: true }
}
