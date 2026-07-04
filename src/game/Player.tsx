import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameStore } from '../store/gameStore'
import { useShopStore, SHOP_ITEMS } from '../store/shopStore'
import { GAME_SPEED_MULTIPLIER } from '../utils/constants'

/** Palette presets per shop character — Pokémon-inspired buddies */
const BUDDY_PALETTES: Record<string, { body: string; belly: string; cheek: string; ear: string }> = {
  'char-rookie': { body: '#F5D020', belly: '#FFE566', cheek: '#FF6B6B', ear: '#3D3D3D' },
  'char-specialist': { body: '#7EC8E3', belly: '#B8E8FF', cheek: '#FF9ECD', ear: '#4A90A4' },
  'char-inspector': { body: '#C9A0FF', belly: '#E8D4FF', cheek: '#FFB347', ear: '#7B5EA7' },
  'char-elite': { body: '#FF9ECD', belly: '#FFD4E8', cheek: '#FF4757', ear: '#D63384' },
}

const DEFAULT_PALETTE = BUDDY_PALETTES['char-rookie']

export function Player() {
  const meshRef = useRef<THREE.Group>(null)
  const tailRef = useRef<THREE.Mesh>(null)
  const playerX = useGameStore((s) => s.playerX)
  const equippedCharacter = useShopStore((s) => s.equippedCharacter)
  const equippedTrail = useShopStore((s) => s.equippedTrail)

  const trailItem = SHOP_ITEMS.find((i) => i.id === equippedTrail)
  const trailColor = (trailItem?.meta?.trailColor as string) ?? '#ffd166'
  const palette = BUDDY_PALETTES[equippedCharacter] ?? DEFAULT_PALETTE

  useFrame((state) => {
    if (!meshRef.current) return
    meshRef.current.position.x = playerX
    const bounce = Math.abs(Math.sin(state.clock.elapsedTime * 10 * GAME_SPEED_MULTIPLIER)) * 0.06
    meshRef.current.position.y = 0.45 + bounce
    if (tailRef.current) {
      tailRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 8 * GAME_SPEED_MULTIPLIER) * 0.35 - 0.5
    }
  })

  return (
    <group ref={meshRef} position={[0, 0.45, 0.3]} rotation={[0, Math.PI, 0]}>
      {/* Body — round Pokémon torso */}
      <mesh castShadow position={[0, 0.42, 0]}>
        <sphereGeometry args={[0.42, 20, 20]} />
        <meshStandardMaterial color={palette.body} roughness={0.45} metalness={0.05} />
      </mesh>
      {/* Belly patch */}
      <mesh position={[0, 0.35, 0.32]}>
        <sphereGeometry args={[0.28, 16, 16]} />
        <meshStandardMaterial color={palette.belly} roughness={0.5} />
      </mesh>

      {/* Head */}
      <mesh castShadow position={[0, 0.88, 0.05]}>
        <sphereGeometry args={[0.36, 20, 20]} />
        <meshStandardMaterial color={palette.body} roughness={0.45} />
      </mesh>

      {/* Ears — long and cute (Eevee / Pikachu style) */}
      <mesh position={[-0.22, 1.18, -0.05]} rotation={[0.2, 0, -0.45]}>
        <coneGeometry args={[0.1, 0.38, 8]} />
        <meshStandardMaterial color={palette.body} roughness={0.45} />
      </mesh>
      <mesh position={[0.22, 1.18, -0.05]} rotation={[0.2, 0, 0.45]}>
        <coneGeometry args={[0.1, 0.38, 8]} />
        <meshStandardMaterial color={palette.body} roughness={0.45} />
      </mesh>
      <mesh position={[-0.22, 1.18, 0.02]} rotation={[0.2, 0, -0.45]}>
        <coneGeometry args={[0.055, 0.22, 8]} />
        <meshStandardMaterial color={palette.ear} roughness={0.5} />
      </mesh>
      <mesh position={[0.22, 1.18, 0.02]} rotation={[0.2, 0, 0.45]}>
        <coneGeometry args={[0.055, 0.22, 8]} />
        <meshStandardMaterial color={palette.ear} roughness={0.5} />
      </mesh>

      {/* Big kawaii eyes */}
      <mesh position={[-0.13, 0.9, 0.32]}>
        <sphereGeometry args={[0.11, 12, 12]} />
        <meshStandardMaterial color="#ffffff" roughness={0.2} />
      </mesh>
      <mesh position={[0.13, 0.9, 0.32]}>
        <sphereGeometry args={[0.11, 12, 12]} />
        <meshStandardMaterial color="#ffffff" roughness={0.2} />
      </mesh>
      <mesh position={[-0.11, 0.88, 0.4]}>
        <sphereGeometry args={[0.055, 10, 10]} />
        <meshStandardMaterial color="#1a1a2e" />
      </mesh>
      <mesh position={[0.15, 0.88, 0.4]}>
        <sphereGeometry args={[0.055, 10, 10]} />
        <meshStandardMaterial color="#1a1a2e" />
      </mesh>
      {/* Eye shine */}
      <mesh position={[-0.08, 0.93, 0.42]}>
        <sphereGeometry args={[0.025, 8, 8]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      <mesh position={[0.18, 0.93, 0.42]}>
        <sphereGeometry args={[0.025, 8, 8]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>

      {/* Cheeks */}
      <mesh position={[-0.28, 0.82, 0.28]} rotation={[0, 0.3, 0]}>
        <circleGeometry args={[0.07, 16]} />
        <meshBasicMaterial color={palette.cheek} transparent opacity={0.85} />
      </mesh>
      <mesh position={[0.28, 0.82, 0.28]} rotation={[0, -0.3, 0]}>
        <circleGeometry args={[0.07, 16]} />
        <meshBasicMaterial color={palette.cheek} transparent opacity={0.85} />
      </mesh>

      {/* Tiny nose */}
      <mesh position={[0, 0.82, 0.38]}>
        <sphereGeometry args={[0.03, 8, 8]} />
        <meshStandardMaterial color="#3d3d3d" />
      </mesh>

      {/* Mouth — small happy curve (dot smile) */}
      <mesh position={[0, 0.76, 0.37]}>
        <sphereGeometry args={[0.025, 8, 8]} />
        <meshStandardMaterial color="#3d3d3d" />
      </mesh>

      {/* Stubby arms */}
      <mesh position={[-0.38, 0.45, 0.1]} rotation={[0, 0, 0.6]}>
        <capsuleGeometry args={[0.07, 0.12, 4, 8]} />
        <meshStandardMaterial color={palette.body} roughness={0.45} />
      </mesh>
      <mesh position={[0.38, 0.45, 0.1]} rotation={[0, 0, -0.6]}>
        <capsuleGeometry args={[0.07, 0.12, 4, 8]} />
        <meshStandardMaterial color={palette.body} roughness={0.45} />
      </mesh>

      {/* Feet */}
      <mesh position={[-0.15, 0.08, 0.15]}>
        <sphereGeometry args={[0.1, 10, 10]} />
        <meshStandardMaterial color={palette.body} roughness={0.5} />
      </mesh>
      <mesh position={[0.15, 0.08, 0.15]}>
        <sphereGeometry args={[0.1, 10, 10]} />
        <meshStandardMaterial color={palette.body} roughness={0.5} />
      </mesh>

      {/* Tail */}
      <mesh ref={tailRef} position={[0, 0.55, -0.35]} rotation={[-0.5, 0, 0]}>
        <capsuleGeometry args={[0.06, 0.35, 4, 8]} />
        <meshStandardMaterial color={palette.body} roughness={0.45} />
      </mesh>

      <TrailParticles color={trailColor} />
    </group>
  )
}

function TrailParticles({ color }: { color: string }) {
  const ref = useRef<THREE.Points>(null)
  const count = 16
  const positions = new Float32Array(count * 3)

  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 0.35
    positions[i * 3 + 1] = Math.random() * 0.35 + 0.1
    positions[i * 3 + 2] = Math.random() * 0.8 + 0.5
  }

  useFrame((state) => {
    if (!ref.current) return
    const pos = ref.current.geometry.attributes.position.array as Float32Array
    for (let i = 0; i < count; i++) {
      pos[i * 3 + 2] += 0.035
      if (pos[i * 3 + 2] > 1.5) {
        pos[i * 3 + 2] = 0.4
        pos[i * 3] = (Math.random() - 0.5) * 0.35
      }
      pos[i * 3 + 1] = 0.15 + Math.sin(state.clock.elapsedTime * 6 + i) * 0.06
    }
    ref.current.geometry.attributes.position.needsUpdate = true
  })

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.14} color={color} transparent opacity={0.9} sizeAttenuation depthWrite={false} />
    </points>
  )
}
