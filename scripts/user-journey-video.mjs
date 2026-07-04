/**
 * Desktop user-journey video — signup → play → leaderboard → shop.
 * Run: npm run record-journey   (dev server must be on localhost:5173)
 */
import { chromium } from 'playwright'
import { mkdir, rename, readdir, unlink } from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.join(__dirname, '../videos')
const BASE = process.env.APP_URL ?? 'http://localhost:5173'
const TRAINER = `Demo${Date.now().toString().slice(-5)}`

/** Desktop 16:9 — app fills viewport (#root is 100% height) */
const VIEWPORT = { width: 1920, height: 1080 }

const STORAGE_KEYS = [
  'spot-the-fake:progression',
  'spot-the-fake:shop',
  'renaiss-pseudo',
  'renaiss-device-id',
  'renaiss-player-id',
  'renaiss-pseudo-draft',
]

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function gameState(page) {
  return page.evaluate(() => {
    const s = window.__game?.getState()
    if (!s) return null
    const active = s.waves?.flatMap((w) => w.cards).filter((c) => !c.hit && !c.missed) ?? []
    const closestZ = active.length ? Math.max(...active.map((c) => c.z)) : -999
    return {
      phase: s.phase,
      screen: s.screen,
      timeLeft: s.timeLeft,
      currentWave: s.currentWave,
      closestZ,
      tradeFeedback: Boolean(s.tradeFeedback),
      pendingPowerups: s.pendingPowerups?.length ?? 0,
    }
  })
}

/**
 * Wave 1: hesitate between lanes (rapid flip near the gate — old bug scenario).
 * Rest of run: one lane pick per wave, no spam.
 */
async function playFullGame(page) {
  let firstWaveStuntDone = false
  let lastWave = 0
  let lane = 0

  while (true) {
    const s = await gameState(page)
    if (!s || s.phase === 'gameover') break

    if (s.phase === 'playing') {
      if (!firstWaveStuntDone && s.currentWave === 1) {
        // Wait until cards are near the buy zone, then flip lanes quickly
        if (s.closestZ > -4.5) {
          await page.keyboard.press('ArrowRight')
          await wait(90)
          await page.keyboard.press('ArrowLeft')
          await wait(90)
          await page.keyboard.press('ArrowRight')
          await wait(90)
          firstWaveStuntDone = true
          lane = 1
          lastWave = 1
        }
      } else if (s.currentWave !== lastWave) {
        lastWave = s.currentWave
        lane = s.currentWave % 2 === 0 ? 0 : 1
        await page.keyboard.press(lane === 0 ? 'ArrowLeft' : 'ArrowRight')
      }
    }

    await wait(220)
  }

  await waitForScreen(page, 'gameover', 8000)
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

async function waitForScoreSync(page) {
  try {
    await page.waitForFunction(
      () => {
        const t = document.body.innerText
        return (
          t.includes('New personal best') ||
          t.includes('Good run') ||
          t.includes('Rewards saved') ||
          t.includes('Could not sync')
        )
      },
      { timeout: 20000 }
    )
  } catch {
    /* continue anyway */
  }
  await wait(2000)
}

async function tryConvertToMp4(webmPath, mp4Path) {
  try {
    execSync(
      `ffmpeg -y -i "${webmPath}" -c:v libx264 -pix_fmt yuv420p -movflags +faststart "${mp4Path}"`,
      { stdio: 'pipe' }
    )
    return true
  } catch {
    return false
  }
}

async function main() {
  await mkdir(OUT, { recursive: true })
  for (const f of await readdir(OUT)) {
    if (f.endsWith('.webm') || f.endsWith('.mp4')) {
      await unlink(path.join(OUT, f)).catch(() => {})
    }
  }

  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--enable-webgl', '--window-size=1920,1080'],
  })

  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
    recordVideo: {
      dir: OUT,
      size: VIEWPORT,
    },
    locale: 'en-US',
    colorScheme: 'light',
  })

  const page = await context.newPage()

  console.log(`Recording desktop journey → ${OUT}`)
  console.log(`Trainer: ${TRAINER}`)

  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.evaluate((keys) => keys.forEach((k) => localStorage.removeItem(k)), STORAGE_KEYS)
  await page.reload({ waitUntil: 'networkidle' })
  await wait(2000)

  // ── 1. Signup ──
  const nameInput = page.locator('input[placeholder*="Trainer"]')
  await nameInput.waitFor({ state: 'visible', timeout: 10000 })
  await wait(800)
  await nameInput.pressSequentially(TRAINER, { delay: 90 })
  await page.getByText('Ready ✓').waitFor({ state: 'visible', timeout: 10000 }).catch(() => {})
  await wait(800)

  // ── 2. Create account & play ──
  await page.locator('button').filter({ hasText: 'Create & Play' }).click()
  await waitForPhase(page, 'playing', 12000)
  await playFullGame(page)

  // ── 3. Game over + score sync ──
  await waitForScoreSync(page)
  await wait(1500)

  // ── 4. Leaderboard ──
  await page.locator('button').filter({ hasText: 'Menu' }).click()
  await wait(1200)
  await page.locator('button').filter({ hasText: 'Rank' }).click()
  await wait(2500)
  await page.locator('button').filter({ hasText: 'Today' }).click().catch(() => {})
  await wait(800)
  await page.locator('button').filter({ hasText: 'All Time' }).click().catch(() => {})
  await wait(2000)

  // ── 5. Shop tour ──
  await page.locator('button').filter({ hasText: 'Back' }).first().click()
  await wait(800)
  await page.locator('button').filter({ hasText: 'Shop' }).click()
  await wait(1500)

  for (const tab of ['Buddies', 'Trails', 'Power', 'Emotes']) {
    await page.locator('button').filter({ hasText: tab }).click()
    await wait(1400)
  }

  await wait(1500)

  const video = page.video()
  await context.close()
  await browser.close()

  if (!video) {
    throw new Error('No video recorded')
  }

  const rawPath = await video.path()
  const webmOut = path.join(OUT, 'user-journey-desktop.webm')
  const mp4Out = path.join(OUT, 'user-journey-desktop.mp4')

  await rename(rawPath, webmOut)
  console.log(`\n✓ Video saved: ${webmOut}`)

  if (await tryConvertToMp4(webmOut, mp4Out)) {
    console.log(`✓ MP4 copy:    ${mp4Out}`)
  } else {
    console.log('  (install ffmpeg for automatic MP4 export)')
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
