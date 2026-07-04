import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameStore } from '../store/gameStore'

export function HitEffects() {
  const hitEffect = useGameStore((s) => s.hitEffect)

  if (!hitEffect) return null

  return (
    <ParticleBurst
      key={`${hitEffect.x}-${hitEffect.z}-${hitEffect.shownAt}`}
      x={hitEffect.x}
      z={hitEffect.z}
      color={hitEffect.correct ? '#22c55e' : '#ef4444'}
    />
  )
}

function ParticleBurst({ x, z, color }: { x: number; z: number; color: string }) {
  const ref = useRef<THREE.Points>(null)
  const count = 40
  const life = useRef(0)

  const { positions, velocities } = useMemo(() => {
    const positions = new Float32Array(count * 3)
    const velocities = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      positions[i * 3] = x
      positions[i * 3 + 1] = 1.5
      positions[i * 3 + 2] = z
      velocities[i * 3] = (Math.random() - 0.5) * 4
      velocities[i * 3 + 1] = Math.random() * 3 + 1
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 4
    }
    return { positions, velocities }
  }, [x, z])

  useFrame((_, delta) => {
    if (!ref.current) return
    life.current += delta
    const pos = ref.current.geometry.attributes.position.array as Float32Array
    for (let i = 0; i < count; i++) {
      pos[i * 3] += velocities[i * 3] * delta
      pos[i * 3 + 1] += velocities[i * 3 + 1] * delta
      pos[i * 3 + 2] += velocities[i * 3 + 2] * delta
      velocities[i * 3 + 1] -= 5 * delta
    }
    ref.current.geometry.attributes.position.needsUpdate = true
    ;(ref.current.material as THREE.PointsMaterial).opacity = Math.max(0, 1 - life.current * 2)
  })

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.12} color={color} transparent opacity={1} blending={THREE.AdditiveBlending} depthWrite={false} />
    </points>
  )
}
