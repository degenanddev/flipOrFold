import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameStore } from '../store/gameStore'
import { clamp } from '../utils/math'
import { GAME_SPEED_MULTIPLIER } from '../utils/constants'

export function CameraRig() {
  const { camera } = useThree()
  const shakeOffset = useRef(new THREE.Vector3())
  const playerX = useGameStore((s) => s.playerX)
  const cameraShake = useGameStore((s) => s.cameraShake)

  useFrame((_, delta) => {
    const idealX = playerX * 0.35
    const baseY = 4.2
    const baseZ = 8.5

    if (cameraShake) {
      const elapsed = performance.now() / 1000 - cameraShake.startTime
      if (elapsed < cameraShake.duration) {
        const decay = 1 - elapsed / cameraShake.duration
        shakeOffset.current.set(
          (Math.random() - 0.5) * cameraShake.intensity * decay * 2,
          (Math.random() - 0.5) * cameraShake.intensity * decay,
          0
        )
      } else {
        shakeOffset.current.set(0, 0, 0)
      }
    }

    camera.position.lerp(
      new THREE.Vector3(
        idealX + shakeOffset.current.x,
        baseY + shakeOffset.current.y,
        baseZ
      ),
      clamp(delta * 5 * GAME_SPEED_MULTIPLIER, 0, 1)
    )
    // Look further down the track so distant cards stay in view
    camera.lookAt(idealX * 0.25, 2.2, -18)
  })

  return null
}

export function FollowLight() {
  const lightRef = useRef<THREE.DirectionalLight>(null)
  const playerX = useGameStore((s) => s.playerX)

  useFrame(() => {
    if (lightRef.current) lightRef.current.position.x = playerX + 2
  })

  return (
    <directionalLight ref={lightRef} position={[2, 10, 6]} intensity={0.7} color="#fff9e6" castShadow />
  )
}
