import { useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { KawaiiButton, Panel, ScreenLayout, Title } from './ui'
import { useGameStore } from '../store/gameStore'
import { useDebounce } from '../hooks/useDebounce'
import { searchTcgCards, getTcgCard, type TcgCardBrief, type TcgCardDetail } from '../services/tcgdex'
import {
  getSilphcoCard,
  hasSilphcoApiKey,
  searchSilphcoCards,
  silphcoCardUrl,
  type SilphcoCardBrief,
  type SilphcoCardDetail,
} from '../services/silphco'
import { searchTradingCardsCached, type TradingCardSearchRow } from '../supabase/tradingCards'
import {
  fetchRenaissCardDetail,
  getRenaissRateLimit,
  renaissIndexUrl,
  searchRenaissLive,
  type RenaissCardDetail,
  type RenaissRateLimit,
  type RenaissSearchHit,
} from '../services/renaissBrowser'
import { RenaissGradedPanel } from './carddex/RenaissGradedPanel'
import { RARITY_COLORS } from '../utils/constants'
import type { Rarity } from '../types'

type DexTab = 'pokemon' | 'market' | 'onepiece'

const PLACEHOLDER =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="168" viewBox="0 0 120 168"><rect fill="#e0c3fc" width="120" height="168" rx="8"/><text x="60" y="88" text-anchor="middle" fill="#9b5de5" font-size="14" font-family="sans-serif">?</text></svg>',
  )

export function CardDexScreen() {
  const setScreen = useGameStore((s) => s.setScreen)
  const [tab, setTab] = useState<DexTab>('pokemon')
  const [query, setQuery] = useState('')
  const debounced = useDebounce(query, 300)
  const [selectedTcgId, setSelectedTcgId] = useState<string | null>(null)
  const [selectedSilphcoId, setSelectedSilphcoId] = useState<string | null>(null)
  const [selectedGraded, setSelectedGraded] = useState<TradingCardSearchRow | null>(null)
  const [liveRenaiss, setLiveRenaiss] = useState<RenaissSearchHit[] | null>(null)
  const [liveRate, setLiveRate] = useState<RenaissRateLimit | null>(() => getRenaissRateLimit())
  const [liveLoading, setLiveLoading] = useState(false)
  const [liveError, setLiveError] = useState<string | null>(null)
  const [gradedLiveDetail, setGradedLiveDetail] = useState<RenaissCardDetail | null>(null)
  const [gradedLiveLoading, setGradedLiveLoading] = useState(false)

  const tcgSearch = useQuery({
    queryKey: ['tcgdex-search', debounced],
    queryFn: () => searchTcgCards(debounced),
    enabled: tab === 'pokemon' && debounced.trim().length >= 2,
    staleTime: 5 * 60_000,
  })

  const silphcoSearch = useQuery({
    queryKey: ['silphco-search', debounced],
    queryFn: () => searchSilphcoCards(debounced),
    enabled: tab === 'market' && hasSilphcoApiKey() && debounced.trim().length >= 2,
    staleTime: 5 * 60_000,
  })

  const onePieceSearch = useQuery({
    queryKey: ['onepiece-search', debounced],
    queryFn: () => searchTradingCardsCached(debounced, 20, 'one-piece'),
    enabled: tab === 'onepiece' && debounced.trim().length >= 2,
    staleTime: 60_000,
  })

  const tcgDetail = useQuery({
    queryKey: ['tcgdex-card', selectedTcgId],
    queryFn: () => getTcgCard(selectedTcgId!),
    enabled: !!selectedTcgId,
    staleTime: 30 * 60_000,
  })

  const silphcoDetail = useQuery({
    queryKey: ['silphco-card', selectedSilphcoId],
    queryFn: () => getSilphcoCard(selectedSilphcoId!),
    enabled: !!selectedSilphcoId && hasSilphcoApiKey(),
    staleTime: 10 * 60_000,
  })

  const tcgSilphcoMarket = useQuery({
    queryKey: ['silphco-card', selectedTcgId],
    queryFn: () => getSilphcoCard(selectedTcgId!),
    enabled: tab === 'pokemon' && !!selectedTcgId && hasSilphcoApiKey(),
    staleTime: 10 * 60_000,
  })

  const showDetail =
    (tab === 'pokemon' && !!selectedTcgId) ||
    (tab === 'market' && !!selectedSilphcoId) ||
    (tab === 'onepiece' && !!selectedGraded)

  const handleLiveRenaissSearch = async (name: string) => {
    setLiveLoading(true)
    setLiveError(null)
    try {
      const { hits, rate } = await searchRenaissLive(name, 8)
      setLiveRenaiss(hits)
      setLiveRate(rate)
    } catch (e) {
      setLiveError(e instanceof Error ? e.message : 'Renaiss search failed')
    } finally {
      setLiveLoading(false)
    }
  }

  const clearDetail = () => {
    setSelectedTcgId(null)
    setSelectedSilphcoId(null)
    setSelectedGraded(null)
    setLiveRenaiss(null)
    setLiveError(null)
    setGradedLiveDetail(null)
  }

  const refreshGradedLive = async (href: string) => {
    setGradedLiveLoading(true)
    try {
      const { card, rate } = await fetchRenaissCardDetail(href)
      setGradedLiveDetail(card)
      setLiveRate(rate)
    } catch (e) {
      setLiveError(e instanceof Error ? e.message : 'Renaiss refresh failed')
    } finally {
      setGradedLiveLoading(false)
    }
  }

  return (
    <ScreenLayout>
      <Title subtitle="Search cards · raw & graded market data" compact />

      <Panel className="w-full max-w-lg flex flex-col gap-3 !p-3 sm:!p-4 animate-pop-in max-h-[min(88vh,720px)]">
        <div className="flex items-center justify-between gap-2 shrink-0">
          <div className="flex gap-1.5 flex-wrap justify-center">
            <TabChip active={tab === 'pokemon'} onClick={() => { setTab('pokemon'); clearDetail() }}>
              Pokémon
            </TabChip>
            <TabChip active={tab === 'market'} onClick={() => { setTab('market'); clearDetail() }}>
              Market
            </TabChip>
            <TabChip active={tab === 'onepiece'} onClick={() => { setTab('onepiece'); clearDetail() }}>
              One Piece
            </TabChip>
          </div>
          <KawaiiButton variant="purple" onClick={() => setScreen('menu')} className="!py-1.5 !px-3 text-xs sm:text-sm">
            ← Menu
          </KawaiiButton>
        </div>

        <p className="text-[10px] font-semibold text-[#b185db] text-center shrink-0">
          {tab === 'pokemon' && 'TCGdex cards + SilphCo market on detail'}
          {tab === 'market' && 'SilphCo — Pokémon graded sales & TV-WAP (live API)'}
          {tab === 'onepiece' && 'Renaiss graded slabs — cache + live search'}
        </p>

        {!showDetail && (
          <>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                tab === 'pokemon'
                  ? 'Search Pokémon cards…'
                  : tab === 'market'
                    ? 'Search Pokémon market…'
                    : 'Search One Piece slabs…'
              }
              className="w-full bg-white border-2 border-[#e0c3fc] rounded-xl px-3 py-2 text-sm font-display font-bold text-[#4a3568] focus:outline-none focus:border-[#ff6b9d] shrink-0"
              autoFocus
            />

            <div className="flex-1 min-h-0 overflow-y-auto -mx-1 px-1">
              {debounced.trim().length < 2 ? (
                <p className="text-center text-sm font-bold text-[#b185db] py-8">Type 2+ characters to search</p>
              ) : tab === 'pokemon' ? (
                <TcgResults
                  loading={tcgSearch.isLoading}
                  error={tcgSearch.error}
                  items={tcgSearch.data ?? []}
                  onSelect={(id) => setSelectedTcgId(id)}
                />
              ) : tab === 'market' ? (
                !hasSilphcoApiKey() ? (
                  <p className="text-center text-sm font-bold text-[#b185db] py-6 px-2">
                    Add <code className="text-[#9b5de5]">VITE_SILPHCO_API_KEY</code> to your .env to enable SilphCo search.
                  </p>
                ) : (
                  <SilphcoResults
                    loading={silphcoSearch.isLoading}
                    error={silphcoSearch.error}
                    items={silphcoSearch.data ?? []}
                    onSelect={(id) => setSelectedSilphcoId(id)}
                  />
                )
              ) : (
                <>
                  <GradedResults
                    loading={onePieceSearch.isLoading}
                    items={onePieceSearch.data ?? []}
                    onSelect={setSelectedGraded}
                    emptyHint="No cached One Piece slabs. Try live Renaiss search below."
                  />
                  {debounced.trim().length >= 2 && (
                    <div className="mt-3 pt-3 border-t-2 border-white/80">
                      <RenaissGradedPanel
                        liveRenaiss={liveRenaiss}
                        liveRate={liveRate}
                        liveLoading={liveLoading}
                        liveError={liveError}
                        onSearch={() => void handleLiveRenaissSearch(debounced)}
                        label="🔍 Search Renaiss live (One Piece & more)"
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}

        {showDetail && tab === 'pokemon' && selectedTcgId && (
          <TcgDetailView
            loading={tcgDetail.isLoading}
            card={tcgDetail.data ?? null}
            silphco={tcgSilphcoMarket.data ?? null}
            silphcoLoading={tcgSilphcoMarket.isLoading}
            onBack={clearDetail}
            liveRenaiss={liveRenaiss}
            liveRate={liveRate}
            liveLoading={liveLoading}
            liveError={liveError}
            onSearchRenaiss={() => tcgDetail.data && void handleLiveRenaissSearch(tcgDetail.data.name)}
          />
        )}

        {showDetail && tab === 'market' && selectedSilphcoId && (
          <SilphcoDetailView
            loading={silphcoDetail.isLoading}
            card={silphcoDetail.data ?? null}
            onBack={clearDetail}
            liveRenaiss={liveRenaiss}
            liveRate={liveRate}
            liveLoading={liveLoading}
            liveError={liveError}
            onSearchRenaiss={() => silphcoDetail.data && void handleLiveRenaissSearch(silphcoDetail.data.name)}
          />
        )}

        {showDetail && tab === 'onepiece' && selectedGraded && (
          <GradedDetailView
            row={selectedGraded}
            live={gradedLiveDetail}
            loading={gradedLiveLoading}
            rate={liveRate}
            liveError={liveError}
            onBack={clearDetail}
            onRefreshLive={() => void refreshGradedLive(selectedGraded.renaissHref)}
          />
        )}
      </Panel>

      {liveRate && (
        <p className="text-[9px] font-semibold text-[#b185db] mt-2 text-center">
          Renaiss API: {liveRate.remaining}/{liveRate.limit} requests left today
        </p>
      )}
    </ScreenLayout>
  )
}

function TabChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-2.5 py-1 text-[10px] sm:text-xs font-bold border-2 transition-colors ${active ? 'bg-[#ff6b9d] text-white border-[#ff6b9d]' : 'bg-white/80 text-[#9b5de5] border-[#e0c3fc]'
        }`}
    >
      {children}
    </button>
  )
}

function TcgResults({
  loading,
  error,
  items,
  onSelect,
}: {
  loading: boolean
  error: Error | null
  items: TcgCardBrief[]
  onSelect: (id: string) => void
}) {
  if (loading) return <p className="text-center text-sm font-bold text-[#9b5de5] py-6 animate-pulse">Searching…</p>
  if (error) return <p className="text-center text-sm font-bold text-red-500 py-6">Search failed</p>
  if (items.length === 0) return <p className="text-center text-sm font-bold text-[#b185db] py-6">No cards found</p>

  return (
    <ul className="grid grid-cols-3 sm:grid-cols-4 gap-2">
      {items.map((c) => (
        <li key={c.id}>
          <button
            type="button"
            onClick={() => onSelect(c.id)}
            className="w-full text-left rounded-xl border-2 border-white bg-white/90 p-1.5 shadow-sm hover:border-[#ff6b9d] transition-colors"
          >
            <img
              src={c.imageUrl}
              alt=""
              className="w-full aspect-[5/7] object-cover rounded-lg bg-[#f3e8ff]"
              loading="lazy"
              onError={(e) => { e.currentTarget.src = PLACEHOLDER }}
            />
            <p className="text-[9px] font-bold text-[#4a3568] mt-1 line-clamp-2 leading-tight">{c.name}</p>
          </button>
        </li>
      ))}
    </ul>
  )
}

function GradedResults({
  loading,
  items,
  onSelect,
  emptyHint,
}: {
  loading: boolean
  items: TradingCardSearchRow[]
  onSelect: (row: TradingCardSearchRow) => void
  emptyHint?: string
}) {
  if (loading) return <p className="text-center text-sm font-bold text-[#9b5de5] py-6 animate-pulse">Searching cache…</p>
  if (items.length === 0) {
    return (
      <p className="text-center text-sm font-bold text-[#b185db] py-6 px-2">
        {emptyHint ?? 'No cached graded cards match.'}
      </p>
    )
  }

  return (
    <ul className="space-y-2">
      {items.map((c) => (
        <li key={c.id}>
          <button
            type="button"
            onClick={() => onSelect(c)}
            className="w-full flex gap-2 items-center rounded-xl border-2 border-white bg-white/90 p-2 hover:border-[#ff6b9d] text-left"
          >
            <img
              src={c.image}
              alt=""
              className="w-12 h-[4.2rem] object-cover rounded-lg shrink-0 bg-[#f3e8ff]"
              loading="lazy"
              onError={(e) => { e.currentTarget.src = PLACEHOLDER }}
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-[#4a3568] truncate">{c.name}</p>
              <p className="text-[10px] font-semibold text-[#9b5de5]">{c.gradeLabel ?? c.rarity}</p>
              <p className="text-sm font-black text-[#ff6b9d]">${c.marketPrice.toLocaleString()}</p>
            </div>
          </button>
        </li>
      ))}
    </ul>
  )
}

function SilphcoResults({
  loading,
  error,
  items,
  onSelect,
}: {
  loading: boolean
  error: Error | null
  items: SilphcoCardBrief[]
  onSelect: (id: string) => void
}) {
  if (loading) return <p className="text-center text-sm font-bold text-[#9b5de5] py-6 animate-pulse">Searching SilphCo…</p>
  if (error) return <p className="text-center text-sm font-bold text-red-500 py-6">{error.message}</p>
  if (items.length === 0) return <p className="text-center text-sm font-bold text-[#b185db] py-6">No market data found</p>

  return (
    <ul className="space-y-2">
      {items.map((c) => (
        <li key={c.id}>
          <button
            type="button"
            onClick={() => onSelect(c.id)}
            className="w-full flex gap-2 items-center rounded-xl border-2 border-white bg-white/90 p-2 hover:border-[#ff6b9d] text-left"
          >
            <img
              src={c.imageUrl}
              alt=""
              className="w-12 h-[4.2rem] object-cover rounded-lg shrink-0 bg-[#f3e8ff]"
              loading="lazy"
              onError={(e) => { e.currentTarget.src = PLACEHOLDER }}
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-[#4a3568] truncate">{c.name}</p>
              <p className="text-[10px] font-semibold text-[#9b5de5]">{c.setName}</p>
              {c.psa10PriceUsd != null && (
                <p className="text-sm font-black text-[#ff6b9d]">PSA 10 · ${c.psa10PriceUsd.toLocaleString()}</p>
              )}
              {c.tvwapPriceUsd != null && (
                <p className="text-[10px] font-bold text-[#7ec850]">TV-WAP ${c.tvwapPriceUsd.toFixed(0)}</p>
              )}
            </div>
          </button>
        </li>
      ))}
    </ul>
  )
}

function TcgDetailView({
  loading,
  card,
  silphco,
  silphcoLoading,
  onBack,
  liveRenaiss,
  liveRate,
  liveLoading,
  liveError,
  onSearchRenaiss,
}: {
  loading: boolean
  card: TcgCardDetail | null
  silphco: SilphcoCardDetail | null
  silphcoLoading: boolean
  onBack: () => void
  liveRenaiss: RenaissSearchHit[] | null
  liveRate: RenaissRateLimit | null
  liveLoading: boolean
  liveError: string | null
  onSearchRenaiss: () => void
}) {
  if (loading || !card) {
    return <p className="text-center text-sm font-bold text-[#9b5de5] py-8 animate-pulse">Loading card…</p>
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto space-y-3 -mx-1 px-1">
      <button type="button" onClick={onBack} className="text-xs font-bold text-[#9b5de5] hover:text-[#ff6b9d]">
        ← Back to results
      </button>

      <div className="flex gap-3">
        <img
          src={card.imageUrl}
          alt={card.name}
          className="w-28 sm:w-32 rounded-xl border-2 border-white shadow-md shrink-0"
          onError={(e) => { e.currentTarget.src = PLACEHOLDER }}
        />
        <div className="min-w-0">
          <h2 className="font-display text-lg font-black text-[#4a3568] leading-tight">{card.name}</h2>
          <p className="text-xs font-bold text-[#9b5de5] mt-0.5">{card.setName}</p>
          <p className="text-[10px] font-semibold text-[#b185db] mt-1">
            {card.rarity} · {card.category}
            {card.hp != null && ` · ${card.hp} HP`}
          </p>
          {card.types?.length ? (
            <p className="text-[10px] font-bold text-[#4a3568] mt-0.5">{card.types.join(' / ')}</p>
          ) : null}
        </div>
      </div>

      {card.description && (
        <InfoBlock title="Flavor">{card.description}</InfoBlock>
      )}

      <InfoBlock title="Details">
        <DetailRow label="Illustrator" value={card.illustrator} />
        <DetailRow label="Stage" value={card.stage} />
        <DetailRow label="Retreat" value={card.retreat?.toString()} />
        {card.weaknesses?.map((w, i) => (
          <DetailRow key={i} label="Weakness" value={`${w.type}${w.value ? ` ${w.value}` : ''}`} />
        ))}
      </InfoBlock>

      {card.prices.length > 0 && (
        <InfoBlock title="Raw market (TCGdex)">
          <div className="space-y-1.5">
            {card.prices.map((p) => (
              <div key={p.label} className="flex justify-between text-xs font-bold">
                <span className="text-[#9b5de5]">{p.label}</span>
                <span className="text-[#4a3568]">
                  {p.market != null && `${p.currency === 'EUR' ? '€' : '$'}${p.market.toFixed(2)}`}
                  {p.low != null && p.market == null && `from ${p.currency === 'EUR' ? '€' : '$'}${p.low}`}
                </span>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {card.tcgplayerUrl && (
              <a href={card.tcgplayerUrl} target="_blank" rel="noreferrer" className="text-[10px] font-bold text-[#4cc9f0] underline">
                TCGPlayer ↗
              </a>
            )}
            {card.cardmarketUrl && (
              <a href={card.cardmarketUrl} target="_blank" rel="noreferrer" className="text-[10px] font-bold text-[#4cc9f0] underline">
                Cardmarket ↗
              </a>
            )}
          </div>
        </InfoBlock>
      )}

      {(silphcoLoading || silphco) && (
        <InfoBlock title="Graded market (SilphCo)">
          {silphcoLoading && <p className="text-xs font-bold text-[#9b5de5] animate-pulse">Loading market data…</p>}
          {silphco && (
            <>
              <DetailRow label="TV-WAP" value={silphco.tvwapPriceUsd != null ? `$${silphco.tvwapPriceUsd.toFixed(0)}` : undefined} />
              <DetailRow label="PSA 10" value={silphco.psa10PriceUsd != null ? `$${silphco.psa10PriceUsd.toLocaleString()}` : undefined} />
              <DetailRow label="PSA 9" value={silphco.psa9PriceUsd != null ? `$${silphco.psa9PriceUsd.toLocaleString()}` : undefined} />
              <DetailRow label="PSA 8" value={silphco.psa8PriceUsd != null ? `$${silphco.psa8PriceUsd.toLocaleString()}` : undefined} />
              <DetailRow label="30d sales" value={silphco.sales30d?.toString()} />
              <DetailRow label="30d volume" value={silphco.volume30d != null ? `$${silphco.volume30d.toFixed(0)}` : undefined} />
              {silphco.grades.slice(0, 6).map((g) => (
                <DetailRow
                  key={`${g.grader}-${g.gradeLabel}`}
                  label={g.gradeLabel}
                  value={g.avgPriceUsd != null ? `$${g.avgPriceUsd.toFixed(0)} (${g.salesCount})` : `${g.salesCount} sales`}
                />
              ))}
              <a
                href={silphcoCardUrl(silphco.id)}
                target="_blank"
                rel="noreferrer"
                className="inline-block mt-2 text-xs font-bold text-[#4cc9f0] underline"
              >
                View on SilphCo ↗
              </a>
            </>
          )}
        </InfoBlock>
      )}

      <InfoBlock title="Graded market (Renaiss)">
        <RenaissGradedPanel
          liveRenaiss={liveRenaiss}
          liveRate={liveRate}
          liveLoading={liveLoading}
          liveError={liveError}
          onSearch={onSearchRenaiss}
        />
      </InfoBlock>
    </div>
  )
}

function SilphcoDetailView({
  loading,
  card,
  onBack,
  liveRenaiss,
  liveRate,
  liveLoading,
  liveError,
  onSearchRenaiss,
}: {
  loading: boolean
  card: SilphcoCardDetail | null
  onBack: () => void
  liveRenaiss: RenaissSearchHit[] | null
  liveRate: RenaissRateLimit | null
  liveLoading: boolean
  liveError: string | null
  onSearchRenaiss: () => void
}) {
  if (loading || !card) {
    return <p className="text-center text-sm font-bold text-[#9b5de5] py-8 animate-pulse">Loading market data…</p>
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto space-y-3 -mx-1 px-1">
      <button type="button" onClick={onBack} className="text-xs font-bold text-[#9b5de5] hover:text-[#ff6b9d]">
        ← Back to results
      </button>

      <div className="flex gap-3">
        <img
          src={card.imageUrl}
          alt={card.name}
          className="w-28 sm:w-32 rounded-xl border-2 border-white shadow-md shrink-0"
          onError={(e) => { e.currentTarget.src = PLACEHOLDER }}
        />
        <div className="min-w-0">
          <h2 className="font-display text-lg font-black text-[#4a3568] leading-tight">{card.name}</h2>
          <p className="text-xs font-bold text-[#9b5de5] mt-0.5">{card.setName}</p>
          {card.psa10PriceUsd != null && (
            <p className="text-xl font-black text-[#ff6b9d] mt-1">PSA 10 · ${card.psa10PriceUsd.toLocaleString()}</p>
          )}
        </div>
      </div>

      <InfoBlock title="SilphCo market">
        <DetailRow label="TV-WAP" value={card.tvwapPriceUsd != null ? `$${card.tvwapPriceUsd.toFixed(0)}` : undefined} />
        <DetailRow label="Avg sale" value={card.avgPriceUsd != null ? `$${card.avgPriceUsd.toFixed(2)}` : undefined} />
        <DetailRow label="Total sales" value={card.totalSales?.toLocaleString()} />
        <DetailRow label="7d / 30d sales" value={`${card.sales7d ?? '—'} / ${card.sales30d ?? '—'}`} />
        <DetailRow label="Confidence" value={card.tvwapConfidence} />
        {card.grades.slice(0, 8).map((g) => (
          <DetailRow
            key={`${g.grader}-${g.gradeLabel}`}
            label={g.gradeLabel}
            value={g.avgPriceUsd != null ? `$${g.avgPriceUsd.toFixed(0)} · ${g.salesCount} sales` : `${g.salesCount} sales`}
          />
        ))}
        <a href={silphcoCardUrl(card.id)} target="_blank" rel="noreferrer" className="inline-block mt-2 text-xs font-bold text-[#4cc9f0] underline">
          Full analytics on SilphCo ↗
        </a>
      </InfoBlock>

      <InfoBlock title="Graded market (Renaiss)">
        <RenaissGradedPanel
          liveRenaiss={liveRenaiss}
          liveRate={liveRate}
          liveLoading={liveLoading}
          liveError={liveError}
          onSearch={onSearchRenaiss}
        />
      </InfoBlock>
    </div>
  )
}

function GradedDetailView({
  row,
  live,
  loading,
  rate,
  liveError,
  onBack,
  onRefreshLive,
}: {
  row: TradingCardSearchRow
  live: RenaissCardDetail | null
  loading: boolean
  rate: RenaissRateLimit | null
  liveError: string | null
  onBack: () => void
  onRefreshLive: () => void
}) {
  const rarityColor = RARITY_COLORS[row.rarity as Rarity] ?? RARITY_COLORS.rare

  return (
    <div className="flex-1 min-h-0 overflow-y-auto space-y-3 -mx-1 px-1">
      <button type="button" onClick={onBack} className="text-xs font-bold text-[#9b5de5] hover:text-[#ff6b9d]">
        ← Back to results
      </button>

      <div className="flex gap-3">
        <img
          src={row.image}
          alt={row.name}
          className="w-28 rounded-xl border-2 border-white shadow-md shrink-0"
          style={{ boxShadow: `0 4px 0 ${rarityColor}44` }}
          onError={(e) => { e.currentTarget.src = PLACEHOLDER }}
        />
        <div>
          <h2 className="font-display text-lg font-black text-[#4a3568] leading-tight">{row.name}</h2>
          <p className="text-xs font-bold text-[#9b5de5]">{row.gradeLabel}</p>
          <p className="text-2xl font-black text-[#ff6b9d] mt-1">${row.marketPrice.toLocaleString()}</p>
          {row.deltaPct != null && (
            <p className={`text-xs font-bold ${row.deltaPct >= 0 ? 'text-[#7ec850]' : 'text-red-500'}`}>
              {row.deltaPct >= 0 ? '+' : ''}
              {row.deltaPct.toFixed(1)}%
            </p>
          )}
        </div>
      </div>

      <InfoBlock title="From your cache">
        <DetailRow label="Set" value={row.set} />
        <DetailRow label="Game" value={row.game} />
        <DetailRow label="Rarity" value={row.rarity} />
      </InfoBlock>

      {loading && <p className="text-xs font-bold text-[#9b5de5] animate-pulse">Refreshing from Renaiss…</p>}

      {!live && !loading && (
        <KawaiiButton variant="yellow" onClick={onRefreshLive} className="w-full !py-2 text-sm">
          🔄 Refresh live from Renaiss (uses API quota)
        </KawaiiButton>
      )}

      {liveError && <p className="text-[10px] font-bold text-red-500">{liveError}</p>}

      {live && !loading && (
        <InfoBlock title="Live Renaiss detail">
          <DetailRow label="Grade" value={live.gradeLabel ?? live.grade} />
          <DetailRow label="Company" value={live.company} />
          <DetailRow label="Confidence" value={live.confidence} />
          <DetailRow label="Last sale" value={live.lastSaleAt ? new Date(live.lastSaleAt).toLocaleDateString() : undefined} />
          <a
            href={renaissIndexUrl(row.renaissHref)}
            target="_blank"
            rel="noreferrer"
            className="inline-block mt-2 text-xs font-bold text-[#4cc9f0] underline"
          >
            View on Renaiss Index ↗
          </a>
        </InfoBlock>
      )}

      {rate && (
        <p className="text-[9px] font-semibold text-[#b185db] text-center">
          Renaiss API: {rate.remaining}/{rate.limit} left today
        </p>
      )}
    </div>
  )
}

function InfoBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl bg-white/70 border-2 border-white p-2.5">
      <p className="text-[10px] font-bold text-[#9b5de5] uppercase mb-1.5">{title}</p>
      {children}
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div className="flex justify-between gap-2 text-xs py-0.5">
      <span className="font-semibold text-[#b185db]">{label}</span>
      <span className="font-bold text-[#4a3568] text-right">{value}</span>
    </div>
  )
}
