#!/usr/bin/env node
/**
 * Sync trading cards from Renaiss OS Index → Supabase trading_cards table.
 *
 * One-time fetch is enough for gameplay — cards are stored in Supabase and
 * served via get_trading_card_pool(). Re-run only when you want fresh prices.
 *
 * Prefer seeding cached JSON (no API quota):
 *   npm run seed-renaiss-cards
 *
 * Live API sync (10 requests/day/IP × 24 cards):
 * Usage:
 *   node scripts/sync-renaiss-cards.mjs
 *   node scripts/sync-renaiss-cards.mjs --calls 10 --limit 24
 *   node scripts/sync-renaiss-cards.mjs --strategy mixed
 *
 * Requires in .env:
 *   VITE_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 * Optional partner tier:
 *   RENAISS_API_KEY, RENAISS_API_SECRET
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'
import {
  loadEnv,
  fetchFeatured,
  fetchSearch,
  fetchIndices,
  normalizeFeaturedCard,
  CARDS_PER_REQUEST,
  DEFAULT_MAX_CALLS_PER_DAY,
} from './lib/renaiss-api.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const STATE_PATH = path.join(__dirname, '.renaiss-sync-state.json')

function parseArgs() {
  const args = process.argv.slice(2)
  const out = {
    calls: DEFAULT_MAX_CALLS_PER_DAY,
    limit: CARDS_PER_REQUEST,
    strategy: 'featured',
    dryRun: false,
  }
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--calls') out.calls = Math.max(1, Number(args[++i]) || out.calls)
    else if (args[i] === '--limit') out.limit = Math.min(24, Math.max(1, Number(args[++i]) || out.limit))
    else if (args[i] === '--strategy') out.strategy = args[++i] ?? 'featured'
    else if (args[i] === '--dry-run') out.dryRun = true
  }
  return out
}

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

function readState() {
  try {
    if (!fs.existsSync(STATE_PATH)) return { day: todayKey(), callsUsed: 0 }
    const raw = JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'))
    if (raw.day !== todayKey()) return { day: todayKey(), callsUsed: 0 }
    return { day: raw.day, callsUsed: raw.callsUsed ?? 0 }
  } catch {
    return { day: todayKey(), callsUsed: 0 }
  }
}

function writeState(state) {
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2))
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function buildCallPlan(strategy, maxCalls) {
  if (strategy === 'mixed') {
    const plan = []
    const games = ['pokemon', 'one-piece', 'lorcana', 'yugioh', 'magic']
    for (let i = 0; i < maxCalls; i++) {
      if (i % 2 === 0) plan.push({ type: 'featured' })
      else plan.push({ type: 'search', query: games[Math.floor(i / 2) % games.length] })
    }
    return plan
  }
  return Array.from({ length: maxCalls }, () => ({ type: 'featured' }))
}

async function executeCall(step, limit) {
  if (step.type === 'search') {
    return fetchSearch(step.query, limit)
  }
  return fetchFeatured(limit)
}

async function upsertCards(supabase, rows) {
  if (rows.length === 0) return 0
  const { error } = await supabase.from('trading_cards').upsert(rows, { onConflict: 'id' })
  if (error) throw new Error(`Supabase upsert: ${error.message}`)
  return rows.length
}

async function logSync(supabase, endpoint, count, rateLimit) {
  if (!supabase) return
  await supabase.from('renaiss_sync_log').insert({
    endpoint,
    cards_upserted: count,
    rate_limit_remaining: rateLimit?.remaining ?? null,
    rate_limit_reset: rateLimit?.reset
      ? new Date(rateLimit.reset * 1000).toISOString()
      : null,
  })
}

async function main() {
  loadEnv()
  const opts = parseArgs()
  const state = readState()

  const supabaseUrl = process.env.VITE_SUPABASE_URL?.trim()
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()

  if (!opts.dryRun && (!supabaseUrl || !serviceKey)) {
    console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env')
    process.exit(1)
  }

  const supabase = opts.dryRun ? null : createClient(supabaseUrl, serviceKey)

  const remainingBudget = Math.max(0, 10 - state.callsUsed)
  const callsToMake = Math.min(opts.calls, remainingBudget)

  if (callsToMake === 0) {
    console.log(`Daily Renaiss budget used (${state.callsUsed}/10). Try again tomorrow.`)
    process.exit(0)
  }

  console.log(`Renaiss sync — ${callsToMake} call(s) × ${opts.limit} cards (strategy: ${opts.strategy})`)
  console.log(`Already used today: ${state.callsUsed}/10`)

  const plan = await buildCallPlan(opts.strategy, callsToMake)
  let totalUpserted = 0
  let totalRaw = 0

  for (let i = 0; i < plan.length; i++) {
    const step = plan[i]
    const label = step.type === 'search' ? `search?q=${step.query}` : 'featured'
    console.log(`\n[${i + 1}/${plan.length}] GET /v1/... ${label}`)

    try {
      const { cards, rateLimit } = await executeCall(step, opts.limit)
      totalRaw += cards.length

      const rows = cards.map(normalizeFeaturedCard).filter(Boolean)
      console.log(`  → ${cards.length} returned, ${rows.length} valid`)

      if (rateLimit.remaining != null) {
        console.log(`  → rate limit remaining: ${rateLimit.remaining}`)
      }

      if (!opts.dryRun) {
        const n = await upsertCards(supabase, rows)
        await logSync(supabase, label, n, rateLimit)
        totalUpserted += n
      } else {
        totalUpserted += rows.length
        rows.slice(0, 2).forEach((r) => console.log(`    · ${r.game} — ${r.name} ($${r.market_price_usd})`))
      }

      state.callsUsed += 1
      writeState(state)

      if (i < plan.length - 1) await sleep(400)
    } catch (err) {
      if (err.code === 'RATE_LIMIT') {
        console.error('Hit Renaiss 429 — stopping early.')
        break
      }
      throw err
    }
  }

  console.log(`\nDone — ${totalUpserted} cards upserted (${totalRaw} raw from API)`)
  console.log(`Calls used today: ${state.callsUsed}/10`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
