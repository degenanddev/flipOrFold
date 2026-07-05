import { useMemo } from 'react'
import type { CardData, Rarity } from '../types'
import { RARITY_COLORS } from '../utils/constants'
import { getAmbientShowcaseCards, getMenuShowcaseCards } from '../systems/cardLoader'

interface CardPlacement {
  card: CardData
  top?: string
  left?: string
  right?: string
  bottom?: string
  width: number
  /** Resting angle on the table — not synced across cards */
  angle: number
  opacity: number
  spin: boolean
  holo: boolean
  driftSec: number
  tiltSec: number
  delay: number
  blur?: number
}

export type FloatingCardsVariant = 'menu' | 'ambient'

/** Hand-placed in the margins — intentionally uneven, not mirrored */
const MENU_PLACEMENTS: Omit<CardPlacement, 'card'>[] = [
  {
    top: '4%',
    left: '-0.6rem',
    width: 78,
    angle: -17,
    opacity: 0.58,
    spin: false,
    holo: false,
    driftSec: 14,
    tiltSec: 11,
    delay: 0.4,
    blur: 0.4,
  },
  {
    top: '23%',
    right: '-0.35rem',
    width: 92,
    angle: 9,
    opacity: 0.82,
    spin: true,
    holo: true,
    driftSec: 17,
    tiltSec: 13,
    delay: 2.8,
  },
  {
    top: '54%',
    left: '0.15rem',
    width: 68,
    angle: -11,
    opacity: 0.5,
    spin: false,
    holo: false,
    driftSec: 12,
    tiltSec: 15,
    delay: 5.1,
    blur: 0.6,
  },
  {
    bottom: '7%',
    right: '0.4rem',
    width: 86,
    angle: 5,
    opacity: 0.74,
    spin: true,
    holo: false,
    driftSec: 16,
    tiltSec: 10,
    delay: 1.2,
  },
  {
    top: '41%',
    right: '-1.1rem',
    width: 62,
    angle: 14,
    opacity: 0.42,
    spin: false,
    holo: false,
    driftSec: 19,
    tiltSec: 12,
    delay: 3.6,
    blur: 0.8,
  },
]

/** Fewer, lighter placements for secondary screens */
const AMBIENT_PLACEMENTS: Omit<CardPlacement, 'card'>[] = [
  {
    top: '5%',
    left: '-0.35rem',
    width: 62,
    angle: -13,
    opacity: 0.5,
    spin: false,
    holo: false,
    driftSec: 16,
    tiltSec: 13,
    delay: 0.5,
    blur: 0.5,
  },
  {
    top: '20%',
    right: '-0.45rem',
    width: 70,
    angle: 10,
    opacity: 0.66,
    spin: true,
    holo: true,
    driftSec: 18,
    tiltSec: 14,
    delay: 2.2,
  },
  {
    bottom: '9%',
    left: '0.15rem',
    width: 56,
    angle: -7,
    opacity: 0.44,
    spin: false,
    holo: false,
    driftSec: 15,
    tiltSec: 12,
    delay: 3.8,
    blur: 0.65,
  },
]

const VARIANT_CONFIG = {
  menu: { placements: MENU_PLACEMENTS, getCards: getMenuShowcaseCards },
  ambient: { placements: AMBIENT_PLACEMENTS, getCards: getAmbientShowcaseCards },
} as const

function FloatingCard({
  card,
  top,
  left,
  right,
  bottom,
  width,
  angle,
  opacity,
  spin,
  holo,
  driftSec,
  tiltSec,
  delay,
  blur = 0,
}: CardPlacement) {
  const glow = RARITY_COLORS[card.rarity as Rarity] ?? RARITY_COLORS.rare

  return (
    <div
      className="menu-floating-card"
      style={{
        top,
        left,
        right,
        bottom,
        width: `${width}px`,
        opacity,
        transform: `rotate(${angle}deg)`,
        filter: blur > 0 ? `blur(${blur}px)` : undefined,
        ['--card-glow' as string]: glow,
        ['--drift-dur' as string]: `${driftSec}s`,
        ['--tilt-dur' as string]: `${tiltSec}s`,
        ['--spin-dur' as string]: `${tiltSec * 1.6}s`,
        ['--anim-delay' as string]: `${delay}s`,
      }}
      aria-hidden
    >
      <div className="menu-floating-card__drift">
        <div className={`menu-floating-card__body${spin ? ' menu-floating-card__body--spin' : ''}`}>
          <div className="menu-floating-card__frame">
            <img
              src={card.image}
              alt=""
              className="menu-floating-card__art"
              loading="lazy"
              draggable={false}
            />
            {holo && <div className="menu-floating-card__holo" />}
          </div>
        </div>
      </div>
    </div>
  )
}

export function MenuFloatingCards({ variant = 'menu' }: { variant?: FloatingCardsVariant }) {
  const cards = useMemo(() => {
    const { placements, getCards } = VARIANT_CONFIG[variant]
    const showcase = getCards()
    return placements.map((placement, i) => ({
      ...placement,
      card: showcase[i % showcase.length]!,
    }))
  }, [variant])

  return (
    <div className="menu-floating-cards pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {cards.map((item, i) => (
        <FloatingCard key={`${item.card.id}-${i}`} {...item} />
      ))}
    </div>
  )
}
