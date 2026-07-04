#!/usr/bin/env node
/**
 * Expands src/assets/cards/cards.json with popular Pokémon from SilphCo.
 * Skips tcgIds already in the manifest. Uses remote pokemontcg.io image URLs (no local downloads).
 *
 * Usage:
 *   node scripts/expand-silphco-classic-pool.mjs
 *   node scripts/expand-silphco-classic-pool.mjs --target 500
 *   node scripts/expand-silphco-classic-pool.mjs --dry-run
 *
 * After expanding, run: npm run materialize-pool-images
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import {
  loadEnv,
  marketPriceFromRow,
  rarityFromSilphco,
  silphcoSql,
} from './lib/silphco-api.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const MANIFEST_PATH = path.join(__dirname, '../src/assets/cards/cards.json')

function parseArgs() {
  const args = process.argv.slice(2)
  let target = 400
  let dryRun = false
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--target' && args[i + 1]) target = Number(args[++i])
    if (args[i] === '--dry-run') dryRun = true
  }
  return { target: Math.max(1, target), dryRun }
}

function extractTcgId(entry) {
  if (entry.tcgId) return entry.tcgId
  return entry.id.replace(/^(real|fake|card)-/, '')
}

function loadExistingIds(manifest) {
  const ids = new Set()
  const all = [
    ...(manifest.cards ?? []),
    ...(manifest.real ?? []),
    ...(manifest.fake ?? []),
    ...(manifest.pairs ?? []).flatMap((p) => [p.real, p.fake]),
  ]
  for (const entry of all) {
    if (!entry?.id) continue
    ids.add(extractTcgId(entry))
  }
  return ids
}

function rowToEntry(row) {
  const tcgId = row.tcg_card_id
  const image = row.image_small || row.image_url || row.image
  if (!tcgId || !row.name || !image) return null

  const marketPrice = marketPriceFromRow(row)
  if (marketPrice == null) return null

  return {
    id: `card-${tcgId}`,
    tcgId,
    name: row.name,
    rarity: rarityFromSilphco(row.rarity, marketPrice),
    image: String(image),
    set: row.set_name ?? '',
    marketPrice,
    source: 'silphco',
  }
}

async function fetchCandidateRows(fetchLimit) {
  const sql = `
    SELECT tcg_card_id, name, set_name, rarity, image_small,
           raw_median_price_usd, tvwap_price_usd, top_ungraded_price_usd, nm_price_usd,
           total_sales, sales_30d
    FROM pkmn_card_rollup
    WHERE image_small IS NOT NULL
      AND total_sales >= 3
    ORDER BY sales_30d DESC NULLS LAST, total_sales DESC
    LIMIT ${fetchLimit}
  `
  return silphcoSql(sql)
}

async function main() {
  loadEnv()
  const { target, dryRun } = parseArgs()

  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'))
  const existing = loadExistingIds(manifest)
  const before = manifest.cards?.length ?? 0

  console.log(`Existing classic pool: ${before} cards (${existing.size} unique tcgIds)`)
  console.log(`Fetching up to ${target + existing.size + 100} candidates from SilphCo…`)

  const rows = await fetchCandidateRows(target + existing.size + 200)
  const additions = []
  const seen = new Set(existing)

  for (const row of rows) {
    const tcgId = row.tcg_card_id
    if (!tcgId || seen.has(tcgId)) continue
    const entry = rowToEntry(row)
    if (!entry) continue
    seen.add(tcgId)
    additions.push(entry)
    if (additions.length >= target) break
  }

  console.log(`New cards to add: ${additions.length}`)
  if (additions.length === 0) {
    console.log('Nothing to add.')
    return
  }

  const priceSample = additions.slice(0, 5).map((c) => `${c.name} $${c.marketPrice}`)
  console.log('Sample:', priceSample.join(' · '))

  if (dryRun) {
    console.log('Dry run — cards.json unchanged.')
    return
  }

  manifest.source =
    'SilphCo Analytics + pokemontcg.io imagery — classic trading pool (remote images for SilphCo additions)'
  manifest.cards = [...(manifest.cards ?? []), ...additions]

  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n')
  console.log(`Done: ${before} → ${manifest.cards.length} classic pool cards (+${additions.length})`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
