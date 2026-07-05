import cardsManifest from '../assets/cards/cards.json'
import type { CardData, Rarity } from '../types'
import { pickRandom } from '../utils/math'
import { fetchTradingCardPool, tradingRowToCardData } from '../supabase/tradingCards'
import { isSupabaseConfigured } from '../supabase/client'
import { readCardPoolMode, type CardPoolMode } from '../utils/cardPoolSettings'

interface ManifestEntry {
  id: string
  tcgId?: string
  name: string
  rarity: Rarity
  image: string
  set?: string
  marketPrice?: number
  game?: string
}

interface CardsManifest {
  cards?: ManifestEntry[]
  pairs?: unknown[]
  real: ManifestEntry[]
  fake: ManifestEntry[]
}

const manifest = cardsManifest as CardsManifest

const imageModules = import.meta.glob<string>('../assets/cards/**/*.{svg,png,jpg,webp}', {
  eager: true,
  import: 'default',
  query: '?url',
})

const FALLBACK: Record<Rarity, number> = {
  common: 12,
  rare: 40,
  epic: 100,
  legendary: 300,
}

function resolveImageUrl(relativePath: string, tcgId?: string): string {
  const candidates: string[] = []
  if (relativePath) candidates.push(relativePath.replace(/\\/g, '/'))
  if (tcgId) {
    const safe = tcgId.replace(/[^a-z0-9-]/gi, '_')
    candidates.push(`pool/${safe}.png`, `pool/${safe}.jpg`, `pool/${safe}.webp`)
  }

  for (const normalized of candidates) {
    if (normalized.startsWith('http://') || normalized.startsWith('https://')) continue
    const match = Object.entries(imageModules).find(([path]) => {
      const p = path.replace(/\\/g, '/')
      return p.endsWith(normalized) || p.includes(`/cards/${normalized}`)
    })
    if (match?.[1]) return match[1]
  }
  return ''
}

export function resolveCardImageUrl(image: string, tcgId?: string): string {
  return resolveImageUrl(image, tcgId)
}

function toCardData(entry: ManifestEntry): CardData {
  const tcgId = entry.tcgId ?? entry.id.replace(/^card-/, '')
  return {
    id: entry.id,
    image: resolveImageUrl(entry.image, tcgId),
    rarity: entry.rarity,
    name: entry.name,
    set: entry.set,
    marketPrice: entry.marketPrice ?? FALLBACK[entry.rarity],
    game: entry.game === 'one-piece' ? 'one-piece' : 'pokemon',
  }
}

let cardPool: CardData[] = []
let poolMode: CardPoolMode = 'both'
let poolSources: { renaiss: number; local: number } = { renaiss: 0, local: 0 }
let loadPromise: Promise<void> | null = null

function loadLocalManifestPool(): CardData[] {
  const source = manifest.cards?.length
    ? manifest.cards
    : [...manifest.real, ...manifest.fake]

  const seen = new Set<string>()
  const pool: CardData[] = []
  for (const entry of source) {
    if (seen.has(entry.id)) continue
    seen.add(entry.id)
    const card = toCardData(entry)
    if (card.image) pool.push(card)
  }
  return pool
}

function mergePools(renaiss: CardData[], local: CardData[], mode: CardPoolMode): CardData[] {
  if (mode === 'renaiss') return renaiss
  if (mode === 'local') return local

  const seen = new Set<string>()
  const merged: CardData[] = []
  for (const card of [...renaiss, ...local]) {
    if (seen.has(card.id)) continue
    seen.add(card.id)
    merged.push(card)
  }
  return merged
}

async function buildPool(mode: CardPoolMode): Promise<void> {
  const localPool = loadLocalManifestPool()
  let renaissPool: CardData[] = []

  if ((mode === 'renaiss' || mode === 'both') && isSupabaseConfigured()) {
    const rows = await fetchTradingCardPool()
    renaissPool = rows.map(tradingRowToCardData).filter((c) => c.image)
  }

  poolSources = { renaiss: renaissPool.length, local: localPool.length }
  cardPool = mergePools(renaissPool, localPool, mode)

  if (cardPool.length === 0) {
    cardPool = localPool
    poolSources = { renaiss: 0, local: localPool.length }
  }

  poolMode = mode

  if (import.meta.env.DEV) {
    console.info(
      `[cards] mode=${mode} pool=${cardPool.length} (renaiss=${poolSources.renaiss}, local=${poolSources.local})`,
    )
  }
}

/** Load card pool from Renaiss DB, local manifest, or both per user setting. */
export async function loadTradingCardPool(): Promise<void> {
  if (loadPromise) return loadPromise

  loadPromise = buildPool(readCardPoolMode())
  return loadPromise
}

/** Reload after changing card pool mode in menu. */
export async function reloadTradingCardPool(mode?: CardPoolMode): Promise<void> {
  loadPromise = buildPool(mode ?? readCardPoolMode())
  await loadPromise
  preloadCardImages()
}

export function getCardPoolModeActive(): CardPoolMode {
  return poolMode
}

export function getCardPoolSources(): { renaiss: number; local: number } {
  return poolSources
}

export function initCardPools(): void {
  if (cardPool.length === 0) cardPool = loadLocalManifestPool()
}

export function getRandomTradingCard(): CardData {
  if (cardPool.length === 0) initCardPools()
  const base = pickRandom(cardPool)
  return {
    ...base,
    id: `${base.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  }
}

export function getTwoDistinctCards(): [CardData, CardData] {
  if (cardPool.length === 0) initCardPools()
  const a = getRandomTradingCard()
  let b = getRandomTradingCard()
  let tries = 0
  while (b.name === a.name && tries < 8) {
    b = getRandomTradingCard()
    tries++
  }
  return [a, b]
}

export function preloadCardImages(): void {
  if (cardPool.length === 0) initCardPools()
  cardPool.forEach((card) => {
    if (!card.image) return
    const img = new Image()
    img.src = card.image
  })
}

export function getAllCards(): CardData[] {
  if (cardPool.length === 0) initCardPools()
  return cardPool
}

/** Iconic cards for menu background — mixes locals with Renaiss when loaded. */
const MENU_SHOWCASE_IDS = [
  'card-base1-4',
  'card-base1-58',
  'card-base1-10',
  'card-base1-15',
  'card-sv3-125',
] as const

/** Lighter set for shop / profile / etc. — Pokémon + One Piece from manifest only. */
const AMBIENT_SHOWCASE_IDS = [
  'card-base1-4',
  'card-base1-58',
  'card-op-OP04-014',
] as const

function getShowcaseCardsByIds(ids: readonly string[]): CardData[] {
  const localPool = loadLocalManifestPool()
  const byId = new Map(localPool.map((c) => [c.id, c]))
  const showcase: CardData[] = []

  for (const id of ids) {
    const card = byId.get(id)
    if (card?.image) showcase.push(card)
  }

  return showcase.length > 0 ? showcase : localPool.slice(0, ids.length)
}

export function getMenuShowcaseCards(): CardData[] {
  const showcase = getShowcaseCardsByIds(MENU_SHOWCASE_IDS)

  if (cardPool.length === 0) initCardPools()
  const renaiss = cardPool.filter((c) => c.gradeLabel || (c.game && c.game !== 'pokemon'))
  if (renaiss.length > 0 && showcase.length > 0) {
    showcase[showcase.length - 1] = renaiss[0]!
  }

  return showcase
}

export function getAmbientShowcaseCards(): CardData[] {
  return getShowcaseCardsByIds(AMBIENT_SHOWCASE_IDS)
}
