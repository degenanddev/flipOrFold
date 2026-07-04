import TCGdex, { Query } from '@tcgdex/sdk'
import type { Card as TcgdexCard, CardResume } from '@tcgdex/sdk'

const client = new TCGdex('en')
client.cacheTTL = 60 * 60 * 1000

export interface TcgCardBrief {
  id: string
  name: string
  imageUrl: string
}

export interface TcgPriceVariant {
  label: string
  low?: number
  mid?: number
  high?: number
  market?: number
  currency: 'USD' | 'EUR'
}

export interface TcgCardDetail {
  id: string
  name: string
  imageUrl: string
  category: string
  rarity: string
  setName: string
  setId: string
  hp?: number
  types?: string[]
  stage?: string
  illustrator?: string
  description?: string
  weaknesses?: Array<{ type: string; value?: string }>
  retreat?: number
  prices: TcgPriceVariant[]
  tcgplayerUrl?: string
  cardmarketUrl?: string
}

type TcgPricing = {
  tcgplayer?: {
    unit?: string
    normal?: { lowPrice?: number; midPrice?: number; highPrice?: number; marketPrice?: number; productId?: number }
    holofoil?: { lowPrice?: number; midPrice?: number; highPrice?: number; marketPrice?: number; productId?: number }
    'reverse-holofoil'?: { lowPrice?: number; midPrice?: number; highPrice?: number; marketPrice?: number; productId?: number }
  }
  cardmarket?: {
    unit?: string
    avg?: number
    low?: number
    trend?: number
    avg1?: number
    avg7?: number
    avg30?: number
    idProduct?: number
  }
}

function imageFromResume(card: CardResume): string {
  if (!card.image) return ''
  return `${card.image}/low.webp`
}

function pushVariant(
  prices: TcgPriceVariant[],
  label: string,
  v?: { lowPrice?: number; midPrice?: number; highPrice?: number; marketPrice?: number; productId?: number },
) {
  if (!v) return
  prices.push({
    label,
    low: v.lowPrice,
    mid: v.midPrice,
    high: v.highPrice,
    market: v.marketPrice,
    currency: 'USD',
  })
}

function mapPricing(pricing: TcgPricing | undefined): {
  prices: TcgPriceVariant[]
  tcgplayerUrl?: string
  cardmarketUrl?: string
} {
  const prices: TcgPriceVariant[] = []
  if (!pricing) return { prices }

  const tp = pricing.tcgplayer
  if (tp) {
    pushVariant(prices, 'Normal', tp.normal)
    pushVariant(prices, 'Holofoil', tp.holofoil)
    pushVariant(prices, 'Reverse Holo', tp['reverse-holofoil'])
  }

  if (pricing.cardmarket) {
    const cm = pricing.cardmarket
    prices.push({
      label: 'Cardmarket',
      low: cm.low,
      market: cm.trend ?? cm.avg,
      mid: cm.avg,
      currency: 'EUR',
    })
  }

  const productId =
    tp?.holofoil?.productId ?? tp?.normal?.productId ?? tp?.['reverse-holofoil']?.productId

  return {
    prices,
    tcgplayerUrl: productId ? `https://www.tcgplayer.com/product/${productId}` : undefined,
    cardmarketUrl: pricing.cardmarket?.idProduct
      ? `https://www.cardmarket.com/en/Pokemon/Products?idProduct=${pricing.cardmarket.idProduct}`
      : undefined,
  }
}

export async function searchTcgCards(query: string, page = 1, pageSize = 24): Promise<TcgCardBrief[]> {
  const q = query.trim()
  if (q.length < 2) return []

  const results = await client.card.list(
    Query.create().contains('name', q).sort('name', 'ASC').paginate(page, pageSize),
  )

  return results
    .map((c) => ({
      id: c.id,
      name: c.name,
      imageUrl: imageFromResume(c),
    }))
    .filter((c) => c.imageUrl)
}

export async function getTcgCard(id: string): Promise<TcgCardDetail | null> {
  const card = await client.card.get(id)
  if (!card) return null
  return mapTcgCard(card)
}

function mapTcgCard(card: TcgdexCard): TcgCardDetail {
  const pricing = (card as TcgdexCard & { pricing?: TcgPricing }).pricing
  const { prices, tcgplayerUrl, cardmarketUrl } = mapPricing(pricing)

  const imageUrl = card.image ? `${card.image}/high.webp` : ''

  return {
    id: card.id,
    name: card.name,
    imageUrl,
    category: card.category ?? '—',
    rarity: card.rarity ?? '—',
    setName: card.set?.name ?? '—',
    setId: card.set?.id ?? '',
    hp: card.hp,
    types: card.types,
    stage: card.stage,
    illustrator: card.illustrator,
    description: card.description,
    weaknesses: card.weaknesses,
    retreat: card.retreat,
    prices,
    tcgplayerUrl,
    cardmarketUrl,
  }
}

export function getTcgdexClient(): TCGdex {
  return client
}
