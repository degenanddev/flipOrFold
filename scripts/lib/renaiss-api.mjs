import fs from 'fs'
import path from 'path'

const BASE_URL = process.env.RENAISS_API_BASE ?? 'https://api.renaissos.com'

export const CARDS_PER_REQUEST = 24
export const DEFAULT_MAX_CALLS_PER_DAY = Number(process.env.RENAISS_MAX_CALLS_PER_DAY ?? 9)

export function loadEnv() {
  const envPath = path.join(process.cwd(), '.env')
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = val
  }
}

export function hrefToId(href) {
  if (!href) return `renaiss-${Date.now()}`
  return href
    .replace(/^\/card\//, '')
    .replace(/\//g, '-')
    .toLowerCase()
    .slice(0, 120)
}

export function priceToRarity(priceUsdCents) {
  const usd = (priceUsdCents ?? 0) / 100
  if (usd >= 5000) return 'legendary'
  if (usd >= 500) return 'epic'
  if (usd >= 50) return 'rare'
  return 'common'
}

export function priceToMarketUsd(priceUsdCents) {
  const usd = Math.round((priceUsdCents ?? 0) / 100)
  return Math.max(5, usd)
}

export function normalizeFeaturedCard(card) {
  const id = hrefToId(card.href)
  const priceUsdCents = card.priceUsdCents ?? 0
  const imageUrl = card.imageUrl ?? card.imageUrlThumb ?? ''
  if (!imageUrl || !card.href) return null

  return {
    id,
    game: card.game ?? 'unknown',
    game_type: card.type ?? null,
    name: card.name ?? 'Unknown',
    set_name: card.setName ?? null,
    set_code: card.setCode ?? null,
    card_number: card.cardNumber ?? null,
    variation: card.variation ?? null,
    language: card.language ?? null,
    image_url: imageUrl,
    image_url_thumb: card.imageUrlThumb ?? null,
    grade_company: card.company ?? null,
    grade: card.grade ?? null,
    grade_label: card.gradeLabel ?? null,
    price_usd_cents: priceUsdCents,
    market_price_usd: priceToMarketUsd(priceUsdCents),
    rarity: priceToRarity(priceUsdCents),
    delta_pct: card.deltaPct ?? null,
    confidence: card.confidence ?? null,
    last_sale_at: card.lastSaleAt ?? null,
    renaiss_href: card.href,
    source: 'renaiss',
    active: true,
    fetched_at: new Date().toISOString(),
  }
}

export async function renaissFetch(pathname, searchParams = {}) {
  const url = new URL(pathname, BASE_URL)
  for (const [k, v] of Object.entries(searchParams)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v))
  }

  const headers = { accept: 'application/json' }
  const apiKey = process.env.RENAISS_API_KEY?.trim()
  const apiSecret = process.env.RENAISS_API_SECRET?.trim()
  if (apiKey && apiSecret) {
    headers['X-Api-Key'] = apiKey
    headers['X-Api-Secret'] = apiSecret
  }

  const res = await fetch(url.toString(), { headers })
  const remaining = res.headers.get('x-ratelimit-remaining')
  const limitHdr = res.headers.get('x-ratelimit-limit')
  const reset = res.headers.get('x-ratelimit-reset')
  const retryAfter = res.headers.get('retry-after')

  if (res.status === 429) {
    const err = new Error(`Renaiss rate limit (429). Retry after ${retryAfter ?? '?'}s`)
    err.code = 'RATE_LIMIT'
    err.reset = reset
    throw err
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Renaiss ${res.status} ${pathname}: ${body.slice(0, 200)}`)
  }

  const data = await res.json()
  return {
    data,
    rateLimit: {
      remaining: remaining != null ? Number(remaining) : null,
      limit: limitHdr != null ? Number(limitHdr) : null,
      reset: reset != null ? Number(reset) : null,
    },
  }
}

export async function fetchFeatured(limit = CARDS_PER_REQUEST) {
  const { data, rateLimit } = await renaissFetch('/v1/cards/featured', { limit })
  const cards = Array.isArray(data?.cards) ? data.cards : []
  return { cards, rateLimit }
}

export async function fetchSearch(query, limit = CARDS_PER_REQUEST) {
  const { data, rateLimit } = await renaissFetch('/v1/search', { q: query, limit })
  const items = Array.isArray(data?.results)
    ? data.results
    : Array.isArray(data?.cards)
      ? data.cards
      : []
  return { cards: items, rateLimit }
}

export async function fetchIndices() {
  const { data, rateLimit } = await renaissFetch('/v1/indices')
  return { data, rateLimit }
}
