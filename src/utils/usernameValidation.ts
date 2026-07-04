import bannedRaw from '../data/banned-usernames.txt?raw'

const LEET_MAP: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '@': 'a',
  $: 's',
}

/** Allowed display characters (letters, numbers, space, _ -) */
const USERNAME_PATTERN = /^[\p{L}\p{N} _-]+$/u

function parseBannedList(raw: string): { exact: string[]; contains: string[] } {
  const exact: string[] = []
  const contains: string[] = []
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const key = normalizeUsernameKey(trimmed)
    if (!key) continue
    if (key.length >= 4) contains.push(key)
    else exact.push(key)
  }
  return { exact, contains }
}

const { exact: BANNED_EXACT, contains: BANNED_CONTAINS } = parseBannedList(bannedRaw)

/** Collapse leetspeak + strip non-alphanumeric for ban matching */
export function normalizeUsernameKey(raw: string): string {
  let s = raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')

  s = s
    .split('')
    .map((ch) => LEET_MAP[ch] ?? ch)
    .join('')

  return s.replace(/[^a-z0-9]/g, '')
}

export function hasInvalidUsernameChars(raw: string): boolean {
  const trimmed = raw.trim()
  if (!trimmed) return false
  return !USERNAME_PATTERN.test(trimmed)
}

export function isBannedUsername(raw: string): boolean {
  const key = normalizeUsernameKey(raw)
  if (!key) return false

  if (BANNED_EXACT.includes(key)) return true

  for (const banned of BANNED_CONTAINS) {
    if (key.includes(banned)) return true
  }

  // Reserved prefixes (moderator, administrator, …)
  if (/^(admin|mod|staff|support|official|system|root|renaiss|fliporfold)/.test(key)) {
    return true
  }

  return false
}

export type UsernameValidation = 'ok' | 'too_short' | 'invalid_chars' | 'banned'

export function validateUsername(raw: string): UsernameValidation {
  const trimmed = raw.trim().replace(/\s+/g, ' ').slice(0, 20)
  if (trimmed.length < 2) return 'too_short'
  if (hasInvalidUsernameChars(trimmed)) return 'invalid_chars'
  if (isBannedUsername(trimmed)) return 'banned'
  return 'ok'
}
