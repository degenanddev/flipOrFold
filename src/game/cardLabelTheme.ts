/** Fredoka 700 — matches menu `font-display` */
export const CARD_LABEL_FONT =
  'https://cdn.jsdelivr.net/fontsource/fonts/fredoka@latest/latin-700-normal.woff'

export const KAWAII = {
  pink: '#ff6b9d',
  yellow: '#ffd166',
  yellowDeep: '#ffe066',
  yellowText: '#6b4c2a',
  purple: '#9b5de5',
  purpleSoft: '#b185db',
  green: '#7ec850',
  cream: '#fff8f0',
  ink: '#4a3568',
  lavender: '#e0c3fc',
  white: '#ffffff',
} as const

export function formatCardPrice(value: number): string {
  return `$${Math.round(value).toLocaleString()}`
}
