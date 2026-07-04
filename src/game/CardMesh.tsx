import { Suspense } from 'react'
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard, useTexture } from '@react-three/drei'
import * as THREE from 'three'
import type { WaveCard } from '../types'
import { laneToX } from '../utils/math'
import { useGameStore } from '../store/gameStore'
import { CARD_FLOAT_Y } from '../utils/constants'
import { getCardScale } from './cardScale'
import { CardLabelSuspense } from './CardLabel'

/** Card art plane is 1.4 tall, centered at CARD_PIVOT_Y so bottom sits on y=0 before scale */
const CARD_PIVOT_Y = 0.7
/** Top edge of card art (y=0 is floor) */
const CARD_TOP_Y = CARD_PIVOT_Y + 0.7
/** Label stack sits above the card top edge (local units, scales with card) */
const LABEL_BASE_Y = CARD_TOP_Y + 0.28

interface CardMeshProps {
  waveCard: WaveCard
}

function CardSprite({ waveCard }: CardMeshProps) {
  const groupRef = useRef<THREE.Group>(null)
  const scaleRef = useRef<THREE.Group>(null)
  if (!waveCard.card.image) return null
  const texture = useTexture(waveCard.card.image)
  const cardId = waveCard.id
  const appraisalActive = useGameStore((s) => s.appraisalActive)

  texture.colorSpace = THREE.SRGBColorSpace

  useFrame(() => {
    if (!groupRef.current || !scaleRef.current) return
    const live = useGameStore
      .getState()
      .waves.flatMap((w) => w.cards)
      .find((c) => c.id === cardId)
    if (!live || live.hit || live.missed) {
      groupRef.current.visible = false
      return
    }
    groupRef.current.visible = true
    groupRef.current.position.set(laneToX(live.lane), CARD_FLOAT_Y, live.z)
    scaleRef.current.scale.setScalar(getCardScale(live.z))
  })

  return (
    <group ref={groupRef}>
      <Billboard follow>
        <group ref={scaleRef}>
          <group renderOrder={0}>
            <mesh position={[0, CARD_PIVOT_Y, 0]}>
              <planeGeometry args={[1, 1.4]} />
              <meshBasicMaterial
                map={texture}
                toneMapped={false}
                transparent
                side={THREE.DoubleSide}
                depthWrite={false}
              />
            </mesh>
          </group>
          <group position={[0, LABEL_BASE_Y, 0.14]} renderOrder={10}>
            <CardLabelSuspense waveCard={waveCard} appraisalActive={appraisalActive} />
          </group>
        </group>
      </Billboard>
    </group>
  )
}

export function CardMesh({ waveCard }: CardMeshProps) {
  if (!waveCard.card.image) return null
  return (
    <Suspense fallback={null}>
      <CardSprite waveCard={waveCard} />
    </Suspense>
  )
}

export function CardWaveRenderer() {
  const waves = useGameStore((s) => s.waves)
  const cards = waves.flatMap((w) => w.cards)

  return (
    <group>
      {cards.map((c) => (
        <CardMesh key={c.id} waveCard={c} />
      ))}
    </group>
  )
}
