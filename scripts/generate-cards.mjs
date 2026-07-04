import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..', 'src', 'assets', 'cards')

const RARITY_COLORS = {
  common: '#94a3b8',
  rare: '#3b82f6',
  epic: '#a855f7',
  legendary: '#f59e0b',
}

const REAL_CARDS = [
  { id: 'sparklemon', name: 'Sparklemon', rarity: 'legendary', creature: 'sparklemon', bg: ['#ffe066', '#ff6bcb', '#7c3aed'] },
  { id: 'fluffball', name: 'Fluffball', rarity: 'common', creature: 'fluffball', bg: ['#fbcfe8', '#f9a8d4', '#ec4899'] },
  { id: 'bubblekit', name: 'Bubblekit', rarity: 'rare', creature: 'bubblekit', bg: ['#7dd3fc', '#38bdf8', '#0284c7'] },
  { id: 'leafyhop', name: 'Leafyhop', rarity: 'common', creature: 'leafyhop', bg: ['#86efac', '#4ade80', '#16a34a'] },
  { id: 'emberpaw', name: 'Emberpaw', rarity: 'epic', creature: 'emberpaw', bg: ['#fdba74', '#fb923c', '#ea580c'] },
  { id: 'moonbeam', name: 'Moonbeam', rarity: 'rare', creature: 'moonbeam', bg: ['#c4b5fd', '#a78bfa', '#6366f1'] },
  { id: 'crystalhorn', name: 'Crystalhorn', rarity: 'legendary', creature: 'crystalhorn', bg: ['#e9d5ff', '#d946ef', '#7e22ce'] },
  { id: 'puddlepop', name: 'Puddlepop', rarity: 'common', creature: 'puddlepop', bg: ['#67e8f9', '#22d3ee', '#0891b2'] },
  { id: 'starling', name: 'Starling', rarity: 'epic', creature: 'starling', bg: ['#fde047', '#facc15', '#ca8a04'] },
  { id: 'glimmerfin', name: 'Glimmerfin', rarity: 'rare', creature: 'glimmerfin', bg: ['#93c5fd', '#60a5fa', '#2563eb'] },
  { id: 'puddingling', name: 'Puddingling', rarity: 'common', creature: 'puddingling', bg: ['#fcd34d', '#fbbf24', '#d97706'] },
  { id: 'thunderpuff', name: 'Thunderpuff', rarity: 'epic', creature: 'thunderpuff', bg: ['#e2e8f0', '#cbd5e1', '#64748b'] },
]

const FAKE_CARDS = [
  { id: 'sparklemonn', name: 'Sparklemonn', rarity: 'legendary', creature: 'sparklemon', bg: ['#a3e635', '#84cc16', '#4d7c0f'], fake: 'eyes' },
  { id: 'flufball', name: 'Flufball', rarity: 'common', creature: 'fluffball', bg: ['#86efac', '#22c55e', '#15803d'], fake: 'misspell' },
  { id: 'bubblekitt', name: 'Bubblekitt', rarity: 'rare', creature: 'bubblekit', bg: ['#fca5a5', '#ef4444', '#b91c1c'], fake: 'colors' },
  { id: 'leafyhopp', name: 'Leafyhopp', rarity: 'common', creature: 'leafyhop', bg: ['#f472b6', '#db2777', '#9d174d'], fake: 'glitch' },
  { id: 'emberpow', name: 'Emberpow', rarity: 'epic', creature: 'emberpaw', bg: ['#38bdf8', '#0ea5e9', '#0369a1'], fake: 'colors' },
  { id: 'moonbeem', name: 'Moonbeem', rarity: 'rare', creature: 'moonbeam', bg: ['#fcd34d', '#f59e0b', '#b45309'], fake: 'eyes' },
  { id: 'crystlhorn', name: 'Crystlhorn', rarity: 'legendary', creature: 'crystalhorn', bg: ['#fb7185', '#e11d48', '#9f1239'], fake: 'glitch' },
  { id: 'puddlpop', name: 'Puddlpop', rarity: 'common', creature: 'puddlepop', bg: ['#c084fc', '#9333ea', '#6b21a8'], fake: 'colors' },
  { id: 'starlng', name: 'Starlng', rarity: 'epic', creature: 'starling', bg: ['#2dd4bf', '#14b8a6', '#0f766e'], fake: 'glitch' },
  { id: 'glimmerfn', name: 'Glimmerfn', rarity: 'rare', creature: 'glimmerfin', bg: ['#f87171', '#dc2626', '#991b1b'], fake: 'eyes' },
  { id: 'puddinglng', name: 'Puddinglng', rarity: 'common', creature: 'puddingling', bg: ['#a78bfa', '#7c3aed', '#5b21b6'], fake: 'badge' },
  { id: 'thunderpuf', name: 'Thunderpuf', rarity: 'epic', creature: 'thunderpuff', bg: ['#f472b6', '#ec4899', '#be185d'], fake: 'glitch' },
]

function stars(uid, color = '#fff', opacity = 0.9) {
  const positions = [
    [40, 48, 8], [210, 56, 6], [220, 200, 7], [36, 210, 5], [128, 32, 10], [180, 280, 6],
  ]
  return positions
    .map(
      ([x, y, s], i) =>
        `<polygon points="${x},${y - s} ${x + s * 0.3},${y - s * 0.3} ${x + s},${y} ${x + s * 0.3},${y + s * 0.3} ${x},${y + s} ${x - s * 0.3},${y + s * 0.3} ${x - s},${y} ${x - s * 0.3},${y - s * 0.3}" fill="${color}" opacity="${opacity - i * 0.05}"/>`,
    )
    .join('\n')
}

function holoOverlay(uid) {
  return `
    <linearGradient id="holo-${uid}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fff" stop-opacity="0.35"/>
      <stop offset="25%" stop-color="#ff6bcb" stop-opacity="0.2"/>
      <stop offset="50%" stop-color="#00d4ff" stop-opacity="0.25"/>
      <stop offset="75%" stop-color="#ffe066" stop-opacity="0.2"/>
      <stop offset="100%" stop-color="#fff" stop-opacity="0.3"/>
    </linearGradient>
    <rect x="12" y="12" width="232" height="360" rx="12" fill="url(#holo-${uid})" opacity="0.55" pointer-events="none"/>
  `
}

function creatureArt(creature, uid, isFake, fakeType) {
  const creepy = isFake && fakeType === 'eyes'
  const eyeL = creepy ? { cx: 108, cy: 128, r: 14 } : { cx: 108, cy: 132, r: 10 }
  const eyeR = creepy ? { cx: 148, cy: 128, r: 6 } : { cx: 148, cy: 132, r: 10 }
  const pupilOffset = creepy ? ' translate(2,3)' : ''

  const arts = {
    sparklemon: () => `
      <polygon points="128,78 138,108 168,108 144,126 152,156 128,138 104,156 112,126 88,108 118,108" fill="#ffe066" stroke="#f59e0b" stroke-width="3"/>
      <ellipse cx="128" cy="148" rx="52" ry="48" fill="#fff7ed" stroke="#fbbf24" stroke-width="4"/>
      <circle cx="${eyeL.cx}" cy="${eyeL.cy}" r="${eyeL.r}" fill="#1e293b"/>
      <circle cx="${eyeR.cx}" cy="${eyeR.cy}" r="${eyeR.r}" fill="#1e293b"/>
      <g transform="${pupilOffset}">
        <circle cx="${eyeL.cx - 3}" cy="${eyeL.cy - 3}" r="4" fill="#fff"/>
        <circle cx="${eyeR.cx - 3}" cy="${eyeR.cy - 3}" r="4" fill="#fff"/>
      </g>
      <path d="M118 158 Q128 168 138 158" fill="none" stroke="#f97316" stroke-width="3" stroke-linecap="round"/>
      <ellipse cx="88" cy="148" rx="14" ry="22" fill="#fde68a" stroke="#f59e0b" stroke-width="2"/>
      <ellipse cx="168" cy="148" rx="14" ry="22" fill="#fde68a" stroke="#f59e0b" stroke-width="2"/>
    `,
    fluffball: () => `
      <circle cx="128" cy="140" r="58" fill="#fce7f3" stroke="#ec4899" stroke-width="4"/>
      ${Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2
        const x = 128 + Math.cos(a) * 52
        const y = 140 + Math.sin(a) * 52
        return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="12" fill="#fbcfe8" stroke="#f472b6" stroke-width="2"/>`
      }).join('')}
      <circle cx="${eyeL.cx}" cy="${eyeL.cy}" r="${eyeL.r}" fill="#1e293b"/>
      <circle cx="${eyeR.cx}" cy="${eyeR.cy}" r="${eyeR.r}" fill="#1e293b"/>
      <g transform="${pupilOffset}">
        <circle cx="${eyeL.cx - 2}" cy="${eyeL.cy - 2}" r="3" fill="#fff"/>
        <circle cx="${eyeR.cx - 2}" cy="${eyeR.cy - 2}" r="3" fill="#fff"/>
      </g>
      <ellipse cx="128" cy="158" rx="8" ry="5" fill="#fb7185"/>
    `,
    bubblekit: () => `
      <ellipse cx="128" cy="152" rx="50" ry="44" fill="#bae6fd" stroke="#0284c7" stroke-width="4"/>
      <circle cx="96" cy="132" r="16" fill="#bae6fd" stroke="#0284c7" stroke-width="3"/>
      <circle cx="160" cy="132" r="16" fill="#bae6fd" stroke="#0284c7" stroke-width="3"/>
      <path d="M168 152 Q188 120 176 100" fill="none" stroke="#0284c7" stroke-width="4" stroke-linecap="round"/>
      <circle cx="${eyeL.cx}" cy="${eyeL.cy}" r="${eyeL.r}" fill="#1e293b"/>
      <circle cx="${eyeR.cx}" cy="${eyeR.cy}" r="${eyeR.r}" fill="#1e293b"/>
      <g transform="${pupilOffset}">
        <circle cx="${eyeL.cx - 2}" cy="${eyeL.cy - 2}" r="3" fill="#fff"/>
        <circle cx="${eyeR.cx - 2}" cy="${eyeR.cy - 2}" r="3" fill="#fff"/>
      </g>
      <ellipse cx="128" cy="168" rx="6" ry="4" fill="#0369a1"/>
      <circle cx="110" cy="120" r="8" fill="#e0f2fe" opacity="0.8"/>
      <circle cx="150" cy="118" r="6" fill="#e0f2fe" opacity="0.8"/>
    `,
    leafyhop: () => `
      <ellipse cx="128" cy="158" rx="48" ry="36" fill="#bbf7d0" stroke="#16a34a" stroke-width="4"/>
      <ellipse cx="128" cy="118" rx="38" ry="32" fill="#86efac" stroke="#16a34a" stroke-width="3"/>
      <circle cx="${eyeL.cx}" cy="${eyeL.cy}" r="${eyeL.r}" fill="#1e293b"/>
      <circle cx="${eyeR.cx}" cy="${eyeR.cy}" r="${eyeR.r}" fill="#1e293b"/>
      <g transform="${pupilOffset}">
        <circle cx="${eyeL.cx - 2}" cy="${eyeL.cy - 2}" r="3" fill="#fff"/>
        <circle cx="${eyeR.cx - 2}" cy="${eyeR.cy - 2}" r="3" fill="#fff"/>
      </g>
      <path d="M108 168 Q128 176 148 168" fill="none" stroke="#15803d" stroke-width="3"/>
      <ellipse cx="88" cy="168" rx="14" ry="8" fill="#4ade80" stroke="#16a34a" stroke-width="2"/>
      <ellipse cx="168" cy="168" rx="14" ry="8" fill="#4ade80" stroke="#16a34a" stroke-width="2"/>
      <path d="M128 86 Q118 70 128 62 Q138 70 128 86" fill="#22c55e" stroke="#15803d" stroke-width="2"/>
    `,
    emberpaw: () => `
      <ellipse cx="128" cy="152" rx="46" ry="42" fill="#fed7aa" stroke="#ea580c" stroke-width="4"/>
      <polygon points="128,88 118,108 138,108" fill="#fb923c" stroke="#c2410c" stroke-width="2"/>
      <path d="M90 130 Q72 110 80 92" fill="none" stroke="#ea580c" stroke-width="5" stroke-linecap="round"/>
      <path d="M166 130 Q184 110 176 92" fill="none" stroke="#ea580c" stroke-width="5" stroke-linecap="round"/>
      <circle cx="${eyeL.cx}" cy="${eyeL.cy}" r="${eyeL.r}" fill="#1e293b"/>
      <circle cx="${eyeR.cx}" cy="${eyeR.cy}" r="${eyeR.r}" fill="#1e293b"/>
      <g transform="${pupilOffset}">
        <circle cx="${eyeL.cx - 2}" cy="${eyeL.cy - 2}" r="3" fill="#fff"/>
        <circle cx="${eyeR.cx - 2}" cy="${eyeR.cy - 2}" r="3" fill="#fff"/>
      </g>
      <ellipse cx="128" cy="168" rx="10" ry="6" fill="#dc2626"/>
      <path d="M108 178 L118 188 M148 178 L138 188" stroke="#c2410c" stroke-width="3" stroke-linecap="round"/>
    `,
    moonbeam: () => `
      <ellipse cx="128" cy="148" rx="24" ry="52" fill="#e9d5ff" stroke="#7c3aed" stroke-width="3" opacity="0.9"/>
      <ellipse cx="128" cy="148" rx="52" ry="48" fill="#ddd6fe" stroke="#6366f1" stroke-width="4"/>
      <circle cx="${eyeL.cx}" cy="${eyeL.cy}" r="${eyeL.r}" fill="#1e293b"/>
      <circle cx="${eyeR.cx}" cy="${eyeR.cy}" r="${eyeR.r}" fill="#1e293b"/>
      <g transform="${pupilOffset}">
        <circle cx="${eyeL.cx - 2}" cy="${eyeL.cy - 2}" r="3" fill="#fff"/>
        <circle cx="${eyeR.cx - 2}" cy="${eyeR.cy - 2}" r="3" fill="#fff"/>
      </g>
      <path d="M118 162 Q128 170 138 162" fill="none" stroke="#7c3aed" stroke-width="2"/>
      <circle cx="128" cy="96" r="8" fill="#fde68a"/>
    `,
    crystalhorn: () => `
      <polygon points="128,72 118,108 138,108" fill="#e9d5ff" stroke="#a855f7" stroke-width="3"/>
      <ellipse cx="128" cy="152" rx="44" ry="46" fill="#fae8ff" stroke="#c026d3" stroke-width="4"/>
      <circle cx="${eyeL.cx}" cy="${eyeL.cy}" r="${eyeL.r}" fill="#1e293b"/>
      <circle cx="${eyeR.cx}" cy="${eyeR.cy}" r="${eyeR.r}" fill="#1e293b"/>
      <g transform="${pupilOffset}">
        <circle cx="${eyeL.cx - 2}" cy="${eyeL.cy - 2}" r="3" fill="#fff"/>
        <circle cx="${eyeR.cx - 2}" cy="${eyeR.cy - 2}" r="3" fill="#fff"/>
      </g>
      <path d="M100 178 Q128 188 156 178" fill="none" stroke="#a855f7" stroke-width="3"/>
      <rect x="118" y="178" width="20" height="14" rx="4" fill="#f0abfc" stroke="#c026d3" stroke-width="2"/>
    `,
    puddlepop: () => `
      <path d="M80 168 Q80 110 128 100 Q176 110 176 168 Q176 200 128 208 Q80 200 80 168 Z" fill="#67e8f9" stroke="#0891b2" stroke-width="4"/>
      <circle cx="${eyeL.cx}" cy="${eyeL.cy}" r="${eyeL.r}" fill="#1e293b"/>
      <circle cx="${eyeR.cx}" cy="${eyeR.cy}" r="${eyeR.r}" fill="#1e293b"/>
      <g transform="${pupilOffset}">
        <circle cx="${eyeL.cx - 2}" cy="${eyeL.cy - 2}" r="3" fill="#fff"/>
        <circle cx="${eyeR.cx - 2}" cy="${eyeR.cy - 2}" r="3" fill="#fff"/>
      </g>
      <ellipse cx="128" cy="168" rx="12" ry="8" fill="#06b6d4" opacity="0.6"/>
      <circle cx="100" cy="130" r="10" fill="#cffafe" opacity="0.7"/>
    `,
    starling: () => `
      <ellipse cx="128" cy="148" rx="40" ry="36" fill="#fef08a" stroke="#ca8a04" stroke-width="4"/>
      <polygon points="128,88 136,112 160,112 140,126 148,150 128,136 108,150 116,126 96,112 120,112" fill="#fde047" stroke="#eab308" stroke-width="2"/>
      <circle cx="${eyeL.cx}" cy="${eyeL.cy}" r="${eyeL.r}" fill="#1e293b"/>
      <circle cx="${eyeR.cx}" cy="${eyeR.cy}" r="${eyeR.r}" fill="#1e293b"/>
      <g transform="${pupilOffset}">
        <circle cx="${eyeL.cx - 2}" cy="${eyeL.cy - 2}" r="3" fill="#fff"/>
        <circle cx="${eyeR.cx - 2}" cy="${eyeR.cy - 2}" r="3" fill="#fff"/>
      </g>
      <path d="M88 148 L68 138 M88 158 L66 168 M168 148 L188 138 M168 158 L190 168" stroke="#ca8a04" stroke-width="3" stroke-linecap="round"/>
    `,
    glimmerfin: () => `
      <ellipse cx="128" cy="152" rx="54" ry="32" fill="#93c5fd" stroke="#2563eb" stroke-width="4"/>
      <polygon points="74,152 52,140 52,164" fill="#60a5fa" stroke="#2563eb" stroke-width="2"/>
      <circle cx="${eyeL.cx}" cy="${eyeL.cy}" r="${eyeL.r}" fill="#1e293b"/>
      <circle cx="${eyeR.cx}" cy="${eyeR.cy}" r="${eyeR.r}" fill="#1e293b"/>
      <g transform="${pupilOffset}">
        <circle cx="${eyeL.cx - 2}" cy="${eyeL.cy - 2}" r="3" fill="#fff"/>
        <circle cx="${eyeR.cx - 2}" cy="${eyeR.cy - 2}" r="3" fill="#fff"/>
      </g>
      <path d="M118 162 Q128 172 138 162" fill="none" stroke="#1d4ed8" stroke-width="2"/>
      <circle cx="160" cy="148" r="6" fill="#bfdbfe"/>
    `,
    puddingling: () => `
      <rect x="78" y="108" width="100" height="88" rx="28" fill="#fde68a" stroke="#d97706" stroke-width="4"/>
      <rect x="88" y="118" width="80" height="24" rx="8" fill="#fcd34d" stroke="#f59e0b" stroke-width="2"/>
      <circle cx="${eyeL.cx}" cy="${eyeL.cy}" r="${eyeL.r}" fill="#1e293b"/>
      <circle cx="${eyeR.cx}" cy="${eyeR.cy}" r="${eyeR.r}" fill="#1e293b"/>
      <g transform="${pupilOffset}">
        <circle cx="${eyeL.cx - 2}" cy="${eyeL.cy - 2}" r="3" fill="#fff"/>
        <circle cx="${eyeR.cx - 2}" cy="${eyeR.cy - 2}" r="3" fill="#fff"/>
      </g>
      <path d="M118 168 Q128 178 138 168" fill="none" stroke="#b45309" stroke-width="3"/>
      <ellipse cx="128" cy="196" rx="36" ry="12" fill="#fbbf24" opacity="0.5"/>
    `,
    thunderpuff: () => `
      <ellipse cx="128" cy="132" rx="58" ry="38" fill="#e2e8f0" stroke="#64748b" stroke-width="4"/>
      <ellipse cx="128" cy="168" rx="42" ry="28" fill="#cbd5e1" stroke="#64748b" stroke-width="3"/>
      <circle cx="${eyeL.cx}" cy="${eyeL.cy}" r="${eyeL.r}" fill="#1e293b"/>
      <circle cx="${eyeR.cx}" cy="${eyeR.cy}" r="${eyeR.r}" fill="#1e293b"/>
      <g transform="${pupilOffset}">
        <circle cx="${eyeL.cx - 2}" cy="${eyeL.cy - 2}" r="3" fill="#fff"/>
        <circle cx="${eyeR.cx - 2}" cy="${eyeR.cy - 2}" r="3" fill="#fff"/>
      </g>
      <polygon points="128,188 118,208 128,202 138,208" fill="#facc15" stroke="#ca8a04" stroke-width="2"/>
      <path d="M108 118 Q128 100 148 118" fill="none" stroke="#94a3b8" stroke-width="3"/>
    `,
  }

  return arts[creature]?.() ?? arts.fluffball()
}

function glitchName(name, fakeType) {
  if (fakeType !== 'glitch') return name
  const glitched = name
    .split('')
    .map((c, i) => (i % 4 === 3 ? c + '\u0336' : c))
    .join('')
  return glitched
}

function renderCard(card, isFake) {
  const uid = `${isFake ? 'f' : 'r'}-${card.id}`
  const borderColor = isFake ? '#ef4444' : RARITY_COLORS[card.rarity]
  const badgeFill = isFake ? '#ef4444' : '#22c55e'
  const badgeText = isFake ? (card.fake === 'badge' ? 'AUTHENTIC' : 'COUNTERFEIT') : 'AUTHENTIC'
  const badgeTextColor = isFake && card.fake === 'badge' ? '#22c55e' : '#fff'
  const displayName = isFake ? glitchName(card.name.toUpperCase(), card.fake) : card.name.toUpperCase()
  const nameX = isFake && card.fake === 'glitch' ? 130 : 128
  const nameTransform = isFake && card.fake === 'glitch' ? ' skewX(-8)' : ''
  const frameStroke = isFake ? '#dc2626' : borderColor

  return `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="384" viewBox="0 0 256 384">
  <defs>
    <linearGradient id="bg-${uid}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${card.bg[0]}"/>
      <stop offset="55%" stop-color="${card.bg[1]}"/>
      <stop offset="100%" stop-color="${card.bg[2]}"/>
    </linearGradient>
    <linearGradient id="frame-${uid}" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${isFake ? '#fca5a5' : '#fff'}"/>
      <stop offset="100%" stop-color="${borderColor}"/>
    </linearGradient>
    <filter id="glow-${uid}">
      <feGaussianBlur stdDeviation="2" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    ${isFake && card.fake === 'glitch' ? `<filter id="glitch-${uid}"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="1" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="2"/></filter>` : ''}
  </defs>
  <rect width="256" height="384" rx="18" fill="url(#bg-${uid})" stroke="url(#frame-${uid})" stroke-width="6"/>
  <rect x="14" y="14" width="228" height="356" rx="14" fill="none" stroke="#fff" stroke-width="2" opacity="0.45"/>
  ${stars(uid)}
  <rect x="20" y="28" width="216" height="220" rx="12" fill="#fff" fill-opacity="0.92" stroke="${frameStroke}" stroke-width="4"/>
  <g filter="url(#glow-${uid})">
    ${creatureArt(card.creature, uid, isFake, card.fake)}
  </g>
  ${holoOverlay(uid)}
  <rect x="20" y="258" width="216" height="52" rx="10" fill="${borderColor}" fill-opacity="0.25" stroke="${frameStroke}" stroke-width="3"/>
  <g transform="translate(${nameX}, 290)${nameTransform}" ${isFake && card.fake === 'glitch' ? `filter="url(#glitch-${uid})"` : ''}>
    <text text-anchor="middle" fill="#1e293b" font-family="Arial Rounded MT Bold, Helvetica Rounded, Arial, sans-serif" font-size="16" font-weight="bold">${displayName}</text>
  </g>
  <text x="128" y="318" text-anchor="middle" fill="${borderColor}" font-family="Arial, sans-serif" font-size="11" font-weight="bold" letter-spacing="2">${card.rarity.toUpperCase()}</text>
  <rect x="20" y="332" width="110" height="28" rx="8" fill="${badgeFill}" stroke="#fff" stroke-width="2"/>
  <text x="75" y="351" text-anchor="middle" fill="${badgeTextColor}" font-family="Arial Rounded MT Bold, Arial, sans-serif" font-size="11" font-weight="bold">${badgeText}</text>
  <text x="236" y="352" text-anchor="end" fill="#fff" font-family="Arial, sans-serif" font-size="10" opacity="0.85">HP 60</text>
  <polygon points="128,8 132,18 142,18 134,24 137,34 128,28 119,34 122,24 114,18 124,18" fill="#fde047" stroke="#f59e0b" stroke-width="1"/>
</svg>`
}

mkdirSync(join(ROOT, 'real'), { recursive: true })
mkdirSync(join(ROOT, 'fake'), { recursive: true })

const manifest = { real: [], fake: [] }

for (const card of REAL_CARDS) {
  const filename = `${card.id}.svg`
  const path = join(ROOT, 'real', filename)
  writeFileSync(path, renderCard(card, false))
  manifest.real.push({
    id: `real-${card.id}`,
    name: card.name,
    rarity: card.rarity,
    image: `real/${filename}`,
  })
}

for (const card of FAKE_CARDS) {
  const filename = `${card.id}.svg`
  const path = join(ROOT, 'fake', filename)
  writeFileSync(path, renderCard(card, true))
  manifest.fake.push({
    id: `fake-${card.id}`,
    name: card.name,
    rarity: card.rarity,
    image: `fake/${filename}`,
  })
}

writeFileSync(join(ROOT, 'cards.json'), JSON.stringify(manifest, null, 2) + '\n')
console.log(`Generated ${manifest.real.length} real + ${manifest.fake.length} fake cards`)
