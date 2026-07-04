type SoundKind = 'buy' | 'profit' | 'loss' | 'bigProfit' | 'bankrupt' | 'tick' | 'powerup' | 'go' | 'miss'

let ctx: AudioContext | null = null
let unlocked = false

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) ctx = new AudioContext()
  return ctx
}

export function unlockAudio(): void {
  const c = getCtx()
  if (!c || unlocked) return
  c.resume()
  unlocked = true
}

function beep(freq: number, dur: number, type: OscillatorType = 'square', vol = 0.08, when = 0) {
  const c = getCtx()
  if (!c) return
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = type
  osc.frequency.value = freq
  gain.gain.setValueAtTime(vol, c.currentTime + when)
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + when + dur)
  osc.connect(gain)
  gain.connect(c.destination)
  osc.start(c.currentTime + when)
  osc.stop(c.currentTime + when + dur + 0.05)
}

function sweep(from: number, to: number, dur: number, type: OscillatorType = 'square', vol = 0.07, when = 0) {
  const c = getCtx()
  if (!c) return
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(from, c.currentTime + when)
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), c.currentTime + when + dur)
  gain.gain.setValueAtTime(vol, c.currentTime + when)
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + when + dur)
  osc.connect(gain)
  gain.connect(c.destination)
  osc.start(c.currentTime + when)
  osc.stop(c.currentTime + when + dur + 0.05)
}

function arpeggio(notes: number[], step = 0.07, type: OscillatorType = 'square', vol = 0.06) {
  notes.forEach((n, i) => beep(n, step * 0.85, type, vol, i * step))
}

/** Item-get / XP jingle (Pokémon-inspired chiptune) */
function itemGetJingle() {
  arpeggio([988, 1175, 1319, 1568, 1319, 1568, 1976], 0.055, 'square', 0.07)
}

/** Battle start sting */
function battleStart() {
  arpeggio([392, 523, 659, 784], 0.09, 'triangle', 0.08)
  beep(988, 0.2, 'square', 0.06, 0.36)
}

/** Pokéball wobble */
function pokeballWobble() {
  sweep(900, 400, 0.08, 'triangle', 0.06)
  sweep(900, 400, 0.08, 'triangle', 0.06, 0.12)
  sweep(900, 400, 0.08, 'triangle', 0.06, 0.24)
  beep(1319, 0.15, 'square', 0.08, 0.38)
}

/** Quick attack hit */
function quickAttack() {
  sweep(1200, 600, 0.06, 'square', 0.07)
  beep(880, 0.05, 'triangle', 0.05, 0.04)
}

/** Fainted / bankrupt */
function fainted() {
  arpeggio([523, 466, 415, 370, 311, 262], 0.12, 'triangle', 0.07)
}

export function playSound(kind: SoundKind) {
  unlockAudio()
  switch (kind) {
    case 'buy':
      quickAttack()
      break
    case 'profit':
      itemGetJingle()
      break
    case 'bigProfit':
      itemGetJingle()
      arpeggio([1568, 1976, 2349], 0.06, 'square', 0.08)
      break
    case 'loss':
      beep(180, 0.2, 'sawtooth', 0.08)
      sweep(300, 120, 0.25, 'sawtooth', 0.06, 0.1)
      break
    case 'bankrupt':
      fainted()
      break
    case 'tick':
      beep(988, 0.035, 'triangle', 0.05)
      break
    case 'powerup':
      pokeballWobble()
      break
    case 'go':
      battleStart()
      break
    case 'miss':
      beep(280, 0.1, 'triangle', 0.04)
      break
  }
}
