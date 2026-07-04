import fs from 'fs'
import path from 'path'

const API_BASE = 'https://silphcoanalytics.xyz/api/v3'

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

function getApiKey() {
  const key = process.env.VITE_SILPHCO_API_KEY?.trim() || process.env.SILPHCO_API_KEY?.trim()
  if (!key) throw new Error('Set VITE_SILPHCO_API_KEY (or SILPHCO_API_KEY) in .env')
  return key
}

async function silphcoGet(pathname, params = {}) {
  const url = new URL(`${API_BASE}${pathname}`)
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v))
  }
  const res = await fetch(url.toString(), {
    headers: { accept: 'application/json', authorization: `Bearer ${getApiKey()}` },
  })
  const body = await res.json()
  if (!res.ok) {
    const msg = body?.error?.message ?? body?.message ?? `SilphCo ${res.status}`
    throw new Error(msg)
  }
  return body.data
}

export async function silphcoSql(sql) {
  const res = await fetch(`${API_BASE}/sql`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      authorization: `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify({ sql }),
  })
  const body = await res.json()
  if (!res.ok) {
    const msg = body?.error?.message ?? body?.message ?? `SilphCo SQL ${res.status}`
    throw new Error(msg)
  }
  return body.data?.rows ?? []
}

export async function listSilphcoCards({ limit = 200, offset = 0, sort = 'volume', game = 'pokemon' } = {}) {
  const data = await silphcoGet('/cards', { limit, offset, sort, game })
  return data?.results ?? []
}

/** Sealed products use op-{digits} only; playable singles include set codes (op-OP01-064). */
export function isIndividualOnePieceCard(tcgCardId) {
  if (!tcgCardId?.startsWith('op-')) return false
  return !/^op-\d+$/i.test(tcgCardId)
}

const SEALED_NAME = /\b(booster box|booster pack|case|display|starter deck display|sealed)\b/i

export function isSealedProduct(row) {
  const id = String(row.tcg_card_id ?? '')
  const name = String(row.name ?? '')
  if (/^op-\d+$/i.test(id)) return true
  return SEALED_NAME.test(name)
}

export function rarityFromSilphco(rarity, priceUsd, game = 'pokemon') {
  const r = String(rarity ?? '').toLowerCase()
  if (game === 'onepiece') {
    if (r.includes('sec') || r.includes('secret') || r.includes('sp') || r.includes('manga')) return 'legendary'
    if (r.includes('sr') || r.includes('super rare') || r === 'l' || r.includes('leader')) return 'epic'
    if (r === 'r' || r.includes('rare') || r === 'uc' || r.includes('uncommon')) return 'rare'
    if (priceUsd >= 200) return 'legendary'
    if (priceUsd >= 60) return 'epic'
    if (priceUsd >= 15) return 'rare'
    return 'common'
  }
  if (r.includes('secret') || r.includes('hyper') || r.includes('illustration rare') || r.includes('special art')) {
    return 'legendary'
  }
  if (r.includes('ultra') || r.includes('double rare') || r.includes('rare holo') || r.includes('holo rare') || r.includes(' ex') || r.includes('vmax') || r.includes('vstar')) {
    return 'epic'
  }
  if (r.includes('rare') || r.includes('promo') || r.includes(' ace')) {
    return 'rare'
  }
  if (priceUsd >= 500) return 'legendary'
  if (priceUsd >= 120) return 'epic'
  if (priceUsd >= 25) return 'rare'
  return 'common'
}

export function marketPriceFromRow(row) {
  const raw = row.raw_median_price_usd ?? row.tvwap_price_usd ?? row.top_ungraded_price_usd ?? row.nm_price_usd
  if (raw == null || Number.isNaN(Number(raw))) return null
  const usd = Math.round(Number(raw))
  return Math.max(1, Math.min(2500, usd))
}
