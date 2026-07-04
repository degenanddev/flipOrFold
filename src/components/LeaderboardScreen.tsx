import { useEffect, useState } from 'react'
import { KawaiiButton, Panel, ScreenLayout, Title } from './ui'
import { useGameStore } from '../store/gameStore'
import { fetchLeaderboard } from '../supabase/leaderboard'
import type { LeaderboardEntry, LeaderboardPeriod } from '../types'

const PERIODS: { key: LeaderboardPeriod; label: string }[] = [
  { key: 'daily', label: 'Today' },
  { key: 'weekly', label: 'Week' },
  { key: 'alltime', label: 'All Time' },
]

const MEDALS = ['🥇', '🥈', '🥉']

export function LeaderboardScreen() {
  const setScreen = useGameStore((s) => s.setScreen)
  const [period, setPeriod] = useState<LeaderboardPeriod>('alltime')
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setFetchError(null)
    fetchLeaderboard(period).then(({ entries: data, error }) => {
      setEntries(data)
      setFetchError(error ?? null)
      setLoading(false)
    })
  }, [period])

  return (
    <ScreenLayout>
      <Title subtitle="Top card traders!" />

      <Panel className="w-full max-w-lg animate-pop-in">
        <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
          <div className="flex gap-2">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-display font-bold cursor-pointer ${
                  period === p.key
                    ? 'bg-[#9b5de5] text-white'
                    : 'bg-white/70 text-[#9b5de5]'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <KawaiiButton variant="purple" onClick={() => setScreen('menu')} className="text-xs px-3 py-1.5">
            ← Back
          </KawaiiButton>
        </div>

        {fetchError && (
          <p className="text-xs text-center text-red-500 font-bold mb-3">
            {fetchError.includes('game_scores')
              ? 'Leaderboard tables missing — run supabase db push or 003_players.sql in the SQL editor.'
              : fetchError}
          </p>
        )}

        {loading ? (
          <div className="text-center py-8 font-display font-bold text-[#9b5de5] animate-bounce-soft">
            Loading champions... ⭐
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-8 font-display font-bold text-[#9b5de5]">
            No scores yet — be the first!
          </div>
        ) : (
          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {entries.map((entry, i) => (
              <div
                key={entry.id}
                className={`flex items-center gap-3 p-3 rounded-2xl border-2 border-white ${
                  i < 3 ? 'bg-[#fff0f6]' : 'bg-[#f8f4ff]'
                }`}
              >
                <div className="font-display text-xl w-10 text-center">
                  {i < 3 ? MEDALS[i] : `#${i + 1}`}
                </div>
                <div className="flex-1">
                  <div className="font-display font-bold text-[#4a3568]">{entry.username}</div>
                  <div className="text-xs text-[#9b5de5]">🪙 {entry.coins}</div>
                </div>
                <div className="font-display font-bold text-[#22c55e] text-lg">
                  ${entry.score.toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </ScreenLayout>
  )
}
