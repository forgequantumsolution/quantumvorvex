import { useContext } from 'react'
import { LuChevronRight, LuTrendingDown, LuTrendingUp, LuMinus } from 'react-icons/lu'
import { StatStripContext } from './statStripContext'

/**
 * KPI card, the one design used for every figure tile in the app. Compact,
 * single block:
 *
 *   [icon]  Label                 ›        phones:  Label          ›
 *           ₹1,14,300  ▲ 12%                    [i] ₹1,14,300
 *           hint                                     hint
 *   ▔▔▔▔▔▔▔▔▔▔▔ (optional progress line along the bottom edge)
 *
 * Props:
 *   label, value       the figure and what it measures
 *   icon               a react-icons element (e.g. <LuUsers />); its chip takes `tone`
 *   tone               gold | green | red | amber | blue | purple | grey
 *   hint               short context line under the value
 *   trend              % change; shown as a green ▲ / red ▼ pill after the value
 *   trendGoodWhenDown  flip the trend colours for figures that should fall (dues, overdue)
 *   progress           0–100; draws a thin bar in the tone colour along the bottom
 *   onClick            makes the whole card a button that links somewhere
 *   selected           marks it as the active filter (gold outline, aria-pressed)
 *   loading            shows a placeholder instead of the value
 *   children           extra content at the bottom
 *
 * Two fit side by side on a 360px phone: long labels wrap to two lines there,
 * and values truncate instead of widening the grid.
 */
const CHIP = {
  gold: 'bg-gold-bg text-gold',
  green: 'bg-success-bg text-success-text',
  red: 'bg-danger-bg text-danger-text',
  amber: 'bg-warning-bg text-warning-text',
  blue: 'bg-info-bg text-info-text',
  purple: 'bg-violet-bg text-violet-text',
  grey: 'bg-surface2 text-ink2',
}

const BAR = {
  gold: 'bg-gold',
  green: 'bg-success',
  red: 'bg-danger',
  amber: 'bg-warning',
  blue: 'bg-info',
  purple: 'bg-violet',
  grey: 'bg-ink3',
}

function Trend({ value, goodWhenDown }) {
  const up = value > 0
  const flat = value === 0
  const good = flat ? null : up !== !!goodWhenDown
  const Icon = flat ? LuMinus : up ? LuTrendingUp : LuTrendingDown
  const cls = good === null
    ? 'bg-surface2 text-ink2'
    : good ? 'bg-success-bg text-success-text' : 'bg-danger-bg text-danger-text'
  return (
    <span className={`inline-flex items-center gap-0.5 shrink-0 rounded-full px-1.5 py-px text-xs font-semibold tabular-nums ${cls}`}>
      <Icon size={11} aria-hidden />
      {Math.abs(value)}%
    </span>
  )
}

export default function StatCard({
  icon, label, value, hint, tone = 'gold', trend, trendGoodWhenDown, progress, onClick, selected, loading, children, className = '',
}) {
  const Comp = onClick ? 'button' : 'div'
  const pct = progress == null ? null : Math.max(0, Math.min(100, Number(progress) || 0))
  const inStrip = useContext(StatStripContext)

  // One segment of PageWrapper's KPI strip: icon, label, value and hint on two
  // short lines; the active filter gets a gold underline.
  if (inStrip) {
    return (
      <Comp
        type={onClick ? 'button' : undefined}
        onClick={onClick}
        aria-pressed={onClick && selected !== undefined ? !!selected : undefined}
        title={typeof label === 'string' ? label : undefined}
        className={`group relative flex-1 min-w-0 flex items-center gap-3 px-4 py-3 text-left bg-transparent border-0 ${
          onClick ? 'cursor-pointer transition-colors hover:bg-surface2 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-gold' : ''
        } ${selected ? 'bg-surface2' : ''} ${className}`}
      >
        {icon && (
          <span className={`w-9 h-9 rounded-lg shrink-0 flex items-center justify-center text-[16px] ${CHIP[tone] || CHIP.gold}`} aria-hidden>
            {icon}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className={`block text-xs font-medium truncate ${selected ? 'text-gold' : 'text-ink3'}`}>{label}</span>
          <span className="flex items-baseline gap-2 min-w-0 mt-0.5">
            <span className="font-display font-bold text-[19px] leading-none tracking-[-0.02em] tabular-nums text-ink shrink-0">
              {loading ? <span className="inline-block h-[0.85em] w-12 rounded bg-surface2 animate-pulse align-middle" /> : value}
            </span>
            {trend != null && <Trend value={trend} goodWhenDown={trendGoodWhenDown} />}
            {hint && <span className="text-xs text-ink3 truncate min-w-0">{hint}</span>}
          </span>
        </span>
        {(selected || pct != null) && (
          <span className={`absolute left-3 right-3 bottom-0 h-[3px] rounded-full ${selected ? 'bg-gold' : BAR[tone] || BAR.gold}`}
            style={!selected && pct != null ? { width: `calc((100% - 1.5rem) * ${pct / 100})`, right: 'auto' } : undefined} aria-hidden />
        )}
      </Comp>
    )
  }

  return (
    <Comp
      type={onClick ? 'button' : undefined}
      aria-pressed={onClick && selected !== undefined ? !!selected : undefined}
      onClick={onClick}
      title={typeof label === 'string' ? label : undefined}
      className={`group relative min-w-0 w-full text-left bg-surface border rounded-xl shadow-soft overflow-hidden ${
        selected ? 'border-gold ring-2 ring-gold/25 bg-gold-bg/40' : 'border-line'} ${
        onClick
          ? 'cursor-pointer transition-[border-color,box-shadow] duration-150 hover:border-gold-border hover:shadow-lift focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold'
          : ''
      } ${className}`}
    >
      <div className="flex items-center gap-3 px-3 py-2.5 sm:px-4 sm:py-3">
        {/* From sm the icon sits beside the text; on phones a small one sits by the value,
            so the label keeps the card's full width. */}
        {icon && (
          <span className={`hidden sm:flex w-10 h-10 rounded-lg shrink-0 items-center justify-center text-[18px] ${CHIP[tone] || CHIP.gold}`} aria-hidden>
            {icon}
          </span>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-1">
            <span className="flex-1 min-w-0 text-xs font-medium text-ink2 leading-tight line-clamp-2 sm:line-clamp-1">{label}</span>
            {onClick && <LuChevronRight size={14} aria-hidden className="sm:hidden shrink-0 -mr-1 text-ink3" />}
          </div>
          <div className="mt-1.5 sm:mt-1 flex items-center gap-1.5 min-w-0">
            {icon && (
              <span className={`sm:hidden w-6 h-6 rounded-md shrink-0 flex items-center justify-center text-[13px] ${CHIP[tone] || CHIP.gold}`} aria-hidden>
                {icon}
              </span>
            )}
            <span className="font-display font-bold text-[18px] sm:text-[22px] leading-none tracking-[-0.02em] tabular-nums text-ink truncate">
              {loading ? <span className="inline-block h-[0.85em] w-14 rounded bg-surface2 animate-pulse align-middle" /> : value}
            </span>
            {trend != null && <Trend value={trend} goodWhenDown={trendGoodWhenDown} />}
          </div>
          {hint && <div className="mt-1 text-xs text-ink3 leading-tight truncate">{hint}</div>}
        </div>

        {onClick && (
          <LuChevronRight size={16} aria-hidden className="hidden sm:block shrink-0 -mr-1 text-ink3 transition-colors group-hover:text-gold" />
        )}
      </div>

      {children && <div className="px-3 pb-2.5 sm:px-4 sm:pb-3">{children}</div>}

      {pct != null && (
        <div className="absolute inset-x-0 bottom-0 h-[3px] bg-surface2" role="presentation">
          <div className={`h-full transition-[width] duration-500 ${BAR[tone] || BAR.gold}`} style={{ width: `${pct}%` }} />
        </div>
      )}
    </Comp>
  )
}
