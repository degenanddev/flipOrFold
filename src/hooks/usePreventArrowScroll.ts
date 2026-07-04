import { useEffect } from 'react'

const BLOCKED = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '])

/** drei KeyboardControls uses passive listeners — block game keys from scrolling the page */
export function usePreventArrowScroll(enabled = true) {
  useEffect(() => {
    if (!enabled) return

    const handler = (e: KeyboardEvent) => {
      if (BLOCKED.has(e.key)) e.preventDefault()
    }

    window.addEventListener('keydown', handler, { passive: false })
    return () => window.removeEventListener('keydown', handler)
  }, [enabled])
}
