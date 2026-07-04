import { useState } from 'react'
import { KawaiiButton, Panel, ScreenLayout, Title } from './ui'
import { CryptoBonusPanel } from './CryptoBonusPanel'
import { useGameStore } from '../store/gameStore'
import { useShopStore, POWERUP_MAX_LEVEL } from '../store/shopStore'
import { useProgressionStore } from '../store/progressionStore'
import { getShopUpgradeValues } from '../systems/shopEffects'
import type { ShopCategory } from '../types'

type ShopTab = ShopCategory | 'crypto'

const CATEGORIES: { key: ShopTab; label: string; emoji: string }[] = [
  { key: 'characters', label: 'Buddies', emoji: '🧑‍🚀' },
  { key: 'trails', label: 'Trails', emoji: '✨' },
  { key: 'powerups', label: 'Power-ups', emoji: '⚡' },
  { key: 'emotes', label: 'Emotes', emoji: '💬' },
  { key: 'crypto', label: 'Crypto', emoji: '🌙' },
]

export function ShopScreen() {
  const setScreen = useGameStore((s) => s.setScreen)
  const [category, setCategory] = useState<ShopTab>('characters')
  const totalCoins = useProgressionStore((s) => s.totalCoins)
  const level = useProgressionStore((s) => s.level)
  const getItemsByCategory = useShopStore((s) => s.getItemsByCategory)
  const isOwned = useShopStore((s) => s.isOwned)
  const purchaseItem = useShopStore((s) => s.purchaseItem)
  const equipItem = useShopStore((s) => s.equipItem)
  const equippedCharacter = useShopStore((s) => s.equippedCharacter)
  const equippedTrail = useShopStore((s) => s.equippedTrail)
  const equippedEmote = useShopStore((s) => s.equippedEmote)
  const getPowerupLevel = useShopStore((s) => s.getPowerupLevel)
  const getPowerupPrice = useShopStore((s) => s.getPowerupPrice)

  const upgrades = useShopStore((s) => s.upgrades)

  const items = category === 'crypto' ? [] : getItemsByCategory(category)
  const shopFx = getShopUpgradeValues()
  const isEquipped = (id: string) =>
    id === equippedCharacter || id === equippedTrail || id === equippedEmote

  return (
    <ScreenLayout>
      <Title subtitle="Spend your coins!" />

      <Panel className="w-full max-w-2xl animate-pop-in mx-auto">
        <div className="flex justify-between items-center gap-2 mb-3 sm:mb-4 flex-wrap">
          <div className="font-display text-xl sm:text-2xl font-bold text-[#ffd166] shrink-0">
            🪙 {totalCoins}
          </div>
          <KawaiiButton
            variant="purple"
            onClick={() => setScreen('menu')}
            className="text-xs sm:text-sm px-3 py-1.5 sm:px-4 sm:py-2 shrink-0"
          >
            ← Back
          </KawaiiButton>
        </div>

        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-1.5 sm:gap-2 mb-3 sm:mb-4">
          {CATEGORIES.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setCategory(c.key)}
              className={`px-2 py-1.5 sm:px-3 sm:py-2 rounded-full text-xs sm:text-sm font-display font-bold cursor-pointer transition-all border-2 text-center ${
                category === c.key
                  ? 'bg-[#ff6b9d] text-white border-white shadow-md'
                  : 'bg-white/70 text-[#9b5de5] border-[#e0c3fc]'
              }`}
            >
              {c.emoji} {c.label}
            </button>
          ))}
        </div>

        {category === 'powerups' && (
          <div className="mb-3 sm:mb-4 grid grid-cols-2 gap-1.5 sm:gap-2 text-[10px] sm:text-xs font-bold text-[#4a3568]">
            <div className="bg-[#e0f4ff] rounded-xl p-2 border border-white">
              ⏱ Slow-mo +{upgrades.slowTimeDuration}s
            </div>
            <div className="bg-[#f3e8ff] rounded-xl p-2 border border-white">
              🔎 Appraisal +{upgrades.appraisalDuration}s
            </div>
            <div className="bg-[#dcfce7] rounded-xl p-2 border border-white">
              🛡 Loss cap ${shopFx.insuranceMaxLoss}
            </div>
            <div className="bg-[#fff0f6] rounded-xl p-2 border border-white">
              🪙 Run coins +{upgrades.coinGain * 10}%
            </div>
          </div>
        )}

        {category === 'crypto' ? (
          <div className="max-h-[min(52vh,420px)] sm:max-h-[50vh] overflow-y-auto pr-0.5 sm:pr-1">
            <CryptoBonusPanel />
          </div>
        ) : (
        <div className="grid gap-2 sm:gap-3 max-h-[min(52vh,420px)] sm:max-h-[50vh] overflow-y-auto pr-0.5 sm:pr-1">
          {items.map((item) => {
            const isPowerup = item.category === 'powerups'
            const powerupLevel = isPowerup ? getPowerupLevel(item.id) : 0
            const atMaxLevel = isPowerup && powerupLevel >= POWERUP_MAX_LEVEL
            const owned = !isPowerup && isOwned(item.id)
            const locked = level < item.unlockLevel
            const equipped = isEquipped(item.id)
            const upgradePrice = isPowerup ? getPowerupPrice(item.id) : item.price

            return (
              <div
                key={item.id}
                className={`bg-[#f8f4ff] rounded-xl sm:rounded-2xl p-3 sm:p-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4 border-2 ${
                  equipped ? 'border-[#ff6b9d]' : 'border-white'
                }`}
              >
                <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                  <div className="text-2xl sm:text-4xl shrink-0">{item.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-display font-bold text-sm sm:text-base text-[#4a3568]">
                        {item.name}
                      </span>
                      {isPowerup && (
                        <span className="text-[10px] sm:text-xs font-bold bg-[#9b5de5] text-white px-2 py-0.5 rounded-full">
                          Lv {powerupLevel}/{POWERUP_MAX_LEVEL}
                        </span>
                      )}
                    </div>
                    <div className="text-xs sm:text-sm text-[#9b5de5] line-clamp-2">{item.description}</div>
                    {locked && (
                      <div className="text-[10px] sm:text-xs font-bold text-[#ff6b9d] mt-0.5">
                        🔒 Player lvl {item.unlockLevel}
                      </div>
                    )}
                  </div>
                </div>
                <div className="shrink-0 w-full sm:w-auto">
                  {isPowerup ? (
                    atMaxLevel ? (
                      <span className="text-[#7ec850] font-display font-bold text-sm block text-center sm:text-left">
                        MAX ✓
                      </span>
                    ) : (
                      <KawaiiButton
                        variant="yellow"
                        onClick={() => void purchaseItem(item.id)}
                        disabled={locked || totalCoins < upgradePrice}
                        className="text-xs px-3 py-1.5 w-full sm:w-auto"
                      >
                        {powerupLevel === 0 ? 'Buy' : 'Upgrade'} 🪙 {upgradePrice}
                      </KawaiiButton>
                    )
                  ) : owned ? (
                    <KawaiiButton
                      variant={equipped ? 'pink' : 'blue'}
                      onClick={() => void equipItem(item.id)}
                      className="text-xs px-3 py-1.5 w-full sm:w-auto"
                    >
                      {equipped ? '✓ Using' : 'Equip'}
                    </KawaiiButton>
                  ) : (
                    <KawaiiButton
                      variant="yellow"
                      onClick={() => purchaseItem(item.id)}
                      disabled={locked || totalCoins < item.price}
                      className="text-xs px-3 py-1.5 w-full sm:w-auto"
                    >
                      {item.price === 0 ? 'Free!' : `🪙 ${item.price}`}
                    </KawaiiButton>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        )}
      </Panel>
    </ScreenLayout>
  )
}
