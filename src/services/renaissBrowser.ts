const API_BASE = import.meta.env.VITE_RENAISS_API_BASE?.trim() || 'https://api.renaissos.com'
/** Public card pages live on the index site, not the apex domain (renaissos.com often 522). */
const INDEX_BASE = import.meta.env.VITE_RENAISS_INDEX_URL?.trim() || 'https://index.renaissos.com'
const RATE_KEY = 'renaiss-api-rate'

export interface RenaissRateLimit {
  limit: number
  remaining: number
  reset: number
}

export interface RenaissSearchHit {
  name: string
  href: string
  game?: string
  setName?: string
  imageUrl?: string
  priceUsdCents?: number
  gradeLabel?: string
  company?: string
}

export interface RenaissCardDetail {
  name: string
  href: string
  game: string
  setName?: string
  imageUrl?: string
  priceUsdCents?: number
  gradeLabel?: string
  company?: string
  grade?: string
  deltaPct?: number
  confidence?: string
  lastSaleAt?: string
}

export interface RenaissTrade {
  source?: string
  observedAt?: string
  kind?: string
  priceUsdCents?: number | null
  currency?: string
  detail?: string | null
  sourceUrl?: string | null
  company?: string
  gradeLabel?: string
}

export interface RenaissOverviewGrade {
  company?: string
  grade?: string
  gradeLabel: string
  priceUsdCents?: number | null
  deltaPct?: number | null
  confidence?: string | null
  sourceCount?: number | null
}

export interface RenaissOverview {
  name: string
  setName?: string | null
  grades: RenaissOverviewGrade[]
}

export interface RenaissGradedBundle {
  detail: RenaissCardDetail | null
  trades: RenaissTrade[]
  tradesTotal: number
  overview: RenaissOverview | null
  rate: RenaissRateLimit | null
}

const bundleCache = new Map<string, RenaissGradedBundle>()

function readStoredRate(): RenaissRateLimit | null {
  try {
    const raw = sessionStorage.getItem(RATE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as RenaissRateLimit
  } catch {
    return null
  }
}

function storeRate(headers: Headers): RenaissRateLimit | null {
  const limit = Number(headers.get('x-ratelimit-limit'))
  const remaining = Number(headers.get('x-ratelimit-remaining'))
  const reset = Number(headers.get('x-ratelimit-reset'))
  if (!Number.isFinite(limit)) return readStoredRate()
  const state = { limit, remaining, reset }
  try {
    sessionStorage.setItem(RATE_KEY, JSON.stringify(state))
  } catch {
    /* ignore */
  }
  return state
}

export function getRenaissRateLimit(): RenaissRateLimit | null {
  return readStoredRate()
}

async function renaissGet<T>(path: string, params: Record<string, string | number | undefined> = {}): Promise<{
  data: T
  rate: RenaissRateLimit | null
}> {
  const url = new URL(path, API_BASE)
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v))
  }

  const headers: Record<string, string> = { accept: 'application/json' }
  const apiKey = import.meta.env.VITE_RENAISS_API_KEY?.trim()
  const apiSecret = import.meta.env.VITE_RENAISS_API_SECRET?.trim()
  if (apiKey && apiSecret) {
    headers['X-Api-Key'] = apiKey
    headers['X-Api-Secret'] = apiSecret
  }

  const res = await fetch(url.toString(), { headers })
  const rate = storeRate(res.headers)

  if (res.status === 429) {
    throw new Error('Renaiss API daily limit reached. Try cached results or tomorrow.')
  }
  if (!res.ok) {
    throw new Error(`Renaiss API error (${res.status})`)
  }

  const data = (await res.json()) as T
  return { data, rate }
}

export async function searchRenaissLive(
  query: string,
  limit = 12,
): Promise<{ hits: RenaissSearchHit[]; rate: RenaissRateLimit | null }> {
  const q = query.trim()
  if (q.length < 2) return { hits: [], rate: getRenaissRateLimit() }

  const { data, rate } = await renaissGet<{ results?: unknown[]; items?: unknown[] }>('/v1/search', {
    q,
    limit,
  })

  const rows = (data.results ?? data.items ?? []) as Record<string, unknown>[]
  const hits: RenaissSearchHit[] = rows
    .map((row) => ({
      name: String(row.name ?? ''),
      href: String(row.href ?? ''),
      game: row.game as string | undefined,
      setName: (row.setName ?? row.set_name) as string | undefined,
      imageUrl: (row.imageUrl ?? row.image_url) as string | undefined,
      priceUsdCents: (row.priceUsdCents ?? row.price_usd_cents) as number | undefined,
      gradeLabel: (row.gradeLabel ?? row.grade_label) as string | undefined,
      company: row.company as string | undefined,
    }))
    .filter((h) => h.name && h.href)

  return { hits, rate }
}

/** Parse /card/{game}/{set}/{card} from Renaiss href */
export function parseRenaissHref(href: string): { game: string; set: string; card: string } | null {
  const m = href.match(/^\/card\/([^/]+)\/([^/]+)\/([^/]+)/)
  if (!m) return null
  return { game: m[1], set: m[2], card: m[3] }
}

function mapCardDetail(data: Record<string, unknown>, href: string, game: string): RenaissCardDetail {
  return {
    name: String(data.name ?? ''),
    href,
    game,
    setName: (data.setName ?? data.set_name) as string | undefined,
    imageUrl: (data.imageUrl ?? data.image_url) as string | undefined,
    priceUsdCents: (data.priceUsdCents ?? data.price_usd_cents) as number | undefined,
    gradeLabel: (data.gradeLabel ?? data.grade_label) as string | undefined,
    company: data.company as string | undefined,
    grade: data.grade as string | undefined,
    deltaPct: data.deltaPct as number | undefined,
    confidence: data.confidence as string | undefined,
    lastSaleAt: (data.lastSaleAt ?? data.last_sale_at) as string | undefined,
  }
}

function mapTrade(row: Record<string, unknown>): RenaissTrade {
  return {
    source: row.source as string | undefined,
    observedAt: (row.observedAt ?? row.observed_at) as string | undefined,
    kind: row.kind as string | undefined,
    priceUsdCents: (row.priceUsdCents ?? row.price_usd_cents) as number | null | undefined,
    currency: row.currency as string | undefined,
    detail: row.detail as string | null | undefined,
    sourceUrl: (row.sourceUrl ?? row.source_url) as string | null | undefined,
    company: row.company as string | undefined,
    gradeLabel: (row.gradeLabel ?? row.grade_label) as string | undefined,
  }
}

function mapOverview(data: Record<string, unknown>): RenaissOverview {
  const gradesRaw = (data.grades ?? []) as Record<string, unknown>[]
  return {
    name: String(data.name ?? ''),
    setName: (data.setName ?? data.set_name) as string | null | undefined,
    grades: gradesRaw
      .map((g) => ({
        company: g.company as string | undefined,
        grade: g.grade as string | undefined,
        gradeLabel: String(g.gradeLabel ?? g.grade_label ?? ''),
        priceUsdCents: (g.priceUsdCents ?? g.price_usd_cents) as number | null | undefined,
        deltaPct: g.deltaPct as number | null | undefined,
        confidence: g.confidence as string | null | undefined,
        sourceCount: g.sourceCount as number | null | undefined,
      }))
      .filter((g) => g.gradeLabel),
  }
}

export async function fetchRenaissCardDetail(href: string): Promise<{
  card: RenaissCardDetail | null
  rate: RenaissRateLimit | null
}> {
  const parts = parseRenaissHref(href)
  if (!parts) return { card: null, rate: getRenaissRateLimit() }

  const { data, rate } = await renaissGet<Record<string, unknown>>(
    `/v1/cards/${parts.game}/${parts.set}/${parts.card}`,
  )

  return {
    rate,
    card: mapCardDetail(data, href, parts.game),
  }
}

export async function fetchRenaissTrades(
  href: string,
  limit = 12,
): Promise<{ trades: RenaissTrade[]; total: number; rate: RenaissRateLimit | null }> {
  const parts = parseRenaissHref(href)
  if (!parts) return { trades: [], total: 0, rate: getRenaissRateLimit() }

  const { data, rate } = await renaissGet<{ trades?: unknown[]; total?: number }>(
    `/v1/cards/${parts.game}/${parts.set}/${parts.card}/trades`,
    { limit },
  )

  const trades = (data.trades ?? []).map((row) => mapTrade(row as Record<string, unknown>))
  return { trades, total: Number(data.total ?? trades.length), rate }
}

export async function fetchRenaissOverview(href: string): Promise<{
  overview: RenaissOverview | null
  rate: RenaissRateLimit | null
}> {
  const parts = parseRenaissHref(href)
  if (!parts) return { overview: null, rate: getRenaissRateLimit() }

  const { data, rate } = await renaissGet<Record<string, unknown>>(
    `/v1/cards/${parts.game}/${parts.set}/${parts.card}/overview`,
  )

  return { overview: mapOverview(data), rate }
}

/** Detail + trades + overview in parallel (3 API calls). Cached per session. */
export async function fetchRenaissGradedBundle(
  href: string,
  opts?: { force?: boolean },
): Promise<RenaissGradedBundle> {
  if (!opts?.force && bundleCache.has(href)) {
    return bundleCache.get(href)!
  }

  const [detailRes, tradesRes, overviewRes] = await Promise.all([
    fetchRenaissCardDetail(href),
    fetchRenaissTrades(href, 10),
    fetchRenaissOverview(href),
  ])

  const bundle: RenaissGradedBundle = {
    detail: detailRes.card,
    trades: tradesRes.trades,
    tradesTotal: tradesRes.total,
    overview: overviewRes.overview,
    rate: overviewRes.rate ?? tradesRes.rate ?? detailRes.rate,
  }

  bundleCache.set(href, bundle)
  return bundle
}

export function renaissIndexUrl(href: string): string {
  if (!href) return INDEX_BASE

  if (href.startsWith('http://') || href.startsWith('https://')) {
    try {
      const u = new URL(href)
      if (u.hostname === 'renaissos.com' || u.hostname === 'www.renaissos.com') {
        return `${INDEX_BASE}${u.pathname}${u.search}${u.hash}`
      }
      return href
    } catch {
      return href
    }
  }

  const path = href.startsWith('/') ? href : `/${href}`
  return `${INDEX_BASE}${path}`
}

export function formatRenaissUsd(cents?: number | null): string {
  if (cents == null || !Number.isFinite(cents)) return '—'
  return `$${Math.round(cents / 100).toLocaleString()}`
}
