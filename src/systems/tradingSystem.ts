import { INSURANCE_MAX_LOSS } from '../utils/constants'

/** Generate a shop display price — may be inflated or discounted vs market */
export function generateDisplayPrice(marketPrice: number): number {
  const base = Math.max(5, marketPrice)
  const roll = Math.random()

  if (roll < 0.38) {
    // Good deal — priced below market
    return Math.round(base * (0.5 + Math.random() * 0.35))
  }
  if (roll < 0.78) {
    // Bad deal — overpriced
    return Math.round(base * (1.12 + Math.random() * 0.55))
  }
  // Fair-ish
  return Math.round(base * (0.88 + Math.random() * 0.18))
}

export interface TradeResult {
  profit: number
  newBalance: number
  canAfford: boolean
}

export function executeTrade(
  balance: number,
  displayPrice: number,
  marketPrice: number,
  options: { doubleProfit: boolean; insurance: boolean; insuranceMaxLoss?: number }
): TradeResult {
  if (balance < displayPrice) {
    return { profit: 0, newBalance: balance, canAfford: false }
  }

  let profit = Math.round(marketPrice - displayPrice)
  const maxLoss = options.insuranceMaxLoss ?? INSURANCE_MAX_LOSS

  if (profit > 0 && options.doubleProfit) {
    profit = Math.round(profit * 2)
  }
  if (profit < 0 && options.insurance) {
    profit = Math.max(profit, -maxLoss)
  }

  return {
    profit,
    newBalance: balance + profit,
    canAfford: true,
  }
}

export function formatMoney(amount: number): string {
  const abs = Math.abs(Math.round(amount))
  const sign = amount >= 0 ? '+' : '-'
  return `${sign}$${abs.toLocaleString()}`
}

export function calculateRunXP(profit: number, tradesCount: number): number {
  return Math.max(0, Math.floor(Math.max(0, profit) * 0.05 + tradesCount * 3))
}
