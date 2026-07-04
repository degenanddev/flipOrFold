import { useEffect, useRef, useState } from 'react'
import { KawaiiButton, Panel, ScreenLayout, Title } from './ui'
import { useGameStore } from '../store/gameStore'
import { useAuthStore } from '../store/authStore'
import { useProgressionStore } from '../store/progressionStore'
import { isSupabaseConfigured } from '../supabase/client'
import { completeGameRun } from '../supabase/playerSnapshot'
import { formatMoney } from '../systems/tradingSystem'

type SubmitState = 'idle' | 'checking' | 'new_best' | 'kept_best' | 'failed'

export function GameOverScreen() {
  const runStats = useGameStore((s) => s.runStats)
  const resetGame = useGameStore((s) => s.resetGame)
  const startGame = useGameStore((s) => s.startGame)
  const user = useAuthStore((s) => s.user)
  const [submitState, setSubmitState] = useState<SubmitState>('idle')
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [previousBest, setPreviousBest] = useState<number | null>(null)
  const inflight = useRef<Promise<void> | null>(null)

  useEffect(() => {
    if (!runStats || !user) {
      setSubmitState('idle')
      setSubmitError(null)
      setPreviousBest(null)
      return
    }

    if (inflight.current) return

    inflight.current = saveRun(runStats, user.id, setSubmitState, setSubmitError, setPreviousBest)
  }, [runStats, user])

  if (!runStats) return null

  const handleRetrySubmit = async () => {
    if (!user || !runStats) return
    inflight.current = null
    await saveRun(runStats, user.id, setSubmitState, setSubmitError, setPreviousBest)
  }

  return (
    <ScreenLayout>
      <Title subtitle={runStats.endReason === 'bankrupt' ? 'You went broke!' : "Time's up!"} />

      <Panel className="w-full max-w-md space-y-4 animate-pop-in">
        <div className="text-center">
          {/* <div className="text-2xl">{runStats.profit >= 0 ? '💰' : '📉'}</div> */}
          <div className="font-display text-5xl font-black text-[#22c55e]">
            ${runStats.finalBalance.toLocaleString()}
          </div>
          <div className={`text-xl font-bold mt-1 ${runStats.profit >= 0 ? 'text-[#22c55e]' : 'text-red-500'}`}>
            {formatMoney(runStats.profit)} total
          </div>

        </div>

        <ScoreSaveBanner
          state={submitState}
          error={submitError}
          hasUser={Boolean(user)}
          previousBest={previousBest}
          onRetry={handleRetrySubmit}
        />

        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Best flip" value={formatMoney(runStats.bestTrade)} />
          <StatCard label="Worst flip" value={formatMoney(runStats.worstTrade)} />
          <StatCard label="Deals" value={`${runStats.tradesCount}`} />

          <StatCard
            label="Shop coins"
            value={runStats.metaCoinsEarned > 0 ? `+${runStats.metaCoinsEarned} 🪙` : '0 🪙'}
          />
          <StatCard label="XP" value={`+${runStats.xpEarned}`} />
        </div>

        <div className="flex flex-col gap-3 pt-2">
          <KawaiiButton variant="pink" onClick={startGame} className="w-full text-xl py-4">
            🔄 Trade Again!
          </KawaiiButton>
          <KawaiiButton variant="purple" onClick={resetGame} className="w-full">
            🏠 Menu
          </KawaiiButton>
        </div>
      </Panel>
    </ScreenLayout>
  )
}

async function saveRun(
  runStats: NonNullable<ReturnType<typeof useGameStore.getState>['runStats']>,
  userId: string,
  setSubmitState: (s: SubmitState) => void,
  setSubmitError: (e: string | null) => void,
  setPreviousBest: (n: number | null) => void
) {
  setSubmitState('checking')
  setSubmitError(null)

  const priorBest = useProgressionStore.getState().highScore
  setPreviousBest(priorBest)

  if (isSupabaseConfigured() && !userId.startsWith('local-')) {
    const res = await completeGameRun(
      userId,
      runStats.runId,
      runStats.finalBalance,
      runStats.metaCoinsEarned,
      runStats.xpEarned
    )

    if (!res.ok) {
      setSubmitState('failed')
      setSubmitError(res.error ?? 'Could not save run')
      return
    }

    const newBest = useProgressionStore.getState().highScore
    setSubmitState(newBest > priorBest ? 'new_best' : 'kept_best')
    return
  }

  useProgressionStore.getState().addRunResults(runStats.metaCoinsEarned, runStats.xpEarned)
  const newBest = runStats.finalBalance
  useProgressionStore.getState().updateHighScore(newBest)
  setSubmitState(newBest > priorBest ? 'new_best' : 'kept_best')
}

function ScoreSaveBanner({
  state,
  error,
  hasUser,
  previousBest,
  onRetry,
}: {
  state: SubmitState
  error: string | null
  hasUser: boolean
  previousBest: number | null
  onRetry: () => void
}) {
  if (!hasUser) {
    return (
      <p className="text-center text-sm font-bold text-[#b185db]">
        Pick a trainer name on the menu to track your best on the leaderboard.
      </p>
    )
  }

  if (state === 'checking') {
    return (
      <p className="text-center text-sm font-bold text-[#9b5de5] animate-pulse">
        Saving run & syncing account…
      </p>
    )
  }

  if (state === 'new_best') {
    return (
      <p className="text-center text-sm font-bold text-[#22c55e] animate-pop-in">
        🏆 New personal best — saved to the leaderboard!
      </p>
    )
  }

  if (state === 'kept_best') {
    const bestLabel =
      previousBest !== null && previousBest > 0
        ? `$${previousBest.toLocaleString()}`
        : 'your previous run'
    return (
      <p className="text-center text-sm font-bold text-[#b185db] animate-pop-in">
        Good run! Rewards saved — your leaderboard best stays at {bestLabel}.
      </p>
    )
  }

  if (state === 'failed') {
    return (
      <p className="text-center text-sm font-bold text-red-500 animate-pop-in">
        ❌ {error ?? 'Could not sync run.'}{' '}
        <button type="button" onClick={onRetry} className="underline cursor-pointer">
          Retry
        </button>
      </p>
    )
  }

  return null
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#f3e8ff] rounded-2xl p-1 text-center border-2 border-white">
      <div className="text-xs font-bold text-[#b185db] uppercase">{label}</div>
      <div className="font-display text-lg font-bold text-[#4a3568] mt-1">{value}</div>
    </div>
  )
}
