import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGameStore } from '../store/gameStore'
import { COUNTDOWN_TICK_MS } from '../utils/constants'

export function useGameLoop() {
  const updateGame = useGameStore((s) => s.updateGame)
  const phase = useGameStore((s) => s.phase)
  const lastTime = useRef(performance.now())

  useFrame(() => {
    if (phase !== 'playing') return
    const now = performance.now()
    const delta = Math.min((now - lastTime.current) / 1000, 0.05)
    lastTime.current = now
    updateGame(delta)
  })
}

export function useCountdownLoop() {
  const phase = useGameStore((s) => s.phase)
  const tickCountdown = useGameStore((s) => s.tickCountdown)

  useEffect(() => {
    if (phase !== 'countdown') return

    const interval = setInterval(() => {
      tickCountdown()
    }, COUNTDOWN_TICK_MS)

    return () => clearInterval(interval)
  }, [phase, tickCountdown])
}
