import { KawaiiButton } from '../ui'
import { renaissIndexUrl, type RenaissRateLimit, type RenaissSearchHit } from '../../services/renaissBrowser'

export function RenaissGradedPanel({
  liveRenaiss,
  liveRate,
  liveLoading,
  liveError,
  onSearch,
  label = 'Find graded listings',
}: {
  liveRenaiss: RenaissSearchHit[] | null
  liveRate: RenaissRateLimit | null
  liveLoading: boolean
  liveError: string | null
  onSearch: () => void
  label?: string
}) {
  return (
    <>
      <p className="text-[10px] font-semibold text-[#b185db] mb-2">
        Renaiss graded index — on demand, not stored in our database.
        {liveRate && ` (${liveRate.remaining} API calls left today)`}
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
                    <p className="text-xs font-black text-[#ff6b9d]">
                      ${Math.round(h.priceUsdCents / 100).toLocaleString()}
                    </p>
                  )}
                </div>
              </a>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
