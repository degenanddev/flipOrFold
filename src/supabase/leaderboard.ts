import type { LeaderboardEntry, LeaderboardPeriod } from '../types'
import { supabase, isSupabaseConfigured } from './client'

function getPeriodStart(period: LeaderboardPeriod): string | null {
  const now = new Date()
  if (period === 'alltime') return null
  if (period === 'daily') {
    now.setHours(0, 0, 0, 0)
    return now.toISOString()
  }
  const day = now.getDay()
  now.setDate(now.getDate() - day)
  now.setHours(0, 0, 0, 0)
  return now.toISOString()
}

export async function fetchLeaderboard(
  period: LeaderboardPeriod,
  limit = 50
): Promise<{ entries: LeaderboardEntry[]; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { entries: [], error: 'Supabase not configured' }
  }

  const { data, error } = await supabase.rpc('get_leaderboard', {
    p_since: getPeriodStart(period),
    p_limit: limit,
  })

  if (error) {
    console.warn('Leaderboard fetch failed:', error.message)
    return { entries: [], error: error.message }
  }

  const rows = (data ?? []) as {
    id: string
    username: string
    score: number
    coins: number
    created_at: string
  }[]

  return {
    entries: rows
      .map((row) => ({
        id: row.id,
        username: row.username ?? 'Trader',
        score: row.score,
        coins: row.coins,
        created_at: row.created_at,
      }))
      .sort((a, b) => b.score - a.score),
  }
}
