#!/usr/bin/env node
/** Adds marketPrice (USD) from Pokemon TCG API to cards.json entries */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const manifestPath = path.join(__dirname, '../src/assets/cards/cards.json')

function extractTcgId(entryId) {
  // card-base1-4, real-base1-4, fake-mcd19-6 -> base1-4 / mcd19-6
  return entryId.replace(/^(real|fake|card)-/, '')
}

async function fetchMarketPrice(tcgId) {
  const res = await fetch(`https://api.pokemontcg.io/v2/cards/${tcgId}`)
  if (!res.ok) return null
  const { data } = await res.json()
  const tcg = data.tcgplayer?.prices
  if (tcg) {
    const p = tcg.holofoil || tcg.normal || tcg.reverseHolofoil || Object.values(tcg)[0]
    if (p?.market) return Math.round(p.market)
    if (p?.mid) return Math.round(p.mid)
  }
  const cm = data.cardmarket?.prices
  if (cm?.trendPrice) return Math.round(cm.trendPrice)
  if (cm?.averageSellPrice) return Math.round(cm.averageSellPrice)
  return null
}

async function enrichEntry(entry) {
  if (entry.marketPrice) return entry
  const tcgId = extractTcgId(entry.id)
  const price = await fetchMarketPrice(tcgId)
  return { ...entry, marketPrice: price ?? fallbackPrice(entry.rarity) }
}

function fallbackPrice(rarity) {
  const map = { common: 15, rare: 45, epic: 120, legendary: 350 }
  return map[rarity] ?? 25
}

async function main() {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  const cache = new Map()

  async function getPrice(entry) {
    if (cache.has(entry.id)) return { ...entry, marketPrice: cache.get(entry.id) }
    const enriched = await enrichEntry(entry)
    cache.set(entry.id, enriched.marketPrice)
    await new Promise((r) => setTimeout(r, 120))
    return enriched
  }

  if (manifest.cards?.length) {
    manifest.cards = await Promise.all(manifest.cards.map(getPrice))
    console.log(`Enriched ${manifest.cards.length} pool cards`)
  }

  for (const pair of manifest.pairs ?? []) {
    pair.real = await getPrice(pair.real)
    pair.fake = await getPrice(pair.fake)
    console.log(`${pair.pokemon}: $${pair.real.marketPrice} vs $${pair.fake.marketPrice}`)
  }

  manifest.real = await Promise.all(manifest.real.map(getPrice))
  manifest.fake = await Promise.all(manifest.fake.map(getPrice))

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))
  console.log('Done — marketPrice added to cards.json')
}

main().catch(console.error)
