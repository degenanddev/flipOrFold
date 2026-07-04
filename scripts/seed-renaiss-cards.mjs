#!/usr/bin/env node
/**
 * Seed cached Renaiss cards via Supabase RPC (no service role needed).
 * Uses scripts/data/renaiss-cards.json and upsert_trading_cards_seed().
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { loadEnv } from './lib/renaiss-api.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DEFAULT_FILE = path.join(__dirname, 'data/renaiss-cards.json')

async function rpc(url, key, fn, body) {
  const res = await fetch(`${url}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`${fn}: ${res.status} ${text}`)
  }
  return res.json()
}

async function main() {
  loadEnv()
  const file = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_FILE
  const url = process.env.VITE_SUPABASE_URL?.trim()
  const key = process.env.VITE_SUPABASE_ANON_KEY?.trim()
  if (!url || !key) {
    console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY')
    process.exit(1)
  }

  const cards = JSON.parse(fs.readFileSync(file, 'utf8')).filter(
    (c) => c.id && c.image_url && c.renaiss_href,
  )
  const chunkSize = 10
  let total = 0

  for (let i = 0; i < cards.length; i += chunkSize) {
    const chunk = cards.slice(i, i + chunkSize)
    const n = await rpc(url, key, 'upsert_trading_cards_seed', { p_cards: chunk })
    total += n ?? chunk.length
    console.log(`  chunk ${i / chunkSize + 1}: ${n ?? chunk.length} rows`)
  }

  console.log(`Done — ${total} cards seeded from ${file}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
