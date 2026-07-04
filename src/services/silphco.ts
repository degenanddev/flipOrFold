import cardsManifest from '../assets/cards/cards.json'
import { resolveCardImageUrl } from '../systems/cardLoader'

const DIRECT_API_BASE = 'https://silphcoanalytics.xyz/api/v3'
const PROXY_API_BASE = import.meta.env.VITE_SILPHCO_PROXY_URL?.trim() || '/api/silphco'

export type SilphcoGame = 'pokemon' | 'onepiece'

export function hasSilphcoApiKey(): boolean {
  if (import.meta.env.DEV) {
    return Boolean(import.meta.env.VITE_SILPHCO_API_KEY?.trim())
  }
  // Production: /api/silphco on Vercel uses server-side SILPHCO_API_KEY
  return true
}

function getApiBase(): string {
  return typeof window !== 'undefined' ? PROXY_API_BASE : DIRECT_API_BASE
}

function getApiKey(): string {
  const key = import.meta.env.VITE_SILPHCO_API_KEY?.trim()
  if (!key) throw new Error('Add VITE_SILPHCO_API_KEY to your .env file')
  return key
}

interface SilphcoEnvelope<T> {
  contract?: string
  data: T
  error?: { code?: string; message?: string }
}

async function silphcoGet<T>(path: string, params: Record<string, string | number | undefined> = {}): Promise<T> {
  const base = getApiBase()
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost'
  const url = new URL(`${base}${path}`, base.startsWith('http') ? undefined : origin)
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v))
  }

  const headers: Record<string, string> = { accept: 'application/json' }
  // Dev vite proxy forwards the client key; prod Vercel function injects server key
  if (import.meta.env.DEV) {
    headers.authorization = `Bearer ${getApiKey()}`
  }

  const res = await fetch(url.toString(), { headers })

  const body = (await res.json()) as SilphcoEnvelope<T> & { error?: string; message?: string }

  if (!res.ok) {
    const msg = body.error?.message ?? body.message ?? `SilphCo API error (${res.status})`
    throw new Error(typeof msg === 'string' ? msg : `SilphCo API error (${res.status})`)
  }

  return body.data
}

export interface SilphcoGradeRow {
  grader: string
  gradeLabel: string
  salesCount: number
  avgPriceUsd?: number
}

export interface SilphcoCardBrief {
  id: string
  name: string
  setName: string
  imageUrl: string
  game?: SilphcoGame
  rarity?: string
  avgPriceUsd?: number
  tvwapPriceUsd?: number
  psa10PriceUsd?: number
  psa9PriceUsd?: number
  sales30d?: number
  volume30d?: number
}

export interface SilphcoCardDetail extends SilphcoCardBrief {
  cardNumber?: string
  language?: string
  totalSales?: number
  totalVolumeUsd?: number
  sales7d?: number
  sales90d?: number
  psa8PriceUsd?: number
  tvwapConfidence?: string
  grades: SilphcoGradeRow[]
  priceHistory?: Array<{ date?: string; price_usd?: number }>
}

type RawSearchRow = Record<string, unknown>

function mapBrief(row: RawSearchRow, game: SilphcoGame = 'pokemon'): SilphcoCardBrief | null {
  const id = String(row.tcg_card_id ?? '')
  const name = String(row.name ?? '')
  if (!id || !name) return null

  const imageUrl = String(row.image_small ?? row.image_url ?? row.image ?? '')
  if (!imageUrl) return null

  return {
    id,
    name,
    setName: String(row.set_name ?? ''),
    imageUrl,
    game,
    rarity: row.rarity as string | undefined,
    avgPriceUsd: row.avg_price_usd as number | undefined,
    tvwapPriceUsd: row.tvwap_price_usd as number | undefined,
    psa10PriceUsd: row.psa10_price_usd as number | undefined,
    psa9PriceUsd: row.psa9_price_usd as number | undefined,
    sales30d: row.sales_30d as number | undefined,
    volume30d: row.volume_30d as number | undefined,
  }
}

function mapGrades(raw: unknown): SilphcoGradeRow[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((g) => {
      const row = g as Record<string, unknown>
      return {
        grader: String(row.grader ?? ''),
        gradeLabel: String(row.grade_label ?? ''),
        salesCount: Number(row.sales_count ?? 0),
        avgPriceUsd: row.avg_price_usd as number | undefined,
      }
    })
    .filter((g) => g.gradeLabel)
}

function mapDetail(row: RawSearchRow, game: SilphcoGame = 'pokemon'): SilphcoCardDetail | null {
  const brief = mapBrief(row, game)
  if (!brief) return null

  return {
    ...brief,
    cardNumber: row.card_number as string | undefined,
    language: row.language as string | undefined,
    totalSales: row.total_sales as number | undefined,
    totalVolumeUsd: row.total_volume_usd as number | undefined,
    sales7d: row.sales_7d as number | undefined,
    sales90d: row.sales_90d as number | undefined,
    psa8PriceUsd: row.psa8_price_usd as number | undefined,
    tvwapConfidence: row.tvwap_confidence as string | undefined,
    grades: mapGrades(row.grades),
    priceHistory: Array.isArray(row.price_history)
      ? (row.price_history as Array<{ date?: string; price_usd?: number }>)
      : undefined,
  }
}

export async function searchSilphcoCards(
  query: string,
  limit = 24,
  game: SilphcoGame = 'pokemon',
): Promise<SilphcoCardBrief[]> {
  const q = query.trim()
  if (q.length < 2) return []

  try {
    const data = await silphcoGet<{ results?: RawSearchRow[] }>('/search', { q, limit, game })
    return (data.results ?? [])
      .map((row) => mapBrief(row, game))
      .filter((c): c is SilphcoCardBrief => Boolean(c && c.imageUrl))
  } catch (err) {
    if (game === 'onepiece') {
      return searchLocalOnePieceCards(q, limit)
    }
    throw err
  }
}

export async function getSilphcoCard(id: string, game: SilphcoGame = 'pokemon'): Promise<SilphcoCardDetail | null> {
  const data = await silphcoGet<RawSearchRow>(`/cards/${encodeURIComponent(id)}`, {
    include: 'price_history',
    game,
  })
  return mapDetail(data, game)
}

export function silphcoCardUrl(id: string, game: SilphcoGame = 'pokemon'): string {
  const params = game === 'onepiece' ? '?game=onepiece' : ''
  return `https://silphcoanalytics.xyz/cards/${encodeURIComponent(id)}${params}`
}

/** Offline fallback — 79 bundled One Piece singles when SilphCo is unreachable */
function searchLocalOnePieceCards(query: string, limit: number): SilphcoCardBrief[] {
  const cards = (cardsManifest as { cards?: Array<Record<string, unknown>> }).cards ?? []
  const q = query.toLowerCase()
  return cards
    .filter((c) => c.game === 'one-piece' && String(c.name ?? '').toLowerCase().includes(q))
    .slice(0, limit)
    .map((c) => {
      const tcgId = String(c.tcgId ?? c.id ?? '').replace(/^card-/, '')
      const imageUrl = resolveCardImageUrl(String(c.image ?? ''), tcgId)
      return {
        id: tcgId,
        name: String(c.name ?? ''),
        setName: String(c.set ?? ''),
        imageUrl,
        game: 'onepiece' as const,
        rarity: c.rarity as string | undefined,
        tvwapPriceUsd: c.marketPrice as number | undefined,
      }
    })
    .filter((c) => c.id && c.imageUrl)
}
