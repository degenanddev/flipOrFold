import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { Player } from './Player'
import { CardWaveRenderer } from './CardMesh'
import { Environment, ScanGate } from './Environment'
import { CameraRig, FollowLight } from './CameraRig'
import { HitEffects } from './Effects'
import { useGameLoop, useCountdownLoop } from '../hooks/useGameLoop'

function GameScene() {
  useGameLoop()
  useCountdownLoop()

  return (
    <>
      <color attach="background" args={['#b8e0ff']} />
      <CameraRig />
      <FollowLight />
      <Environment />
      <ScanGate />
      <Player />
      <Suspense fallback={null}>
        <CardWaveRenderer />
      </Suspense>
      <HitEffects />
    </>
  )
}

export function GameCanvas() {
  return (
    <Canvas
      shadows
      camera={{ position: [0, 4.2, 8.5], fov: 58, near: 0.1, far: 120 }}
      gl={{ antialias: true, alpha: false }}
      dpr={[1, 2]}
      style={{ width: '100%', height: '100%' }}
    >
      <GameScene />
    </Canvas>
  )
}
