import { Suspense, type ComponentProps } from 'react'
import { RoundedBox, Text } from '@react-three/drei'
import type { WaveCard } from '../types'
import {
  CARD_LABEL_FONT,
  KAWAII,
  formatCardPrice,
} from './cardLabelTheme'

const labelMat = { depthTest: false as const }

interface CardLabelProps {
  waveCard: WaveCard
  appraisalActive: boolean
}

function LabelText(props: ComponentProps<typeof Text>) {
  return (
    <Text
      font={CARD_LABEL_FONT}
      anchorX="center"
      anchorY="middle"
      material-depthTest={false}
      {...props}
    />
  )
}

export function CardLabel({ waveCard, appraisalActive }: CardLabelProps) {
  const name = waveCard.card.name.length > 18 ? `${waveCard.card.name.slice(0, 16)}…` : waveCard.card.name

  return (
    <group renderOrder={10}>
      {/* Kawaii drop shadow (panel-kawaii purple offset) */}
      <RoundedBox
        args={[1.14, 0.56, 0.03]}
        radius={0.052}
        smoothness={5}
        position={[0, -0.028, -0.02]}
        renderOrder={10}
      >
        <meshBasicMaterial color={KAWAII.purple} transparent opacity={0.22} {...labelMat} />
      </RoundedBox>

      {/* White panel body */}
      <RoundedBox args={[1.12, 0.54, 0.04]} radius={0.05} smoothness={5} renderOrder={11}>
        <meshBasicMaterial color={KAWAII.white} {...labelMat} />
      </RoundedBox>

      {/* Inner cream fill */}
      <RoundedBox args={[1.06, 0.48, 0.041]} radius={0.044} smoothness={5} position={[0, 0, 0.002]} renderOrder={12}>
        <meshBasicMaterial color={KAWAII.cream} transparent opacity={0.92} {...labelMat} />
      </RoundedBox>

      {/* Decorative accent — neutral, no deal/rip hint */}
      <mesh position={[0, 0.21, 0.022]} renderOrder={13}>
        <planeGeometry args={[1.02, 0.065]} />
        <meshBasicMaterial color={KAWAII.lavender} transparent opacity={0.85} {...labelMat} />
      </mesh>

      {/* Card name */}
      <LabelText
        position={[0, 0.1, 0.03]}
        fontSize={0.068}
        color={KAWAII.purple}
        maxWidth={0.98}
        renderOrder={14}
        outlineWidth={0.006}
        outlineColor={KAWAII.white}
      >
        {name.toUpperCase()}
      </LabelText>

      {/* Yellow price pill — matches menu kawaii yellow buttons */}
      <group position={[0, -0.05, 0.028]} renderOrder={14}>
        <RoundedBox args={[0.64, 0.155, 0.025]} radius={0.04} smoothness={5}>
          <meshBasicMaterial color={KAWAII.yellowDeep} {...labelMat} />
        </RoundedBox>
        <mesh position={[0, -0.038, -0.001]} renderOrder={13}>
          <planeGeometry args={[0.58, 0.04]} />
          <meshBasicMaterial color={KAWAII.purple} transparent opacity={0.12} {...labelMat} />
        </mesh>
        <LabelText
          position={[0, 0, 0.016]}
          fontSize={0.108}
          color={KAWAII.yellowText}
          renderOrder={15}
          outlineWidth={0.007}
          outlineColor={KAWAII.white}
        >
          {formatCardPrice(waveCard.displayPrice)}
        </LabelText>
      </group>

      {/* Appraisal reveal */}
      {appraisalActive && (
        <group position={[0, -0.2, 0.03]} renderOrder={14}>
          <RoundedBox args={[0.72, 0.1, 0.02]} radius={0.028} smoothness={4}>
            <meshBasicMaterial color="#dcfce7" {...labelMat} />
          </RoundedBox>
          <LabelText
            position={[0, 0, 0.012]}
            fontSize={0.052}
            color="#15803d"
            renderOrder={15}
            outlineWidth={0.004}
            outlineColor={KAWAII.white}
          >
            {`✦ worth ${formatCardPrice(waveCard.card.marketPrice)}`}
          </LabelText>
        </group>
      )}
    </group>
  )
}

export function CardLabelSuspense(props: CardLabelProps) {
  return (
    <Suspense fallback={null}>
      <CardLabel {...props} />
    </Suspense>
  )
}
