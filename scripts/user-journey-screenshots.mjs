/**
 * Full user journey — screenshots at each step (real 60s game).
 * Run: node scripts/user-journey-screenshots.mjs
 */
import { chromium } from 'playwright'
import { mkdir, readdir, unlink } from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.join(__dirname, '../test-screenshots')
const BASE = process.env.APP_URL ?? 'http://localhost:5173'
const TRAINER = `Trader${Date.now().toString().slice(-5)}`

const STORAGE_KEYS = [
  'spot-the-fake:progression',
  'spot-the-fake:shop',
  'renaiss-pseudo',
  'renaiss-device-id',
  'renaiss-player-id',
  'renaiss-pseudo-draft',
]

const SHOT_OPTS = { fullPage: false, animations: 'disabled' }

async function clearOldScreenshots() {
  await mkdir(OUT, { recursive: true })
  const files = await readdir(OUT)
  await Promise.all(files.filter((f) => f.endsWith('.png')).map((f) => unlink(path.join(OUT, f))))
}

async function shot(page, name) {
  await page.waitForTimeout(350)
  await page.screenshot({ path: path.join(OUT, `${name}.png`), ...SHOT_OPTS })
  console.log(`✓ ${name}.png`)
}

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function gameState(page) {
  return page.evaluate(() => {
    const s = window.__game?.getState()
    if (!s) return null
    return {
      phase: s.phase,
      screen: s.screen,
      timeLeft: s.timeLeft,
      balance: s.balance,
      tradeFeedback: Boolean(s.tradeFeedback),
      pendingPowerups: s.pendingPowerups?.length ?? 0,
      powerupFeedback: Boolean(s.powerupFeedback),
    }
  })
}

async function waitForPhase(page, phase, timeoutMs = 15000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const s = await gameState(page)
    if (s?.phase === phase) return s
    await wait(80)
  }
  throw new Error(`Timeout waiting for phase "${phase}"`)
}

async function waitForScreen(page, screen, timeoutMs = 15000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const s = await gameState(page)
    if (s?.screen === screen) return s
    await wait(80)
  }
  throw new Error(`Timeout waiting for screen "${screen}"`)
}

async function waitForText(page, text, timeoutMs = 12000) {
  await page.locator(`text=${text}`).first().waitFor({ state: 'visible', timeout: timeoutMs })
}

/** Play the full round — lane switching until natural game over */
async function playFullGame(page, capture) {
  const flags = {
    early: false,
    trade: false,
    mid: false,
    powerup: false,
    urgent: false,
  }
  let lane = 0
  const started = Date.now()

  while (true) {
    const s = await gameState(page)
    if (!s || s.phase === 'gameover') break

    if (s.phase === 'playing') {
      lane = lane === 0 ? 1 : 0
      await page.keyboard.press(lane === 0 ? 'ArrowLeft' : 'ArrowRight')

      const elapsed = (Date.now() - started) / 1000

      if (!flags.early && elapsed > 8 && s.timeLeft < 54) {
        flags.early = true
        await capture('09-gameplay-early')
      }
      if (!flags.trade && s.tradeFeedback) {
        flags.trade = true
        await capture('10-gameplay-trade')
      }
      if (!flags.mid && elapsed > 28 && s.timeLeft < 34) {
        flags.mid = true
        await capture('11-gameplay-mid')
      }
      if (!flags.powerup && s.pendingPowerups > 0) {
        flags.powerup = true
        await capture('12-gameplay-bonus')
      }
      if (!flags.urgent && s.timeLeft <= 12 && s.timeLeft > 8) {
        flags.urgent = true
        await capture('13-gameplay-final-seconds')
      }
    }

    await wait(260)
  }

  await waitForScreen(page, 'gameover', 8000)
}

async function main() {
  await clearOldScreenshots()

  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--enable-webgl'],
  })

  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  })

  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.evaluate((keys) => keys.forEach((k) => localStorage.removeItem(k)), STORAGE_KEYS)
  await page.reload({ waitUntil: 'networkidle' })
  await wait(1500)

  // ── 1. Fresh menu ──
  await shot(page, '01-menu-new-user')

  // ── 2. Pick trainer name ──
  const nameInput = page.locator('input[placeholder*="Trainer"]')
  await nameInput.fill(TRAINER)
  await wait(900)
  await shot(page, '02-name-ready')

  // ── 3–4. Browse shop ──
  await page.locator('button').filter({ hasText: 'Shop' }).click()
  await wait(800)
  await shot(page, '03-shop-buddies')

  await page.locator('button').filter({ hasText: 'Power' }).click()
  await wait(600)
  await shot(page, '04-shop-powerups')

  // ── 5. Leaderboard ──
  await page.locator('button').filter({ hasText: 'Back' }).first().click()
  await wait(500)
  await page.locator('button').filter({ hasText: 'Rank' }).click()
  await wait(1200)
  await shot(page, '05-leaderboard')

  // ── 6. Profile (before account) ──
  await page.locator('button').filter({ hasText: 'Back' }).first().click()
  await wait(400)
  await page.locator('button').filter({ hasText: 'Stats' }).click()
  await wait(700)
  await shot(page, '06-profile')

  // ── 7. Back to menu — name still in draft ──
  await page.locator('button').filter({ hasText: 'Back' }).first().click()
  await wait(600)
  await shot(page, '07-menu-name-draft')

  // ── 8. Create account & start ──
  await page.locator('button').filter({ hasText: 'Create & Play' }).click()
  await wait(400)
  await shot(page, '08-countdown')

  await waitForPhase(page, 'playing', 8000)

  const capture = async (name) => shot(page, name)
  await playFullGame(page, capture)

  // ── 9. Game over (wait for leaderboard check) ──
  await wait(2500)
  await shot(page, '14-game-over')

  // ── 10. Return to menu (returning user) ──
  await page.locator('button').filter({ hasText: 'Menu' }).click()
  await wait(800)
  await shot(page, '15-menu-returning-user')

  // ── 11. Reload — session restored from localStorage ──
  await page.reload({ waitUntil: 'networkidle' })
  await wait(1800)
  await shot(page, '16-menu-after-reload')

  // ── 12. Leaderboard with our score ──
  await page.locator('button').filter({ hasText: 'Rank' }).click()
  await wait(1500)
  await shot(page, '17-leaderboard-with-score')

  await browser.close()
  console.log(`\nScreenshots: ${OUT}`)
  console.log(`Trainer: ${TRAINER}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
