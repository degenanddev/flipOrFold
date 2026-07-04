#!/usr/bin/env node
/**
 * Downloads classic pool card art into src/assets/cards/pool/ and rewrites
 * cards.json to use local paths (required for Three.js — pokemontcg.io has no CORS).
 *
 * Usage:
 *   node scripts/materialize-classic-pool-images.mjs
 *   node scripts/materialize-classic-pool-images.mjs --prune-failed
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { loadEnv, marketPriceFromRow, silphcoSql } from './lib/silphco-api.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const MANIFEST_PATH = path.join(ROOT, 'src/assets/cards/cards.json')
const POOL_DIR = path.join(ROOT, 'src/assets/cards/pool')

const FETCH_DELAY_MS = 80
const CONCURRENCY = 6

function parseArgs() {
  const pruneFailed = process.argv.includes('--prune-failed')
  return { pruneFailed }
}

function safeFile(tcgId) {
  return `${tcgId.replace(/[^a-z0-9-]/gi, '_')}.png`
}

function poolRelPath(tcgId) {
  return `pool/${safeFile(tcgId)}`
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function headOk(url) {
  try {
    const res = await fetch(url, { method: 'HEAD' })
    return res.ok
  } catch {
    return false
  }
}

async function fetchPokemonCard(tcgId) {
  const res = await fetch(`https://api.pokemontcg.io/v2/cards/${encodeURIComponent(tcgId)}`)
  if (!res.ok) return null
  const json = await res.json()
  return json.data ?? null
}

async function resolveImageUrls(tcgId, currentUrl) {
  const urls = []
  if (currentUrl?.startsWith('http')) urls.push(currentUrl)

  const dash = tcgId.lastIndexOf('-')
  if (dash > 0) {
    const setId = tcgId.slice(0, dash)
    const num = tcgId.slice(dash + 1)
    urls.push(
      `https://images.pokemontcg.io/${setId}/${num}.png`,
      `https://images.pokemontcg.io/${setId}/${num}_hires.png`,
    )
  }

  const apiCard = await fetchPokemonCard(tcgId)
  if (apiCard?.images) {
    if (apiCard.images.large) urls.push(apiCard.images.large)
    if (apiCard.images.small) urls.push(apiCard.images.small)
  }

  const seen = new Set()
  const unique = urls.filter((u) => {
    if (!u || seen.has(u)) return false
    seen.add(u)
    return true
  })

  for (const url of unique) {
    if (await headOk(url)) return url
    await sleep(40)
  }
  return null
}

async function downloadToFile(url, dest) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length < 200) throw new Error('file too small')
  fs.writeFileSync(dest, buf)
}

function fallbackPrice(rarity) {
  const map = { common: 15, rare: 45, epic: 120, legendary: 350 }
  return map[rarity] ?? 25
}

async function fetchPokemonMarketPrice(tcgId) {
  const card = await fetchPokemonCard(tcgId)
  if (!card) return null
  const tcg = card.tcgplayer?.prices
  if (tcg) {
    const p = tcg.holofoil || tcg.normal || tcg.reverseHolofoil || Object.values(tcg)[0]
    if (p?.market) return Math.round(p.market)
    if (p?.mid) return Math.round(p.mid)
  }
  const cm = card.cardmarket?.prices
  if (cm?.trendPrice) return Math.round(cm.trendPrice)
  if (cm?.averageSellPrice) return Math.round(cm.averageSellPrice)
  return null
}

async function fetchSilphcoPrice(tcgId) {
  try {
    loadEnv()
    const rows = await silphcoSql(`
      SELECT raw_median_price_usd, tvwap_price_usd, top_ungraded_price_usd, nm_price_usd
      FROM pkmn_card_rollup
      WHERE tcg_card_id = '${tcgId.replace(/'/g, "''")}'
      LIMIT 1
    `)
    if (!rows[0]) return null
    return marketPriceFromRow(rows[0])
  } catch {
    return null
  }
}

async function enrichPrice(entry) {
  if (entry.marketPrice != null && entry.marketPrice > 0) return entry.marketPrice
  const fromTcg = await fetchPokemonMarketPrice(entry.tcgId)
  if (fromTcg != null && fromTcg > 0) return fromTcg
  const fromSilph = await fetchSilphcoPrice(entry.tcgId)
  if (fromSilph != null && fromSilph > 0) return fromSilph
  return fallbackPrice(entry.rarity)
}

async function processCard(entry, { pruneFailed }) {
  const tcgId = entry.tcgId ?? entry.id.replace(/^card-/, '')
  const dest = path.join(POOL_DIR, safeFile(tcgId))
  const rel = poolRelPath(tcgId)
  const hasLocal = fs.existsSync(dest)

  if (hasLocal && !entry.image?.startsWith('http')) {
    let marketPrice = entry.marketPrice
    if (marketPrice == null || marketPrice <= 0) {
      marketPrice = await enrichPrice({ ...entry, tcgId })
      await sleep(FETCH_DELAY_MS)
    }
    return { ...entry, tcgId, image: rel, marketPrice }
  }

  const sourceUrl = entry.image?.startsWith('http') ? entry.image : null
  const url = await resolveImageUrls(tcgId, sourceUrl)
  if (!url) {
    if (pruneFailed) return null
    throw new Error(`No image for ${tcgId}`)
  }

  if (!hasLocal) {
    await downloadToFile(url, dest)
  }

  let marketPrice = entry.marketPrice
  if (marketPrice == null || marketPrice <= 0) {
    marketPrice = await enrichPrice({ ...entry, tcgId })
  }
  await sleep(FETCH_DELAY_MS)
  return { ...entry, tcgId, image: rel, marketPrice }
}

async function runPool(inParallel, items, worker) {
  const results = []
  let i = 0
  async function workerLoop() {
    while (i < items.length) {
      const idx = i++
      results[idx] = await worker(items[idx])
    }
  }
  await Promise.all(Array.from({ length: inParallel }, () => workerLoop()))
  return results
}

async function main() {
  const { pruneFailed } = parseArgs()
  fs.mkdirSync(POOL_DIR, { recursive: true })

  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'))
  const cards = manifest.cards ?? []
  const needsWork = cards.filter(
    (c) => c.image?.startsWith('http') || !c.marketPrice || !fs.existsSync(path.join(POOL_DIR, safeFile(c.tcgId ?? c.id.replace(/^card-/, '')))),
  )

  console.log(`Pool: ${cards.length} cards, ${needsWork.length} need download/price fix`)

  let done = 0
  const updated = await runPool(CONCURRENCY, cards, async (entry) => {
    try {
      const next = await processCard(entry, { pruneFailed })
      done++
      if (done % 25 === 0 || done === cards.length) {
        console.log(`  ${done}/${cards.length}`)
      }
      return next
    } catch (err) {
      console.warn(`  skip ${entry.tcgId ?? entry.id}: ${err.message}`)
      return pruneFailed ? null : entry
    }
  })

  const finalCards = updated.filter(Boolean)
  if (finalCards.length < cards.length) {
    console.log(`Pruned ${cards.length - finalCards.length} cards without images`)
  }

  manifest.source =
    'SilphCo Analytics + pokemontcg.io — local pool/ images for WebGL (run materialize-classic-pool-images.mjs after expanding)'
  manifest.cards = finalCards

  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n')
  console.log(`Done: ${finalCards.length} cards, ${fs.readdirSync(POOL_DIR).filter((f) => f.endsWith('.png')).length} PNGs in pool/`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
