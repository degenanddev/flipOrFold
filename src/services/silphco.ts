const API_BASE = 'https://silphcoanalytics.xyz/api/v3'

export function hasSilphcoApiKey(): boolean {
  return Boolean(import.meta.env.VITE_SILPHCO_API_KEY?.trim())
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
  const url = new URL(`${API_BASE}${path}`)
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v))
  }

  const res = await fetch(url.toString(), {
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${getApiKey()}`,
    },
  })

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

function mapBrief(row: RawSearchRow): SilphcoCardBrief | null {
  const id = String(row.tcg_card_id ?? '')
  const name = String(row.name ?? '')
  if (!id || !name) return null

  return {
    id,
    name,
    setName: String(row.set_name ?? ''),
    imageUrl: String(row.image_small ?? ''),
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

function mapDetail(row: RawSearchRow): SilphcoCardDetail | null {
  const brief = mapBrief(row)
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

export async function searchSilphcoCards(query: string, limit = 24): Promise<SilphcoCardBrief[]> {
  const q = query.trim()
  if (q.length < 2) return []

  const data = await silphcoGet<{ results?: RawSearchRow[] }>('/search', { q, limit })
  return (data.results ?? []).map(mapBrief).filter((c): c is SilphcoCardBrief => Boolean(c && c.imageUrl))
}

export async function getSilphcoCard(id: string): Promise<SilphcoCardDetail | null> {
  const data = await silphcoGet<RawSearchRow>(`/cards/${encodeURIComponent(id)}`, {
    include: 'price_history',
  })
  return mapDetail(data)
}

export function silphcoCardUrl(id: string): string {
  return `https://silphcoanalytics.xyz/cards/${encodeURIComponent(id)}`
}
