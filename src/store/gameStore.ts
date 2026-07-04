import { create } from 'zustand'
import type {
  ActivePowerup,
  CameraShake,
  GameEndReason,
  GameRunStats,
  Lane,
  PendingPowerupPick,
  Screen,
  TradeFeedback,
  PowerupFeedback,
  Wave,
} from '../types'
import {
  COUNTDOWN_SECONDS,
  COUNTDOWN_TICK_MS,
  GAME_DURATION_SEC,
  GATE_Z,
  PENDING_POWERUP_TTL_MS,
  PLAYER_Z,
  STARTING_BALANCE,
  WAVE_COOLDOWN_MS,
  LANE_MOVE_SMOOTH_SEC,
  LANE_SNAP_EPSILON,
} from '../utils/constants'
import { laneToX, smoothApproach } from '../utils/math'
import {
  generateWave,
  getWaveSpeed,
  updateWaveCards,
  finishWave,
  hasActiveWave,
} from '../systems/waveGenerator'
import { calculateRunXP, executeTrade } from '../systems/tradingSystem'
import {
  activatePowerup,
  cleanExpiredPowerups,
  expirePendingPowerups,
  getPowerupCollectFeedback,
  getPowerupColor,
  getPowerupIcon,
  isPowerupActive,
  trySpawnPendingPowerup,
  upsertActivePowerup,
} from '../systems/powerupSystem'
import { getEquippedEmoteText, getShopUpgradeValues } from '../systems/shopEffects'
import { checkCardCollision } from '../systems/collisionSystem'
import { playSound } from '../systems/soundManager'

export type GamePhase = 'idle' | 'countdown' | 'playing' | 'paused' | 'gameover'

interface GameState {
  screen: Screen
  phase: GamePhase
  countdown: number

  balance: number
  timeLeft: number
  tradesCount: number
  bestTrade: number
  worstTrade: number

  playerLane: Lane
  playerX: number
  targetLane: Lane

  waves: Wave[]
  currentWave: number
  nextWaveAt: number | null
  cardSpeed: number

  activePowerups: ActivePowerup[]
  insuranceActive: boolean
  appraisalActive: boolean
  slowMoActive: boolean
  doubleProfitActive: boolean

  pendingPowerups: PendingPowerupPick[]
  runId: string | null
  tradeFeedback: TradeFeedback | null
  powerupFeedback: PowerupFeedback | null
  cameraShake: CameraShake | null
  hitEffect: { x: number; z: number; correct: boolean; shownAt: number } | null

  runStats: GameRunStats | null
  endReason: GameEndReason | null

  setScreen: (screen: Screen) => void
  startGame: () => void
  tickCountdown: () => void
  updateGame: (delta: number) => void
  moveLeft: () => void
  moveRight: () => void
  endGame: (reason: GameEndReason) => void
  resetGame: () => void
  collectPendingPowerup: (pickId: string) => void
}

const initialRun = {
  balance: STARTING_BALANCE,
  timeLeft: GAME_DURATION_SEC,
  tradesCount: 0,
  bestTrade: 0,
  worstTrade: 0,
  playerLane: 0 as Lane,
  playerX: laneToX(0),
  targetLane: 0 as Lane,
  waves: [] as Wave[],
  currentWave: 0,
  nextWaveAt: null as number | null,
  cardSpeed: getWaveSpeed(1),
  activePowerups: [] as ActivePowerup[],
  insuranceActive: false,
  appraisalActive: false,
  slowMoActive: false,
  doubleProfitActive: false,
  pendingPowerups: [] as PendingPowerupPick[],
  runId: null as string | null,
  tradeFeedback: null as TradeFeedback | null,
  powerupFeedback: null as PowerupFeedback | null,
  cameraShake: null as CameraShake | null,
  hitEffect: null as { x: number; z: number; correct: boolean; shownAt: number } | null,
  runStats: null as GameRunStats | null,
  endReason: null as GameEndReason | null,
}

export const useGameStore = create<GameState>((set, get) => ({
  screen: 'menu',
  phase: 'idle',
  countdown: COUNTDOWN_SECONDS,
  ...initialRun,

  setScreen: (screen) => set({ screen }),

  startGame: () => {
    set({
      ...initialRun,
      screen: 'game',
      phase: 'countdown',
      countdown: COUNTDOWN_SECONDS,
      runId: crypto.randomUUID(),
      waves: [generateWave(1)],
      currentWave: 1,
      nextWaveAt: null,
      cardSpeed: getWaveSpeed(1),
    })
  },

  tickCountdown: () => {
    const { countdown } = get()
    if (countdown <= 0) {
      set({ phase: 'playing' })
      playSound('go')
      return
    }
    set({ countdown: countdown - 1 })
    if (countdown - 1 <= 0) {
      setTimeout(() => {
        set({ phase: 'playing' })
        playSound('go')
      }, COUNTDOWN_TICK_MS)
    }
  },

  moveLeft: () => {
    const { targetLane, phase } = get()
    if (phase !== 'playing' && phase !== 'countdown') return
    if (targetLane > 0) set({ targetLane: 0 })
  },

  moveRight: () => {
    const { targetLane, phase } = get()
    if (phase !== 'playing' && phase !== 'countdown') return
    if (targetLane < 1) set({ targetLane: 1 })
  },

  collectPendingPowerup: (pickId) => {
    const { pendingPowerups, balance } = get()
    const pick = pendingPowerups.find((p) => p.id === pickId)
    if (!pick) return

    const now = performance.now()
    if (now - pick.spawnedAt >= PENDING_POWERUP_TTL_MS) return

    playSound('powerup')
    const remaining = pendingPowerups.filter((p) => p.id !== pickId)
    const feedback = getPowerupCollectFeedback(pick.type)
    const powerupFeedback: PowerupFeedback = {
      title: feedback.title,
      detail: feedback.detail,
      icon: getPowerupIcon(pick.type),
      color: getPowerupColor(pick.type),
      shownAt: now,
    }

    if (pick.type === 'insurance') {
      set({ insuranceActive: true, pendingPowerups: remaining, powerupFeedback })
      return
    }
    if (pick.type === 'cash_bonus') {
      const bonus = getShopUpgradeValues().cashBonusAmount
      set({ balance: balance + bonus, pendingPowerups: remaining, powerupFeedback })
      return
    }

    const powerup = activatePowerup(pick.type, now)
    set({
      pendingPowerups: remaining,
      activePowerups: upsertActivePowerup(get().activePowerups, powerup),
      powerupFeedback,
    })
  },

  updateGame: (delta) => {
    const state = get()
    if (state.phase !== 'playing') return

    const now = performance.now()
    let timeLeft = state.timeLeft - delta

    if (timeLeft <= 0) {
      get().endGame('timeout')
      return
    }

    if (timeLeft <= 10 && Math.floor(timeLeft) !== Math.floor(state.timeLeft)) {
      playSound('tick')
    }

    const activePowerups = cleanExpiredPowerups(state.activePowerups, now)
    const slowMo = isPowerupActive(activePowerups, 'slow_mo', now)
    const appraisal = isPowerupActive(activePowerups, 'appraisal', now)
    const doubleProfit = isPowerupActive(activePowerups, 'double_profit', now)

    let speed = state.cardSpeed * (slowMo ? 0.45 : 1)
    let waves = state.waves.map((w) => updateWaveCards(w, delta, speed))

    const targetX = laneToX(state.targetLane)
    let playerX = smoothApproach(state.playerX, targetX, delta, LANE_MOVE_SMOOTH_SEC)
    if (Math.abs(playerX - targetX) < LANE_SNAP_EPSILON) playerX = targetX

    let balance = state.balance
    let tradesCount = state.tradesCount
    let bestTrade = state.bestTrade
    let worstTrade = state.worstTrade
    let currentWave = state.currentWave
    let nextWaveAt = state.nextWaveAt
    let insuranceActive = state.insuranceActive
    let pendingPowerups = expirePendingPowerups(state.pendingPowerups, now)
    let tradeFeedback = state.tradeFeedback
    let powerupFeedback = state.powerupFeedback
    let hitEffect = state.hitEffect
    let cameraShake: CameraShake | null = state.cameraShake

    if (tradeFeedback && now - tradeFeedback.shownAt > 600) {
      tradeFeedback = null
    }
    if (powerupFeedback && now - powerupFeedback.shownAt > 1400) {
      powerupFeedback = null
    }
    if (hitEffect && now - hitEffect.shownAt > 300) {
      hitEffect = null
    }

    const markHit = (waveId: number, cardId: string) => {
      waves = waves.map((w) =>
        w.id === waveId
          ? { ...w, cards: w.cards.map((c) => (c.id === cardId ? { ...c, hit: true } : c)) }
          : w
      )
    }

    const finishAndSchedule = (waveId: number) => {
      waves = finishWave(waves, waveId)
      nextWaveAt = now + WAVE_COOLDOWN_MS
    }

    for (const wave of waves) {
      for (const card of wave.cards) {
        if (card.hit || card.missed) continue
        if (!checkCardCollision(playerX, state.targetLane, card)) continue

        markHit(wave.id, card.id)

        const shopFx = getShopUpgradeValues()
        const result = executeTrade(balance, card.displayPrice, card.card.marketPrice, {
          doubleProfit,
          insurance: insuranceActive,
          insuranceMaxLoss: shopFx.insuranceMaxLoss,
        })

        if (!result.canAfford) {
          playSound('miss')
          hitEffect = { x: playerX, z: PLAYER_Z, correct: false, shownAt: now }
        } else {
          balance = result.newBalance
          tradesCount += 1
          bestTrade = Math.max(bestTrade, result.profit)
          worstTrade = Math.min(worstTrade, result.profit)

          tradeFeedback = {
            amount: result.profit,
            cardName: card.card.name,
            displayPrice: card.displayPrice,
            marketPrice: card.card.marketPrice,
            shownAt: now,
            emote: getEquippedEmoteText() ?? undefined,
          }

          if (result.profit >= 100) playSound('bigProfit')
          else if (result.profit > 0) playSound('profit')
          else if (result.profit < 0) playSound('loss')
          else playSound('buy')

          hitEffect = { x: playerX, z: PLAYER_Z, correct: result.profit >= 0, shownAt: now }
          cameraShake = {
            intensity: result.profit >= 0 ? 0.06 : 0.14,
            duration: 0.125,
            startTime: performance.now() / 1000,
          }

          if (insuranceActive && result.profit < 0) insuranceActive = false
          pendingPowerups = trySpawnPendingPowerup(pendingPowerups, now)
        }

        waves = waves.map((w) =>
          w.id === wave.id
            ? { ...w, cards: w.cards.map((c) => ({ ...c, missed: !c.hit })) }
            : w
        )
        finishAndSchedule(wave.id)
        break
      }
    }

    for (const wave of [...waves]) {
      let wavePassed = false
      for (const card of wave.cards) {
        if (card.hit || card.missed) continue
        if (card.z <= GATE_Z + 0.5) continue
        wavePassed = true
        waves = waves.map((w) =>
          w.id === wave.id
            ? { ...w, cards: w.cards.map((c) => ({ ...c, missed: true })) }
            : w
        )
      }
      if (wavePassed) {
        playSound('miss')
        finishAndSchedule(wave.id)
      }
    }

    if (!hasActiveWave(waves) && nextWaveAt !== null && now >= nextWaveAt) {
      currentWave += 1
      waves = [generateWave(currentWave)]
      nextWaveAt = null
    }

    set({
      waves,
      balance,
      timeLeft,
      tradesCount,
      bestTrade,
      worstTrade,
      currentWave,
      nextWaveAt,
      cardSpeed: getWaveSpeed(currentWave),
      playerX,
      playerLane: state.targetLane,
      activePowerups,
      insuranceActive,
      appraisalActive: appraisal,
      slowMoActive: slowMo,
      doubleProfitActive: doubleProfit,
      pendingPowerups,
      tradeFeedback,
      powerupFeedback,
      hitEffect,
      cameraShake,
    })

    if (balance <= 0) {
      playSound('bankrupt')
      get().endGame('bankrupt')
    }
  },

  endGame: (reason) => {
    const { balance, tradesCount, bestTrade, worstTrade, runId } = get()
    const profit = balance - STARTING_BALANCE
    const xpEarned = calculateRunXP(profit, tradesCount)
    const metaCoins = Math.max(0, Math.floor((profit / 10) * getShopUpgradeValues().metaCoinMultiplier))

    const runStats: GameRunStats = {
      runId: runId ?? crypto.randomUUID(),
      finalBalance: balance,
      startingBalance: STARTING_BALANCE,
      profit,
      tradesCount,
      bestTrade,
      worstTrade,
      endReason: reason,
      xpEarned,
      metaCoinsEarned: metaCoins,
    }

    set({
      phase: 'gameover',
      screen: 'gameover',
      runStats,
      endReason: reason,
    })
  },

  resetGame: () => {
    set({ ...initialRun, screen: 'menu', phase: 'idle' })
  },
}))
