#!/usr/bin/env node
/**
 * Fetches Pokémon TCG card images from pokemontcg.io into a unified trading pool.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const POOL_DIR = path.join(ROOT, 'src/assets/cards/pool')
const REAL_DIR = path.join(ROOT, 'src/assets/cards/real')
const FAKE_DIR = path.join(ROOT, 'src/assets/cards/fake')

/** Curated high-variety pool — classics, ex/GX/V/VMAX, promos */
const CARD_POOL = [
  // Base Set & early WOTC
  'base1-1', 'base1-2', 'base1-3', 'base1-4', 'base1-5', 'base1-6', 'base1-7', 'base1-8',
  'base1-9', 'base1-10', 'base1-11', 'base1-12', 'base1-13', 'base1-14', 'base1-15', 'base1-16',
  'base1-58', 'base1-62', 'base2-2', 'base2-3', 'base2-12', 'base2-15', 'base3-2', 'base3-4',
  'base3-15', 'base4-1', 'base4-2', 'base4-4', 'base4-10', 'base4-12', 'base4-13',
  'base5-1', 'base5-4', 'base5-14', 'fossil1-1', 'fossil1-3', 'fossil1-6', 'fossil1-10',
  'jungle1-1', 'jungle1-2', 'jungle1-4', 'jungle1-7', 'jungle1-16', 'gym1-2', 'gym1-5',
  'gym2-2', 'gym2-5', 'neo1-9', 'neo1-13', 'neo1-18',
  // XY / Sun & Moon / Sword & Shield / SV
  'xy1-54', 'xy1-125', 'sm1-152', 'sm1-161', 'sm1-171', 'swsh1-74', 'swsh1-99', 'swsh1-217',
  'sv1-86', 'sv1-198', 'sv1-205', 'sv3-86', 'sv3-125',
  // Promos & oddities (great price variance for trading)
  'g1-RC5', 'mcd19-6', 'ru1-1', 'ru1-3', 'ru1-6', 'ru1-8', 'ru1-9', 'pop3-1', 'pop5-1',
  'pop9-3', 'det1-10', 'det1-13', 'smp-SM04', 'smp-SM60', 'smp-SM144', 'smp-SM170', 'smp-SM228',
  'pl4-3', 'col1-23', 'bw1-114', 'ex14-17', 'mcd21-6', 'mcd22-6',
]

const PAIR_DEFS = [
  { realId: 'base1-4', fakeId: 'g1-RC5', name: 'Charizard' },
  { realId: 'base1-58', fakeId: 'mcd19-6', name: 'Pikachu' },
  { realId: 'base1-15', fakeId: 'ru1-1', name: 'Venusaur' },
  { realId: 'base1-2', fakeId: 'pop3-1', name: 'Blastoise' },
  { realId: 'base1-10', fakeId: 'ru1-9', name: 'Mewtwo' },
  { realId: 'base1-6', fakeId: 'ru1-6', name: 'Gyarados' },
  { realId: 'base1-16', fakeId: 'ru1-8', name: 'Zapdos' },
  { realId: 'base1-12', fakeId: 'ru1-3', name: 'Ninetales' },
  { realId: 'base1-8', fakeId: 'det1-13', name: 'Machamp' },
  { realId: 'base1-14', fakeId: 'pop9-3', name: 'Raichu' },
  { realId: 'base1-4', fakeId: 'smp-SM60', name: 'Charizard' },
  { realId: 'base1-58', fakeId: 'smp-SM04', name: 'Pikachu' },
  { realId: 'base1-10', fakeId: 'smp-SM228', name: 'Mewtwo' },
  { realId: 'base1-2', fakeId: 'base4-2', name: 'Blastoise' },
  { realId: 'base1-12', fakeId: 'base4-13', name: 'Ninetales' },
]

async function fetchCard(id) {
  const res = await fetch(`https://api.pokemontcg.io/v2/cards/${id}`)
  if (!res.ok) throw new Error(`API ${id}: ${res.status}`)
  const json = await res.json()
  return json.data
}

async function download(url, dest) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Download failed: ${url}`)
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()))
}

function rarityFromCard(card) {
  const r = (card.rarity || '').toLowerCase()
  if (r.includes('legend') || r.includes('secret') || r.includes('hyper') || r.includes('illustration rare')) return 'legendary'
  if (r.includes('ultra') || r.includes('holo rare') || r.includes('rare holo') || r.includes('vmax') || r.includes(' ex')) return 'epic'
  if (r.includes('rare') || r.includes('promo') || r.includes(' v')) return 'rare'
  return 'common'
}

function safeFile(id) {
  return `${id.replace(/[^a-z0-9-]/gi, '_')}.png`
}

async function buildEntry(tcgId, imageDir, idPrefix = 'card') {
  const file = safeFile(tcgId)
  const dest = path.join(imageDir, file)
  const relPath = `${path.basename(imageDir)}/${file}`

  const card = await fetchCard(tcgId)
  if (!fs.existsSync(dest)) await download(card.images.large, dest)

  return {
    id: `${idPrefix}-${tcgId}`,
    tcgId,
    name: card.name,
    rarity: rarityFromCard(card),
    image: relPath,
    set: card.set?.name ?? '',
  }
}

async function main() {
  fs.mkdirSync(POOL_DIR, { recursive: true })
  fs.mkdirSync(REAL_DIR, { recursive: true })
  fs.mkdirSync(FAKE_DIR, { recursive: true })

  const allIds = [...new Set([...CARD_POOL, ...PAIR_DEFS.flatMap((p) => [p.realId, p.fakeId])])]
  const cards = []
  const seen = new Set()

  for (const tcgId of allIds) {
    if (seen.has(tcgId)) continue
    seen.add(tcgId)
    process.stdout.write(`${tcgId}... `)
    try {
      const entry = await buildEntry(tcgId, POOL_DIR)
      cards.push(entry)
      console.log(entry.name)
    } catch (e) {
      console.log('skip:', e.message)
    }
    await new Promise((r) => setTimeout(r, 120))
  }

  const pairs = []
  const realList = []
  const fakeList = []
  const seenReal = new Set()
  const seenFake = new Set()

  for (const def of PAIR_DEFS) {
    const realEntry = cards.find((c) => c.tcgId === def.realId)
    const fakeEntry = cards.find((c) => c.tcgId === def.fakeId)
    if (!realEntry || !fakeEntry) continue

    pairs.push({
      id: `pair-${def.realId}-${def.fakeId}`,
      pokemon: def.name,
      real: { ...realEntry, id: `real-${def.realId}` },
      fake: { ...fakeEntry, id: `fake-${def.fakeId}` },
    })

    const r = pairs.at(-1).real
    const f = pairs.at(-1).fake
    if (!seenReal.has(r.id)) { seenReal.add(r.id); realList.push(r) }
    if (!seenFake.has(f.id)) { seenFake.add(f.id); fakeList.push(f) }
  }

  fs.writeFileSync(
    path.join(ROOT, 'src/assets/cards/cards.json'),
    JSON.stringify({
      source: 'https://pokemontcg.io — official Pokémon TCG imagery',
      note: 'Unified pool for card trading mode.',
      cards,
      pairs,
      real: realList,
      fake: fakeList,
    }, null, 2)
  )

  console.log(`\nDone: ${cards.length} cards in pool`)
}

main().catch(console.error)
