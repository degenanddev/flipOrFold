import { useEffect, useState, type ReactNode } from 'react'
import { KawaiiButton } from '../ui'
import {
  fetchRenaissGradedBundle,
  formatRenaissUsd,
  renaissIndexUrl,
  type RenaissGradedBundle,
  type RenaissRateLimit,
} from '../../services/renaissBrowser'
import { RARITY_COLORS } from '../../utils/constants'
import type { Rarity } from '../../types'

export interface GradedPreview {
  href: string
  name: string
  image: string
  marketPrice: number
  gradeLabel?: string | null
  game?: string
  set?: string | null
  rarity?: Rarity
  deltaPct?: number | null
}

export function RenaissGradedDetail({
  preview,
  onBack,
}: {
  preview: GradedPreview
  onBack: () => void
}) {
  const [bundle, setBundle] = useState<RenaissGradedBundle | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rate, setRate] = useState<RenaissRateLimit | null>(null)

  const load = async (force = false) => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchRenaissGradedBundle(preview.href, { force })
      setBundle(data)
      setRate(data.rate)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Renaiss load failed')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [preview.href])

  const rarityColor = RARITY_COLORS[preview.rarity ?? 'rare'] ?? RARITY_COLORS.rare
  const detail = bundle?.detail
  const priceCents = detail?.priceUsdCents ?? preview.marketPrice * 100

  return (
    <div className="flex-1 min-h-0 overflow-y-auto space-y-3 -mx-1 px-1">
      <button type="button" onClick={onBack} className="text-xs font-bold text-[#9b5de5] hover:text-[#ff6b9d]">
        ← Back to results
      </button>

      <p className="text-[9px] font-bold text-center text-[#9b5de5] uppercase tracking-wide">
        Renaiss OS Index API · live data
      </p>

      <div className="flex gap-3">
        <img
          src={preview.image || detail?.imageUrl || ''}
          alt={preview.name}
          className="w-28 rounded-xl border-2 border-white shadow-md shrink-0"
          style={{ boxShadow: `0 4px 0 ${rarityColor}44` }}
        />
        <div className="min-w-0">
          <h2 className="font-display text-lg font-black text-[#4a3568] leading-tight">{preview.name}</h2>
          <p className="text-xs font-bold text-[#9b5de5]">{preview.gradeLabel ?? detail?.gradeLabel}</p>
          <p className="text-2xl font-black text-[#ff6b9d] mt-1">{formatRenaissUsd(priceCents)}</p>
          {(preview.deltaPct ?? detail?.deltaPct) != null && (
            <p
              className={`text-xs font-bold ${(preview.deltaPct ?? detail?.deltaPct)! >= 0 ? 'text-[#7ec850]' : 'text-red-500'}`}
            >
              {(preview.deltaPct ?? detail?.deltaPct)! >= 0 ? '+' : ''}
              {(preview.deltaPct ?? detail?.deltaPct)!.toFixed(1)}%
            </p>
          )}
        </div>
      </div>

      {loading && (
        <p className="text-xs font-bold text-[#9b5de5] animate-pulse text-center py-4">
          Loading trades & grades from Renaiss Index…
        </p>
      )}

      {error && (
        <div className="rounded-xl bg-red-50 border-2 border-red-200 p-2.5 text-center">
          <p className="text-[10px] font-bold text-red-600">{error}</p>
          <KawaiiButton variant="yellow" onClick={() => void load(true)} className="w-full !py-1.5 text-xs mt-2">
            Retry
          </KawaiiButton>
        </div>
      )}

      {!loading && bundle && (
        <>
          {detail && (
            <InfoBlock title="Index detail">
              <DetailRow label="Grade" value={detail.gradeLabel ?? detail.grade} />
              <DetailRow label="Grader" value={detail.company} />
              <DetailRow label="Confidence" value={detail.confidence} />
              <DetailRow
                label="Last sale"
                value={detail.lastSaleAt ? new Date(detail.lastSaleAt).toLocaleDateString() : undefined}
              />
              <DetailRow label="Set" value={detail.setName ?? preview.set ?? undefined} />
            </InfoBlock>
          )}

          {bundle.overview && bundle.overview.grades.length > 0 && (
            <InfoBlock title={`All grades (${bundle.overview.grades.length})`}>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {bundle.overview.grades.map((g) => (
                  <div
                    key={`${g.company}-${g.gradeLabel}`}
                    className="flex justify-between gap-2 text-[10px] py-0.5 border-b border-[#e0c3fc]/50 last:border-0"
                  >
                    <span className="font-semibold text-[#9b5de5] truncate">{g.gradeLabel}</span>
                    <span className="font-bold text-[#4a3568] shrink-0">{formatRenaissUsd(g.priceUsdCents)}</span>
                  </div>
                ))}
              </div>
            </InfoBlock>
          )}

          <InfoBlock title={`Past trades (${bundle.tradesTotal})`}>
            {bundle.trades.length === 0 ? (
              <p className="text-[10px] font-bold text-[#b185db]">No trade history returned.</p>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {bundle.trades.map((t, i) => (
                  <div
                    key={`${t.observedAt}-${i}`}
                    className="flex justify-between gap-2 text-[10px] py-1 border-b border-[#e0c3fc]/50 last:border-0"
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-[#4a3568]">{formatRenaissUsd(t.priceUsdCents)}</p>
                      <p className="text-[#9b5de5] truncate">
                        {t.source ?? '—'}
                        {t.kind ? ` · ${t.kind}` : ''}
                      </p>
                      {t.observedAt && (
                        <p className="text-[#b185db]">{new Date(t.observedAt).toLocaleDateString()}</p>
                      )}
                    </div>
                    {t.sourceUrl && (
                      <a
                        href={t.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[9px] font-bold text-[#4cc9f0] underline shrink-0 self-center"
                      >
                        ↗
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </InfoBlock>
        </>
      )}

      <a
        href={renaissIndexUrl(preview.href)}
        target="_blank"
        rel="noreferrer"
        className="block text-center text-xs font-bold text-[#4cc9f0] underline"
      >
        View on Renaiss Index ↗
      </a>

      {!loading && (
        <KawaiiButton variant="purple" onClick={() => void load(true)} className="w-full !py-1.5 text-xs">
          🔄 Refresh from Renaiss (3 API calls)
        </KawaiiButton>
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
