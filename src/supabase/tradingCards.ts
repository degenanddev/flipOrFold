import { supabase, isSupabaseConfigured } from './client'
import type { CardData, Rarity } from '../types'

export interface TradingCardRow {
  id: string
  game?: string
  name: string
  set?: string
  rarity: Rarity
  image: string
  marketPrice: number
  gradeLabel?: string | null
}

export async function fetchTradingCardPool(): Promise<TradingCardRow[]> {
  if (!isSupabaseConfigured()) return []

  const { data, error } = await supabase.rpc('get_trading_card_pool')
  if (error) {
    if (import.meta.env.DEV) {
      console.warn('[trading cards] DB not ready — apply migration 018:', error.message)
    }
    return []
  }

  if (!Array.isArray(data)) return []
  return data as TradingCardRow[]
}

export function tradingRowToCardData(row: TradingCardRow): CardData {
  return {
    id: row.id,
    image: row.image,
    rarity: row.rarity,
    name: row.name,
    set: row.set,
    marketPrice: row.marketPrice,
    game: row.game,
    gradeLabel: row.gradeLabel ?? undefined,
  }
}

export interface TradingCardSearchRow {
  id: string
  game: string
  name: string
  set?: string
  rarity: Rarity
  image: string
  marketPrice: number
  gradeLabel?: string | null
  renaissHref: string
  deltaPct?: number | null
}

/** Card Dex — searches existing cached rows only (no new storage). */
export async function searchTradingCardsCached(
  query: string,
  limit = 20,
  game?: string | null,
): Promise<TradingCardSearchRow[]> {
  if (!isSupabaseConfigured()) return []
  const q = query.trim()
  if (q.length < 2) return []

  const { data, error } = await supabase.rpc('search_trading_cards', {
    p_query: q,
    p_limit: limit,
    p_game: game ?? null,
  })

  if (error) {
    if (import.meta.env.DEV) console.warn('[search_trading_cards]', error.message)
    return []
  }

  if (!Array.isArray(data)) return []
  return data as TradingCardSearchRow[]
}
