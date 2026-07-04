#!/usr/bin/env node
/**
 * Adds One Piece TCG cards from SilphCo (?game=onepiece) to the classic pool.
 * Downloads TCGPlayer CDN images locally (WebGL-safe).
 *
 *   node scripts/expand-onepiece-classic-pool.mjs
 *   node scripts/expand-onepiece-classic-pool.mjs --target 80
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import {
  isIndividualOnePieceCard,
  isSealedProduct,
  listSilphcoCards,
  loadEnv,
  marketPriceFromRow,
  rarityFromSilphco,
} from './lib/silphco-api.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const MANIFEST_PATH = path.join(__dirname, '../src/assets/cards/cards.json')
const POOL_DIR = path.join(__dirname, '../src/assets/cards/pool')

const MAX_PLAY_PRICE = 800
const MIN_SALES = 3

function parseArgs() {
  let target = 80
  for (let i = 2; i < process.argv.length; i++) {
    if (process.argv[i] === '--target' && process.argv[i + 1]) target = Number(process.argv[++i])
  }
  return { target: Math.max(1, target) }
}

function safeFile(tcgId) {
  return tcgId.replace(/[^a-z0-9-]/gi, '_')
}

function imageExt(url) {
  if (url.includes('.png')) return 'png'
  if (url.includes('.webp')) return 'webp'
  return 'jpg'
}

function loadExistingIds(manifest) {
  const ids = new Set()
  for (const entry of manifest.cards ?? []) {
    if (entry.tcgId) ids.add(entry.tcgId)
    ids.add(entry.id.replace(/^card-/, ''))
  }
  return ids
}

function rowToManifestEntry(row) {
  const tcgId = row.tcg_card_id
  const imageUrl = row.image_small || row.image_url || row.image
  if (!tcgId || !row.name || !imageUrl) return null
  if (!isIndividualOnePieceCard(tcgId) || isSealedProduct(row)) return null

  const marketPrice = marketPriceFromRow(row)
  if (marketPrice == null || marketPrice > MAX_PLAY_PRICE) return null
  if ((row.total_sales ?? 0) < MIN_SALES && (row.sales_30d ?? 0) < 1) return null

  const ext = imageExt(String(imageUrl))
  const file = `${safeFile(tcgId)}.${ext}`

  return {
    id: `card-${tcgId}`,
    tcgId,
    name: row.name,
    game: 'one-piece',
    rarity: rarityFromSilphco(row.rarity, marketPrice, 'onepiece'),
    image: `pool/${file}`,
    set: row.set_name ?? '',
    marketPrice,
    source: 'silphco-onepiece',
    _imageUrl: String(imageUrl),
    _dest: path.join(POOL_DIR, file),
  }
}

async function downloadImage(url, dest) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length < 200) throw new Error('image too small')
  fs.writeFileSync(dest, buf)
}

async function fetchCandidates(target, existing) {
  const seen = new Set(existing)
  const candidates = []
  let offset = 0

  while (candidates.length < target + 50 && offset < 4000) {
    const rows = await listSilphcoCards({ limit: 200, offset, sort: 'volume', game: 'onepiece' })
    if (!rows.length) break

    for (const row of rows) {
      const tcgId = row.tcg_card_id
      if (!tcgId || seen.has(tcgId)) continue
      const entry = rowToManifestEntry(row)
      if (!entry) continue
      seen.add(tcgId)
      candidates.push(entry)
      if (candidates.length >= target + 20) break
    }

    offset += 200
    process.stdout.write(`  scanned offset ${offset}, candidates ${candidates.length}\r`)
    if (rows.length < 200) break
  }

  console.log(`\n  found ${candidates.length} candidate singles`)
  return candidates.slice(0, target)
}

async function main() {
  loadEnv()
  const { target } = parseArgs()
  fs.mkdirSync(POOL_DIR, { recursive: true })

  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'))
  const existing = loadExistingIds(manifest)
  const before = manifest.cards?.length ?? 0

  console.log(`Classic pool: ${before} cards · adding up to ${target} One Piece singles…`)

  const picks = await fetchCandidates(target, existing)
  const additions = []

  for (const entry of picks) {
    const { _imageUrl, _dest, ...card } = entry
    try {
      if (!fs.existsSync(_dest)) {
        await downloadImage(_imageUrl, _dest)
      }
      additions.push(card)
      process.stdout.write(`  ✓ ${card.name}\n`)
    } catch (err) {
      console.warn(`  skip ${card.tcgId}: ${err.message}`)
    }
  }

  if (!additions.length) {
    console.log('Nothing added.')
    return
  }

  manifest.cards = [...(manifest.cards ?? []), ...additions]
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n')
  console.log(`\nDone: ${before} → ${manifest.cards.length} (+${additions.length} One Piece)`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
