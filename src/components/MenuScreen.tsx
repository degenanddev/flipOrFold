import { useEffect, useState, useCallback } from 'react'
import { KawaiiButton, Panel, ScreenLayout, Title } from './ui'
import { useGameStore } from '../store/gameStore'
import { useProgressionStore } from '../store/progressionStore'
import { useAuthStore, sanitizePseudo } from '../store/authStore'
import { loadJSON, saveJSON } from '../utils/storage'
import { unlockAudio } from '../systems/soundManager'
import { STARTING_BALANCE, GAME_DURATION_SEC } from '../utils/constants'
import { useCardPoolStore, type CardPoolMode } from '../store/cardPoolStore'

const DRAFT_KEY = 'renaiss-pseudo-draft'

export function MenuScreen() {
  const setScreen = useGameStore((s) => s.setScreen)
  const startGame = useGameStore((s) => s.startGame)
  const level = useProgressionStore((s) => s.level)
  const totalCoins = useProgressionStore((s) => s.totalCoins)
  const highScore = useProgressionStore((s) => s.highScore)
  const user = useAuthStore((s) => s.user)
  const signInWithPseudo = useAuthStore((s) => s.signInWithPseudo)
  const checkUsername = useAuthStore((s) => s.checkUsername)
  const usernameStatus = useAuthStore((s) => s.usernameStatus)
  const authLoading = useAuthStore((s) => s.loading)
  const authError = useAuthStore((s) => s.error)

  const [pseudo, setPseudo] = useState(() => loadJSON(DRAFT_KEY, ''))
  const [starting, setStarting] = useState(false)
  const cardPoolMode = useCardPoolStore((s) => s.mode)
  const setCardPoolMode = useCardPoolStore((s) => s.setMode)
  const poolCounts = useCardPoolStore((s) => s.counts)

  const isNewPlayer = !authLoading && !user
  const trimmed = sanitizePseudo(pseudo)

  useEffect(() => {
    if (user) setPseudo(user.username)
  }, [user])

  useEffect(() => {
    if (!isNewPlayer) return
    if (trimmed.length >= 2) saveJSON(DRAFT_KEY, pseudo)
  }, [pseudo, trimmed.length, isNewPlayer])

  useEffect(() => {
    if (!isNewPlayer) return
    if (trimmed.length < 2) return
    const t = setTimeout(() => void checkUsername(trimmed), 400)
    return () => clearTimeout(t)
  }, [trimmed, checkUsername, isNewPlayer])

  const canStart = user
    ? !starting && !authLoading
    : trimmed.length >= 2 &&
      !starting &&
      !authLoading &&
      usernameStatus !== 'checking' &&
      usernameStatus !== 'taken' &&
      usernameStatus !== 'banned' &&
      usernameStatus !== 'invalid'

  const handlePlay = useCallback(async () => {
    if (!canStart) return
    setStarting(true)
    unlockAudio()

    if (user) {
      setStarting(false)
      startGame()
      return
    }

    const ok = await signInWithPseudo(trimmed)
    setStarting(false)
    if (ok) startGame()
  }, [canStart, user, signInWithPseudo, trimmed, startGame])

  const hint = (() => {
    if (!isNewPlayer) return null
    if (trimmed.length < 2) return '2+ characters — this is permanent'
    if (usernameStatus === 'invalid') return 'Letters, numbers, spaces, _ and - only'
    if (usernameStatus === 'banned') return 'Name not allowed'
    if (usernameStatus === 'checking') return 'Checking…'
    if (usernameStatus === 'taken') return 'Name taken'
    if (usernameStatus === 'available') return 'Ready ✓'
    return null
  })()

  const inputBorderClass =
    usernameStatus === 'taken' || usernameStatus === 'banned' || authError
      ? 'border-red-400'
      : usernameStatus === 'available'
        ? 'border-[#7ec850]'
        : usernameStatus === 'invalid'
          ? 'border-amber-400'
          : 'border-[#e0c3fc]'

  return (
    <ScreenLayout menu>
      <Title subtitle={`$${STARTING_BALANCE} · ${GAME_DURATION_SEC}s · pick a lane & buy`} menu />

      <Panel className="w-full max-w-sm shrink-0 flex flex-col gap-2 sm:gap-2.5 !p-3 sm:!p-4 animate-pop-in">
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2 shrink-0">
          <MiniStat emoji="⭐" value={level} label="Lvl" />
          <MiniStat emoji="💰" value={highScore || STARTING_BALANCE} label="Best" />
          <MiniStat emoji="🪙" value={totalCoins} label="Coins" />
        </div>

        <div className="shrink-0">
          {authLoading ? (
            <div className="bg-[#f3e8ff] rounded-xl px-3 py-3 border-2 border-white text-center">
              <p className="text-sm font-bold text-[#9b5de5] animate-pulse">Loading your account…</p>
            </div>
          ) : user ? (
            <div className="bg-[#f3e8ff] rounded-xl px-3 py-2.5 border-2 border-white text-center">
              <p className="text-[10px] font-bold text-[#9b5de5] uppercase">Playing as</p>
              <p className="font-display text-base sm:text-lg font-black text-[#ff6b9d] truncate">{user.username}</p>
            </div>
          ) : (
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-center text-[#9b5de5]">Pick your trainer name (one time only)</p>
              <input
                value={pseudo}
                onChange={(e) => setPseudo(e.target.value)}
                placeholder="Trainer name…"
                maxLength={20}
                autoFocus
                className={`w-full bg-white border-2 rounded-xl px-3 py-2 text-sm font-display font-bold text-[#4a3568] text-center focus:outline-none focus:border-[#ff6b9d] ${inputBorderClass}`}
                onKeyDown={(e) => e.key === 'Enter' && canStart && handlePlay()}
              />
              {(hint || authError) && (
                <p className={`text-[10px] font-bold text-center ${usernameStatus === 'taken' || usernameStatus === 'banned' || authError ? 'text-red-500' : usernameStatus === 'invalid' ? 'text-amber-600' : 'text-[#7ec850]'}`}>
                  {authError ?? hint}
                </p>
              )}
            </div>
          )}
        </div>

        <CardPoolToggle mode={cardPoolMode} onChange={setCardPoolMode} renaiss={poolCounts.renaiss} local={poolCounts.local} />

        <div className="shrink-0 space-y-2 pt-1">
          <KawaiiButton variant="pink" onClick={handlePlay} disabled={!canStart} className="w-full text-base sm:text-lg py-2.5 sm:py-3 disabled:opacity-50">
            {starting || authLoading ? 'Loading…' : user ? '▶ Start Trading!' : '▶ Create & Play!'}
          </KawaiiButton>
          <KawaiiButton variant="yellow" onClick={() => setScreen('shop')} className="w-full text-sm sm:text-base py-2 sm:py-2.5">
            🛍️ Shop
          </KawaiiButton>
          <KawaiiButton variant="blue" onClick={() => setScreen('carddex')} className="w-full text-sm sm:text-base py-2 sm:py-2.5">
            📖 Card Dex
          </KawaiiButton>
          <div className="flex gap-2">
            <KawaiiButton variant="blue" onClick={() => setScreen('leaderboard')} className="flex-1 text-sm sm:text-base py-2 sm:py-2.5">
              🏆 Rank
            </KawaiiButton>
            <KawaiiButton variant="purple" onClick={() => setScreen('profile')} className="flex-1 text-sm sm:text-base py-2 sm:py-2.5">
              👤 Stats
            </KawaiiButton>
          </div>
        </div>
      </Panel>

      <p className="shrink-0 mt-3 text-[9px] sm:text-[10px] font-semibold text-[#b185db] text-center">
        Progress synced to your account on this device
      </p>
    </ScreenLayout>
  )
}

function MiniStat({ emoji, value, label }: { emoji: string; value: number; label: string }) {
  return (
    <div className="flex flex-col items-center bg-white/80 rounded-xl py-1.5 px-1 border-2 border-white">
      <span className="text-sm leading-none">{emoji}</span>
      <span className="font-display text-sm sm:text-base font-bold text-[#9b5de5] leading-tight">{value}</span>
      <span className="text-[9px] font-bold text-[#b185db] uppercase">{label}</span>
    </div>
  )
}

const POOL_OPTIONS: { id: CardPoolMode; label: string; hint: string }[] = [
  { id: 'both', label: 'Both', hint: 'Renaiss + classic cards' },
  { id: 'renaiss', label: 'Renaiss', hint: 'Live market cards only' },
  { id: 'local', label: 'Classic', hint: 'Original bundled cards' },
]

function CardPoolToggle({
  mode,
  onChange,
  renaiss,
  local,
}: {
  mode: CardPoolMode
  onChange: (mode: CardPoolMode) => void
  renaiss: number
  local: number
}) {
  const active = POOL_OPTIONS.find((o) => o.id === mode)
  const total = mode === 'both' ? renaiss + local : mode === 'renaiss' ? renaiss : local

  return (
    <div className="shrink-0 bg-white/70 rounded-xl p-2 border-2 border-white space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold text-[#9b5de5] uppercase">Card pool</p>
        <p className="text-[10px] font-bold text-[#b185db]">{total} cards</p>
      </div>
      <div className="grid grid-cols-3 gap-1">
        {POOL_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={`rounded-lg py-1.5 px-1 text-[10px] sm:text-xs font-bold border-2 transition-colors ${
              mode === opt.id
                ? 'bg-[#ff6b9d] text-white border-[#ff6b9d]'
                : 'bg-white text-[#9b5de5] border-[#e0c3fc] hover:border-[#ff6b9d]'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <p className="text-[9px] font-semibold text-center text-[#b185db]">{active?.hint}</p>
    </div>
  )
}
