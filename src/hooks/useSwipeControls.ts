import { useEffect, useRef } from 'react'
import { useGameStore } from '../store/gameStore'

const SWIPE_THRESHOLD = 50

export function useSwipeControls(enabled = true) {
  const moveLeft = useGameStore((s) => s.moveLeft)
  const moveRight = useGameStore((s) => s.moveRight)
  const startX = useRef(0)
  const startY = useRef(0)

  useEffect(() => {
    if (!enabled) return

    const onTouchStart = (e: TouchEvent) => {
      startX.current = e.touches[0].clientX
      startY.current = e.touches[0].clientY
    }

    const onTouchEnd = (e: TouchEvent) => {
      const dx = e.changedTouches[0].clientX - startX.current
      const dy = e.changedTouches[0].clientY - startY.current

      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > SWIPE_THRESHOLD) {
        if (dx > 0) moveRight()
        else moveLeft()
      }
    }

    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchend', onTouchEnd, { passive: true })
    return () => {
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchend', onTouchEnd)
    }
  }, [enabled, moveLeft, moveRight])
}
