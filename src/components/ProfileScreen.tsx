import { KawaiiButton, Panel, ScreenLayout, Title } from './ui'
import { useGameStore } from '../store/gameStore'
import { useProgressionStore } from '../store/progressionStore'
import { useAuthStore } from '../store/authStore'
import { getLevelProgress, xpRequiredForLevel, canClaimDailyReward } from '../systems/progressionSystem'
import { useState } from 'react'

export function ProfileScreen() {
  const setScreen = useGameStore((s) => s.setScreen)
  const { level, xp, totalCoins, highScore, totalRuns, lastDailyClaim } = useProgressionStore()
  const { user } = useAuthStore()
  const [dailyMsg, setDailyMsg] = useState<string | null>(null)

  const progress = getLevelProgress(xp, level)
  const xpNeeded = xpRequiredForLevel(level)
  const canClaim = canClaimDailyReward(lastDailyClaim)

  const handleDaily = async () => {
    const reward = await useProgressionStore.getState().claimDailyReward()
    if (reward) setDailyMsg(`Yay! +${reward.coins} coins & +${reward.xp} XP! 🎁`)
  }

  return (
    <ScreenLayout>
      <Title subtitle="Your trainer stats" />

      <Panel className="w-full max-w-md space-y-4 animate-pop-in">
        <div className="flex justify-end">
          <KawaiiButton variant="purple" onClick={() => setScreen('menu')} className="text-xs px-4 py-2">
            ← Back
          </KawaiiButton>
        </div>

        {user && (
          <div className="text-center space-y-1">
            <div className="text-5xl">🧑‍🎤</div>
            <div className="font-display text-2xl font-bold text-[#ff6b9d]">{user.username}</div>
            <div className="text-xs font-bold text-[#7ec850]">Trainer account active ✓</div>
          </div>
        )}

        <div className="space-y-3 pt-2">
          <div>
            <div className="flex justify-between text-sm font-bold mb-1">
              <span className="text-[#9b5de5]">Level {level} ⭐</span>
              <span className="text-[#ff6b9d]">{xp}/{xpNeeded} XP</span>
            </div>
            <div className="h-4 bg-[#f3e8ff] rounded-full overflow-hidden border-2 border-white">
              <div
                className="h-full bg-gradient-to-r from-[#ff6b9d] to-[#9b5de5] transition-all rounded-full"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <MiniStat label="Coins" value={totalCoins} emoji="🪙" />
            <MiniStat label="Best $" value={highScore} emoji="🏆" />
            <MiniStat label="Runs" value={totalRuns} emoji="🎮" />
          </div>

          {canClaim && (
            <KawaiiButton variant="yellow" onClick={handleDaily} className="w-full">
              🎁 Daily Gift!
            </KawaiiButton>
          )}
          {dailyMsg && <p className="text-[#7ec850] text-sm text-center font-bold">{dailyMsg}</p>}
        </div>
      </Panel>
    </ScreenLayout>
  )
}

function MiniStat({ label, value, emoji }: { label: string; value: number; emoji: string }) {
  return (
    <div className="bg-[#f8f4ff] rounded-xl p-2 border border-white">
      <div className="text-lg">{emoji}</div>
      <div className="font-display font-bold text-[#9b5de5]">{value}</div>
      <div className="text-[10px] font-bold text-[#b185db] uppercase">{label}</div>
    </div>
  )
}
