import { MenuFloatingCards } from './MenuFloatingCards'

interface KawaiiButtonProps {
  children: React.ReactNode
  onClick?: () => void
  variant?: 'pink' | 'blue' | 'yellow' | 'purple' | 'green'
  className?: string
  disabled?: boolean
}

const VARIANTS = {
  pink: 'bg-gradient-to-b from-[#ff8fab] to-[#ff6b9d] text-white',
  blue: 'bg-gradient-to-b from-[#72efdd] to-[#4cc9f0] text-white',
  yellow: 'bg-gradient-to-b from-[#ffe066] to-[#ffd166] text-[#6b4c2a]',
  purple: 'bg-gradient-to-b from-[#b185db] to-[#9b5de5] text-white',
  green: 'bg-gradient-to-b from-[#95d86a] to-[#7ec850] text-white',
}

export function KawaiiButton({
  children,
  onClick,
  variant = 'pink',
  className = '',
  disabled,
}: KawaiiButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`btn-kawaii px-6 py-3 text-base md:text-lg ${VARIANTS[variant]} ${className}`}
    >
      {children}
    </button>
  )
}

export function Panel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`panel-kawaii p-5 md:p-7 ${className}`}>{children}</div>
}

export function ScreenLayout({
  children,
  menu = false,
}: {
  children: React.ReactNode
  /** Softer shadows on the main menu screen */
  menu?: boolean
}) {
  return (
    <div
      className={`kawaii-bg absolute inset-0 flex flex-col items-center justify-center overflow-y-auto overflow-x-hidden p-4 px-3 py-3 sm:px-5 sm:py-4 ${
        menu ? 'screen-menu' : ''
      }`}
    >
      <MenuFloatingCards variant={menu ? 'menu' : 'ambient'} />
      <div className="relative z-10 flex w-full flex-col items-center">{children}</div>
    </div>
  )
}

export function Title({ subtitle, compact = false, menu = false }: { subtitle?: string; compact?: boolean; menu?: boolean }) {
  return (
    <div className={`text-center shrink-0 animate-bounce-soft ${compact ? 'mb-2 sm:mb-3' : 'mb-6'}`}>
      <div className="inline-block relative">
        <h1 className="title-pop text-4xl md:text-6xl font-black tracking-wide leading-tight">
          Flip or Fold
        </h1>
        {menu ? (
          <span className="absolute -top-4 -right-10 sm:-right-14 menu-title-card" aria-hidden>
            <span className="menu-title-card__inner">
              <span className="menu-title-card__face" />
            </span>
          </span>
        ) : (
          <span className="absolute -top-3 -right-6 text-2xl animate-wiggle">🃏</span>
        )}
      </div>
      {subtitle && (
        <p className={`font-display text-lg md:text-xl text-[#9b5de5] font-semibold ${compact ? 'mt-1.5 sm:mt-2' : 'mt-3'}`}>
          {subtitle}
        </p>
      )}
    </div>
  )
}

export function StatBubble({ label, value, emoji }: { label: string; value: string | number; emoji: string }) {
  return (
    <div className="flex flex-col items-center bg-white/80 rounded-2xl px-4 py-2 border-2 border-white shadow-sm">
      <span className="text-xl">{emoji}</span>
      <span className="font-display text-xl font-bold text-[#9b5de5]">{value}</span>
      <span className="text-xs font-bold text-[#b185db] uppercase">{label}</span>
    </div>
  )
}

type LegacyVariant = 'primary' | 'secondary' | 'danger'

/** @deprecated use KawaiiButton — maps old variants */
export function NeonButton({
  children,
  onClick,
  variant = 'primary',
  className = '',
  disabled,
}: Omit<KawaiiButtonProps, 'variant'> & { variant?: KawaiiButtonProps['variant'] | LegacyVariant }) {
  const mapped: KawaiiButtonProps['variant'] =
    variant === 'primary' ? 'pink' : variant === 'secondary' ? 'purple' : variant === 'danger' ? 'green' : variant ?? 'pink'
  return (
    <KawaiiButton onClick={onClick} variant={mapped} className={className} disabled={disabled}>
      {children}
    </KawaiiButton>
  )
}
