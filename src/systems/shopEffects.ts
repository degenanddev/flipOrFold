import { INSURANCE_MAX_LOSS, CASH_BONUS_AMOUNT } from '../utils/constants'
import { useShopStore } from '../store/shopStore'
import { SHOP_ITEMS } from '../store/shopStore'

export interface ShopUpgradeValues {
  appraisalExtraMs: number
  slowMoExtraMs: number
  insuranceMaxLoss: number
  metaCoinMultiplier: number
  cashBonusAmount: number
}

/** Read shop upgrades — bonus fields store accumulated seconds (or levels for insurance/coins) */
export function getShopUpgradeValues(): ShopUpgradeValues {
  const { upgrades } = useShopStore.getState()
  const coinMult = 1 + upgrades.coinGain * 0.1

  return {
    appraisalExtraMs: upgrades.appraisalDuration * 1000,
    slowMoExtraMs: upgrades.slowTimeDuration * 1000,
    insuranceMaxLoss: Math.max(10, INSURANCE_MAX_LOSS - upgrades.insuranceBonus * 15),
    metaCoinMultiplier: coinMult,
    cashBonusAmount: Math.round(CASH_BONUS_AMOUNT * coinMult),
  }
}

export function getEquippedEmoteText(): string | null {
  const { equippedEmote, ownedItems } = useShopStore.getState()
  if (!ownedItems.includes(equippedEmote)) return null
  const item = SHOP_ITEMS.find((i) => i.id === equippedEmote)
  return (item?.meta?.emote as string) ?? null
}
