import { useEffect } from 'react'
import { KeyboardControls } from '@react-three/drei'
import { useGameStore } from './store/gameStore'
import { useSessionStore } from './store/sessionStore'
import { loadTradingCardPool, preloadCardImages } from './systems/cardLoader'
import { useCardPoolStore } from './store/cardPoolStore'
import { GAME_KEYBOARD_MAP } from './config/gameKeyboardMap'
import { GameCanvas } from './game/GameCanvas'
import { MenuScreen } from './components/MenuScreen'
import { ShopScreen } from './components/ShopScreen'
import { LeaderboardScreen } from './components/LeaderboardScreen'
import { ProfileScreen } from './components/ProfileScreen'
import { GameOverScreen } from './components/GameOverScreen'
import { GameHUD, CountdownOverlay } from './components/GameHUD'
import { CardDexScreen } from './components/CardDexScreen'
import { usePreventArrowScroll } from './hooks/usePreventArrowScroll'
import { useSwipeControls } from './hooks/useSwipeControls'

function handleGameKeyboard(name: string, pressed: boolean) {
  if (!pressed) return
  const { screen, phase, moveLeft, moveRight } = useGameStore.getState()
  if (screen !== 'game' || (phase !== 'playing' && phase !== 'countdown')) return
  if (name === 'left') moveLeft()
  else if (name === 'right') moveRight()
}

function AppContent() {
  const screen = useGameStore((s) => s.screen)
  const phase = useGameStore((s) => s.phase)
  const ready = useSessionStore((s) => s.ready)

  const isPlaying = screen === 'game' && (phase === 'playing' || phase === 'countdown')
  usePreventArrowScroll(isPlaying)
  useSwipeControls(isPlaying)

  if (!ready) {
    return (
      <div className="absolute inset-0 flex items-center justify-center kawaii-bg">
        <p className="font-display text-lg font-bold text-[#9b5de5] animate-pulse">Loading your account…</p>
      </div>
    )
  }

  return (
    <div className="relative w-full h-full">
      {(screen === 'game' || screen === 'gameover') && (
        <div className="absolute inset-0">
          <GameCanvas />
        </div>
      )}

      {screen === 'game' && (
        <>
          <GameHUD />
          <CountdownOverlay />
        </>
      )}

      {screen === 'menu' && <MenuScreen />}
      {screen === 'carddex' && <CardDexScreen />}
      {screen === 'shop' && <ShopScreen />}
      {screen === 'leaderboard' && <LeaderboardScreen />}
      {screen === 'profile' && <ProfileScreen />}
      {screen === 'gameover' && <GameOverScreen />}
    </div>
  )
}

export default function App() {
  useEffect(() => {
    void (async () => {
      await useSessionStore.getState().bootstrap()
      await loadTradingCardPool()
      useCardPoolStore.getState().syncCounts()
      preloadCardImages()
    })()

    if (import.meta.env.DEV) {
      ;(window as unknown as { __game?: typeof useGameStore }).__game = useGameStore
    }
  }, [])

  return (
    <KeyboardControls map={GAME_KEYBOARD_MAP} onChange={handleGameKeyboard}>
      <AppContent />
    </KeyboardControls>
  )
}
