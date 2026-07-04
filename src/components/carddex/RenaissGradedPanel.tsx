import { KawaiiButton } from '../ui'
import { formatRenaissUsd, renaissIndexUrl, type RenaissRateLimit, type RenaissSearchHit } from '../../services/renaissBrowser'

export function RenaissGradedPanel({
  liveRenaiss,
  liveRate,
  liveLoading,
  liveError,
  onSearch,
  onSelectHit,
  label = 'Find graded listings',
}: {
  liveRenaiss: RenaissSearchHit[] | null
  liveRate: RenaissRateLimit | null
  liveLoading: boolean
  liveError: string | null
  onSearch: () => void
  onSelectHit?: (hit: RenaissSearchHit) => void
  label?: string
}) {
  return (
    <>
      <p className="text-[10px] font-semibold text-[#b185db] mb-2">
        Renaiss OS Index API — graded slabs, trades & price history.
        {liveRate && ` (${liveRate.remaining}/${liveRate.limit} calls left today)`}
      </p>
      <KawaiiButton variant="yellow" onClick={onSearch} disabled={liveLoading} className="w-full !py-2 text-sm">
        {liveLoading ? 'Searching Renaiss…' : label}
      </KawaiiButton>
      {liveError && <p className="text-[10px] font-bold text-red-500 mt-2">{liveError}</p>}
      {liveRenaiss && liveRenaiss.length === 0 && (
        <p className="text-[10px] font-bold text-[#b185db] mt-2">No graded hits on Renaiss for this name.</p>
      )}
      {liveRenaiss && liveRenaiss.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {liveRenaiss.map((h) => (
            <li key={h.href}>
              {onSelectHit ? (
                <button
                  type="button"
                  onClick={() => onSelectHit(h)}
                  className="w-full flex gap-2 items-center rounded-lg bg-white/80 border border-[#e0c3fc] p-1.5 hover:border-[#ff6b9d] text-left"
                >
                  {h.imageUrl && (
                    <img src={h.imageUrl} alt="" className="w-10 h-14 object-cover rounded shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold text-[#4a3568] truncate">{h.name}</p>
                    <p className="text-[9px] text-[#9b5de5]">{h.gradeLabel ?? h.company}</p>
                    {h.priceUsdCents != null && (
                      <p className="text-xs font-black text-[#ff6b9d]">{formatRenaissUsd(h.priceUsdCents)}</p>
                    )}
                  </div>
                </button>
              ) : (
                <a
                  href={renaissIndexUrl(h.href)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex gap-2 items-center rounded-lg bg-white/80 border border-[#e0c3fc] p-1.5 hover:border-[#ff6b9d]"
                >
                  {h.imageUrl && (
                    <img src={h.imageUrl} alt="" className="w-10 h-14 object-cover rounded shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold text-[#4a3568] truncate">{h.name}</p>
                    <p className="text-[9px] text-[#9b5de5]">{h.gradeLabel ?? h.company}</p>
                    {h.priceUsdCents != null && (
                      <p className="text-xs font-black text-[#ff6b9d]">{formatRenaissUsd(h.priceUsdCents)}</p>
                    )}
                  </div>
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
