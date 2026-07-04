import { useEffect, useState } from 'react'
import { useGameStore } from '../store/gameStore'
import { formatMoney } from '../systems/tradingSystem'
import {
  getPowerupActiveBadgeLabel,
  getPowerupColor,
  getPowerupIcon,
  getPowerupLabel,
  getPowerupPickupHint,
} from '../systems/powerupSystem'
import { PENDING_POWERUP_TTL_MS } from '../utils/constants'
import { getShopUpgradeValues } from '../systems/shopEffects'

export function GameHUD() {
  const balance = useGameStore((s) => s.balance)
  const timeLeft = useGameStore((s) => s.timeLeft)
  const tradeFeedback = useGameStore((s) => s.tradeFeedback)
  const powerupFeedback = useGameStore((s) => s.powerupFeedback)
  const pendingPowerups = useGameStore((s) => s.pendingPowerups)
  const collectPendingPowerup = useGameStore((s) => s.collectPendingPowerup)
  const insuranceActive = useGameStore((s) => s.insuranceActive)
  const activePowerups = useGameStore((s) => s.activePowerups)

  const [now, setNow] = useState(() => performance.now())
  const hasTimedUi =
    pendingPowerups.length > 0 ||
    insuranceActive ||
    activePowerups.some((p) => p.expiresAt > performance.now())

  useEffect(() => {
    if (!hasTimedUi) return
    const id = window.setInterval(() => setNow(performance.now()), 250)
    return () => window.clearInterval(id)
  }, [hasTimedUi])

  const activeTimed = activePowerups.filter((p) => p.expiresAt > now)
  const timerUrgent = timeLeft <= 10
  const seconds = Math.ceil(timeLeft)
  const insuranceHint = insuranceActive
    ? `Next bad flip capped at $${getShopUpgradeValues().insuranceMaxLoss}`
    : null

  return (
    <div className="absolute inset-0 pointer-events-none z-10 font-display">
      <div className="absolute top-3 left-3 right-3 flex justify-center items-start gap-2">
        <div className="hud-pill px-4 py-2 min-w-[110px] absolute left-3">
          <div className="text-2xl font-black text-[#22c55e]">${balance.toLocaleString()}</div>
          <div className="text-xs font-bold text-[#b185db]">CASH</div>
        </div>

        <div
          className={`hud-pill px-5 py-2 text-center ${timerUrgent ? 'animate-wiggle border-red-400' : ''}`}
        >
          <div className={`text-3xl font-black ${timerUrgent ? 'text-red-500' : 'text-kawaii-pink'}`}>
            {seconds}s
          </div>
          <div className="text-xs font-bold text-[#b185db]">TIME</div>
        </div>
      </div>

      {tradeFeedback && (
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 text-center animate-pop-in z-20">
          <div
            className={`text-4xl md:text-5xl font-black ${
              tradeFeedback.amount >= 0 ? 'text-[#22c55e]' : 'text-red-500'
            }`}
            style={{ textShadow: '2px 2px 0 #fff, -1px -1px 0 #4a3568' }}
          >
            {formatMoney(tradeFeedback.amount)}
          </div>
          <div className="mt-2 inline-block rounded-2xl border-2 border-[#9b5de5] bg-[#fff8fc]/95 px-4 py-2 shadow-lg backdrop-blur-sm">
            {tradeFeedback.emote && (
              <div className="text-lg font-black text-[#ff6b9d] mb-0.5">{tradeFeedback.emote}</div>
            )}
            <div className="text-base font-black text-[#4a3568]">{tradeFeedback.cardName}</div>
            <div className="text-sm font-bold text-[#9b5de5] mt-0.5">
              Paid <span className="text-[#ff6b9d]">${tradeFeedback.displayPrice}</span>
              {' · '}
              Worth <span className="text-[#22c55e]">${tradeFeedback.marketPrice}</span>
            </div>
          </div>
        </div>
      )}

      {powerupFeedback && (
        <div className="absolute top-[18%] left-1/2 -translate-x-1/2 text-center animate-pop-in z-20 max-w-[90%]">
          <div
            className="inline-block rounded-2xl border-2 bg-[#fff8fc]/95 px-4 py-3 shadow-lg backdrop-blur-sm"
            style={{ borderColor: powerupFeedback.color }}
          >
            <div className="text-2xl font-black" style={{ color: powerupFeedback.color }}>
              {powerupFeedback.icon} {powerupFeedback.title}
            </div>
            <div className="text-sm font-bold text-[#4a3568] mt-1">{powerupFeedback.detail}</div>
          </div>
        </div>
      )}

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 flex-wrap justify-center max-w-[95%]">
        {insuranceActive && (
          <Badge
            label="Insured · 1 flip"
            sublabel={insuranceHint ?? undefined}
            icon="🛡"
            color="#7ec850"
          />
        )}
        {activeTimed.map((p) => (
          <Badge
            key={`${p.type}-${p.expiresAt}`}
            label={getPowerupActiveBadgeLabel(p.type, p.expiresAt, now)}
            icon={getPowerupIcon(p.type)}
            color={getPowerupColor(p.type)}
          />
        ))}
      </div>

      {pendingPowerups.map((pick) => {
        const age = now - pick.spawnedAt
        const timeLeftMs = Math.max(0, PENDING_POWERUP_TTL_MS - age)
        const urgency = timeLeftMs < 1500
        const slotLeft = pick.slot === 0 ? '26%' : '74%'
        const hint = getPowerupPickupHint(pick.type)

        return (
          <div
            key={pick.id}
            className="absolute bottom-24 -translate-x-1/2 pointer-events-auto"
            style={{ left: slotLeft }}
          >
            <button
              type="button"
              onClick={() => collectPendingPowerup(pick.id)}
              className={`btn-kawaii bg-linear-to-b from-[#ffe066] to-kawaii-yellow text-[#6b4c2a] px-4 py-2.5 text-sm sm:text-base animate-bounce-soft max-w-[160px] ${
                urgency ? 'opacity-80 scale-95' : ''
              }`}
            >
              {getPowerupIcon(pick.type)} {getPowerupLabel(pick.type)}
              <span className="block text-[10px] font-bold opacity-90 mt-0.5 leading-tight">{hint}</span>
              <span className="block text-[10px] font-bold opacity-70 mt-0.5">
                Tap · {Math.ceil(timeLeftMs / 1000)}s left
              </span>
            </button>
          </div>
        )
      })}
    </div>
  )
}

function Badge({
  label,
  sublabel,
  icon,
  color,
}: {
  label: string
  sublabel?: string
  icon: string
  color: string
}) {
  return (
    <div className="hud-pill px-3 py-1.5 flex flex-col items-center gap-0.5 text-sm font-bold" style={{ color }}>
      <div className="flex items-center gap-1.5">
        <span>{icon}</span>
        <span>{label}</span>
      </div>
      {sublabel && <span className="text-[10px] font-bold opacity-80">{sublabel}</span>}
    </div>
  )
}

export function CountdownOverlay() {
  const phase = useGameStore((s) => s.phase)
  const countdown = useGameStore((s) => s.countdown)

  if (phase !== 'countdown') return null
  const text = countdown > 0 ? countdown.toString() : 'GO!'

  return (
    <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
      <div
        className="font-display text-8xl font-black text-white animate-pop-in"
        style={{ textShadow: '4px 4px 0 #9b5de5' }}
      >
        {text}
      </div>
    </div>
  )
}
